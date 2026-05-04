package api

import (
	"context"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/http"
	"net/url"
	"strings"
	"time"

	"findmyhome/backend/internal/response"
)

func digitsOnlyPhone(in string) string {
	var b strings.Builder
	for _, r := range in {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func formatWhatsAppDigits(phone string) string {
	d := digitsOnlyPhone(phone)
	switch {
	case strings.HasPrefix(d, "256"):
		return d
	case strings.HasPrefix(d, "0"):
		return "256" + strings.TrimPrefix(d, "0")
	default:
		return "256" + d
	}
}

func whatsAppLeadURL(buyerName, sellerPhone, propTitle, propLocation string) string {
	msg :=
		"Hello! I found your listing on Find My Home.\n" +
			"Property: " + propTitle + "\n" +
			"Location: " + propLocation + "\n\n" +
			"I am interested and would like more details.\n" +
			"My name is " + buyerName + "."
	return "https://wa.me/" + formatWhatsAppDigits(sellerPhone) + "?text=" + url.QueryEscape(msg)
}

func (s *Server) enquireLead(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthenticated. Please log in."})
		return
	}

	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	sellerID, propStatus, err := s.propertySellerStatus(c.Request.Context(), pid)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	if propStatus != "active" {
		jsonErr(c, http.StatusUnprocessableEntity, "This property is no longer available.")
		return
	}
	if sellerID == me.ID {
		jsonErr(c, http.StatusUnprocessableEntity, "You cannot contact your own listing.")
		return
	}

	dupID, dup, err := s.findDuplicateLead(c.Request.Context(), me.ID, pid, "platform")
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not record lead.")
		return
	}
	if dup {
		c.JSON(http.StatusOK, map[string]any{
			"message":          "Lead already recorded.",
			"lead_id":          dupID.String(),
			"already_recorded": true,
		})
		return
	}

	lid, createdAt, err := s.insertLead(c.Request.Context(), me.ID, sellerID, pid, "platform")
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not record lead.")
		return
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message": "Lead recorded successfully.",
		"lead": map[string]any{
			"id":             lid.String(),
			"contact_method": "platform",
			"created_at":     createdAt.UTC().Format(time.RFC3339Nano),
		},
	})
}

func (s *Server) whatsappLead(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthenticated. Please log in."})
		return
	}

	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	sellerID, propStatus, err := s.propertySellerStatus(c.Request.Context(), pid)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	if propStatus != "active" {
		jsonErr(c, http.StatusUnprocessableEntity, "This property is no longer available.")
		return
	}
	if sellerID == me.ID {
		jsonErr(c, http.StatusUnprocessableEntity, "You cannot contact your own listing.")
		return
	}

	dupID, dup, err := s.findDuplicateLead(c.Request.Context(), me.ID, pid, "whatsapp")
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not record lead.")
		return
	}

	var sellerPhone, propTitle, propLoc string
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT phone FROM users WHERE id=$1 AND deleted_at IS NULL`, sellerID).Scan(&sellerPhone)
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT title, location FROM properties WHERE id=$1`, pid).Scan(&propTitle, &propLoc)
	waURL := whatsAppLeadURL(me.Name, sellerPhone, propTitle, propLoc)

	if dup {
		c.JSON(http.StatusOK, map[string]any{
			"message":          "Lead already recorded.",
			"lead_id":          dupID.String(),
			"already_recorded": true,
			"whatsapp_url":     waURL,
		})
		return
	}

	lid, createdAt, err := s.insertLead(c.Request.Context(), me.ID, sellerID, pid, "whatsapp")
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not record lead.")
		return
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message": "Lead recorded. Redirecting to WhatsApp.",
		"lead": map[string]any{
			"id":             lid.String(),
			"contact_method": "whatsapp",
			"created_at":     createdAt.UTC().Format(time.RFC3339Nano),
		},
		"whatsapp_url": waURL,
	})
}

