package api

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"math"
	"net/http"
	"strings"
	"time"

	"findmyhome/backend/internal/repo"
	"findmyhome/backend/internal/response"
)

func dateUTC(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func parseDate(ds string) time.Time {
	ds = strings.TrimSpace(ds)
	if ds == "" {
		return time.Time{}
	}
	if len(ds) >= 10 {
		ds = ds[:10]
	}
	t, err := time.Parse("2006-01-02", ds)
	if err != nil {
		return time.Time{}
	}
	return t
}

func (s *Server) bookingStore(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var listingType string
	var propStatus string
	var seller uuid.UUID
	var bookingEnabled bool
	var title string
	var price int64

	err = s.Pool.QueryRow(c.Request.Context(), `
		SELECT p.listing_type::text, p.status::text, p.seller_id, u.booking_enabled, p.title, p.price::bigint
		FROM properties p
		JOIN users u ON u.id = p.seller_id
		WHERE p.id=$1 AND p.deleted_at IS NULL AND u.deleted_at IS NULL
	`, pid).Scan(&listingType, &propStatus, &seller, &bookingEnabled, &title, &price)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	if listingType != "rent" {
		jsonErr(c, http.StatusUnprocessableEntity, "Online booking is only available for rental properties.")
		return
	}
	if !bookingEnabled {
		jsonErr(c, http.StatusUnprocessableEntity, "This seller has not enabled online booking. Please contact them directly.")
		return
	}
	if propStatus != "active" {
		jsonErr(c, http.StatusUnprocessableEntity, "This property is not available.")
		return
	}
	if seller == me.ID {
		jsonErr(c, http.StatusUnprocessableEntity, "You cannot book your own property.")
		return
	}

	var body struct {
		Checkin  string `json:"checkin_date"`
		Checkout string `json:"checkout_date"`
		Guests   int    `json:"guests"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}

	in := parseDate(body.Checkin)
	out := parseDate(body.Checkout)
	today := dateUTC(time.Now().UTC())
	if body.Guests < 1 || body.Guests > 20 {
		writeValidation(c, "Validation failed.", map[string][]string{"guests": {"invalid"}})
		return
	}
	if in.IsZero() || out.IsZero() || !out.After(in) || !(in.UTC().After(today)) {
		jsonErr(c, http.StatusUnprocessableEntity, "Invalid dates.")
		return
	}

	nights := int(out.Sub(in).Hours() / 24)
	if nights <= 0 {
		jsonErr(c, http.StatusUnprocessableEntity, "Invalid dates.")
		return
	}

	var conflict int
	_ = s.Pool.QueryRow(c.Request.Context(), `
		SELECT 1 FROM bookings
		WHERE property_id=$1 AND status IN ('confirmed','pending')
		  AND NOT (checkout_date <= $2::date OR checkin_date >= $3::date)
		LIMIT 1
	`, pid, in.Format("2006-01-02"), out.Format("2006-01-02")).Scan(&conflict)
	if conflict == 1 {
		jsonErr(c, http.StatusUnprocessableEntity, "This property is not available for your selected dates.")
		return
	}

	totalPrice := price * int64(nights)
	feeRate := repo.SettingFloat(c.Request.Context(), s.Pool, "booking_fee_rate", 7) / 100
	platformFee := int64(math.Round(float64(totalPrice) * feeRate))
	orderID := "FMH-" + strings.ReplaceAll(strings.ToUpper(uuid.NewString()), "-", "")

	var bookingID string
	err = s.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO bookings (
		  buyer_id, property_id,
		  checkin_date, checkout_date, guests,
		  total_price, platform_fee,
		  status, payment_status,
		  pesapal_order_id,
		  created_at, updated_at
		) VALUES (
		  $1,$2,$3::date,$4::date,$5,$6,$7,'pending','unpaid',$8,NOW(),NOW()
		)
		RETURNING id::text
	`, me.ID, pid, in.Format("2006-01-02"), out.Format("2006-01-02"), body.Guests, totalPrice, platformFee, orderID).Scan(&bookingID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not create booking.")
		return
	}

	userRow, err := repo.GetUser(c.Request.Context(), s.Pool, me.ID)
	paymentURL := ""
	if err == nil {
		paymentURL = s.initiatePesapal(c.Request.Context(), orderID, totalPrice+platformFee, title, userRow)
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message":     "Booking request created. Please complete payment to confirm.",
		"booking":     map[string]any{"id": bookingID, "pesapal_order_id": orderID},
		"payment_url": nullString(paymentURL),
		"summary": map[string]string{
			"nights":          fmt.Sprintf("%d", nights),
			"price_per_night": fmt.Sprintf("%d", price),
			"total_price":     fmt.Sprintf("%d", totalPrice),
			"platform_fee":    fmt.Sprintf("%d", platformFee),
			"total_due":       fmt.Sprintf("%d", totalPrice+platformFee),
		},
	})
}