func (s *Server) myLeads(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	page := parsePageReq(c.Request)
	perPage := 20

	var total int64
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM leads WHERE seller_id=$1`, me.ID).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load leads.")
		return
	}

	offset := (page - 1) * perPage

	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT l.id,
		       l.contact_method::text,
		       l.created_at,
		       buyer.id::text,
		       buyer.name,
		       buyer.phone,
		       prop.id::text,
		       prop.title,
		       prop.location,
		       prop.price
		FROM leads l
		JOIN users buyer ON buyer.id = l.buyer_id
		JOIN properties prop ON prop.id = l.property_id
		WHERE l.seller_id = $1
		ORDER BY l.created_at DESC
		LIMIT $2 OFFSET $3
	`, me.ID, perPage, offset)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load leads.")
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var id uuid.UUID
		var method string
		var created time.Time
		var bid string
		var bname, bphone string
		var pid string
		var title, loc string
		var price int64
		if err := rows.Scan(&id, &method, &created, &bid, &bname, &bphone, &pid, &title, &loc, &price); err != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not load leads.")
			return
		}
		out = append(out, map[string]any{
			"id":             id.String(),
			"contact_method": method,
			"created_at":     created.UTC().Format(time.RFC3339Nano),
			"buyer":          map[string]any{"id": bid, "name": bname, "phone": bphone},
			"property":       map[string]any{"id": pid, "title": title, "location": loc, "price": price},
		})
	}

	var sumTotal, plat, whats, today int64
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM leads WHERE seller_id=$1`, me.ID).Scan(&sumTotal)
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM leads WHERE seller_id=$1 AND contact_method::text='platform'`, me.ID).Scan(&plat)
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM leads WHERE seller_id=$1 AND contact_method::text='whatsapp'`, me.ID).Scan(&whats)
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM leads WHERE seller_id=$1 AND created_at::date = CURRENT_DATE`, me.ID).Scan(&today)

	path := strings.TrimSuffix(c.Request.URL.Path, "/")

	c.JSON(http.StatusOK, map[string]any{
		"summary": map[string]any{
			"total": sumTotal, "platform": plat, "whatsapp": whats, "today": today,
		},
		"leads": response.Paginator(path, page, perPage, total, out),
	})
}

func (s *Server) insertLead(ctx context.Context, buyer, seller, property uuid.UUID, method string) (uuid.UUID, time.Time, error) {
	var lid uuid.UUID
	var created time.Time

	err := s.Pool.QueryRow(ctx, `
		INSERT INTO leads (buyer_id, seller_id, property_id, contact_method, seller_notified, created_at, updated_at)
		VALUES ($1,$2,$3,$4,FALSE,NOW(),NOW())
		RETURNING id, created_at
	`, buyer, seller, property, method).Scan(&lid, &created)

	if err == nil {
		_, _ = s.Pool.Exec(ctx, `
			UPDATE leads SET seller_notified=TRUE, notified_at=NOW()
			WHERE id=$1
		`, lid)
	}
	return lid, created, err
}

func (s *Server) propertySellerStatus(ctx context.Context, pid uuid.UUID) (seller uuid.UUID, status string, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT seller_id, status::text FROM properties WHERE id=$1 AND deleted_at IS NULL`, pid).
		Scan(&seller, &status)
	return
}

func (s *Server) findDuplicateLead(ctx context.Context, buyer, property uuid.UUID, method string) (uuid.UUID, bool, error) {
	var dup uuid.UUID
	err := s.Pool.QueryRow(ctx, `
		SELECT id FROM leads
		WHERE buyer_id=$1 AND property_id=$2 AND contact_method::text=$3
		  AND created_at >= NOW() - INTERVAL '24 hours'
		ORDER BY created_at DESC
		LIMIT 1
	`, buyer, property, method).Scan(&dup)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}
	if err != nil {
		return uuid.Nil, false, err
	}
	return dup, true, nil
}