func nullString(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (s *Server) bookingUpdateStatus(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	bookingUUID, err := uuid.Parse(c.Param("booking"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var seller uuid.UUID
	var cur string
	err = s.Pool.QueryRow(c.Request.Context(), `
		SELECT p.seller_id, b.status::text
		FROM bookings b
		JOIN properties p ON p.id=b.property_id
		WHERE b.id=$1
	`, bookingUUID).Scan(&seller, &cur)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if seller != me.ID {
		jsonErr(c, http.StatusForbidden, "Unauthorized.")
		return
	}
	if cur != "pending" {
		jsonErr(c, http.StatusUnprocessableEntity, "This booking cannot be updated.")
		return
	}

	var body struct {
		Status string  `json:"status"`
		Reason *string `json:"reason"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	if body.Status != "confirmed" && body.Status != "rejected" {
		writeValidation(c, "Validation failed.", map[string][]string{"status": {"invalid"}})
		return
	}

	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE bookings SET status=$2, updated_at=NOW() WHERE id=$1`, bookingUUID, body.Status); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update booking.")
		return
	}

	msg := "Booking rejected. The guest has been notified."
	if body.Status == "confirmed" {
		msg = "Booking confirmed. The guest has been notified."
	}
	_ = body.Reason

	c.JSON(http.StatusOK, map[string]any{
		"message": msg,
		"booking": map[string]string{"id": bookingUUID.String(), "status": body.Status},
	})
}

func (s *Server) myBookings(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	page := parsePageReq(c.Request)
	perPage := 20
	offset := (page - 1) * perPage

	isSellerRole := me.Role == "seller" || me.Role == "company" || me.Role == "admin"

	var total int64
	var rows pgx.Rows
	var err error

	if isSellerRole {
		if err := s.Pool.QueryRow(c.Request.Context(), `
			SELECT COUNT(*) FROM bookings b JOIN properties p ON p.id=b.property_id WHERE p.seller_id=$1
		`, me.ID).Scan(&total); err != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not load bookings.")
			return
		}
		rows, err = s.Pool.Query(c.Request.Context(), `
			SELECT b.id::text, b.status::text, b.payment_status::text,
			       b.created_at,
			       buyer.id::text, buyer.name, buyer.phone,
			       prop.id::text, prop.title, prop.location, prop.price::bigint
			FROM bookings b
			JOIN properties prop ON prop.id=b.property_id
			JOIN users buyer ON buyer.id=b.buyer_id
			WHERE prop.seller_id=$1
			ORDER BY b.created_at DESC
			LIMIT $2 OFFSET $3
		`, me.ID, perPage, offset)
	} else {
		if err := s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM bookings WHERE buyer_id=$1`, me.ID).Scan(&total); err != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not load bookings.")
			return
		}
		rows, err = s.Pool.Query(c.Request.Context(), `
			SELECT b.id::text, b.status::text, b.payment_status::text,
			       b.created_at,
			       buyer.id::text, buyer.name, buyer.phone,
			       prop.id::text, prop.title, prop.location, prop.price::bigint
			FROM bookings b
			JOIN properties prop ON prop.id=b.property_id
			JOIN users buyer ON buyer.id=b.buyer_id
			WHERE b.buyer_id=$1
			ORDER BY b.created_at DESC
			LIMIT $2 OFFSET $3
		`, me.ID, perPage, offset)
	}

	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load bookings.")
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var id, status, payst string
		var created time.Time
		var buyerID string
		var bname, bphone string
		var pid, title, loc string
		var price int64
		if err := rows.Scan(&id, &status, &payst, &created, &buyerID, &bname, &bphone, &pid, &title, &loc, &price); err != nil {
			break
		}
		out = append(out, map[string]any{
			"id": id, "status": status, "payment_status": payst,
			"created_at": created.UTC().Format(time.RFC3339Nano),
			"buyer":      map[string]any{"id": buyerID, "name": bname, "phone": bphone},
			"property":   map[string]any{"id": pid, "title": title, "location": loc, "price": price},
		})
	}

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, out))
}
