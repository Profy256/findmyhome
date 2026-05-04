package api

import (
	"context"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
	"strconv"
	"strings"
	"time"

	"findmyhome/backend/internal/repo"
	"findmyhome/backend/internal/response"
)

func (s *Server) commissionProcessPayment(ctx context.Context, cid uuid.UUID) error {
	var seller uuid.UUID
	if err := s.Pool.QueryRow(ctx, `SELECT seller_id FROM commissions WHERE id=$1`, cid).Scan(&seller); err != nil {
		return err
	}

	if _, err := s.Pool.Exec(ctx, `UPDATE commissions SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1`, cid); err != nil {
		return err
	}

	var remaining int64
	_ = s.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM commissions
		WHERE seller_id=$1 AND status IN ('pending','reminded','overdue') AND due_date < CURRENT_DATE
	`, seller).Scan(&remaining)

	var ks string
	_ = s.Pool.QueryRow(ctx, `SELECT kyc_status::text FROM users WHERE id=$1 AND deleted_at IS NULL`, seller).Scan(&ks)

	if remaining == 0 && ks == "blocked" {
		_, _ = s.Pool.Exec(ctx, `UPDATE users SET kyc_status='verified', updated_at=NOW() WHERE id=$1`, seller)
		_, _ = s.Pool.Exec(ctx, `
			UPDATE properties SET status='active', updated_at=NOW()
			WHERE seller_id=$1 AND status='frozen' AND deleted_at IS NULL
		`, seller)
	}
	return nil
}

func (s *Server) adminListCommissions(c *gin.Context) {
	st := strings.TrimSpace(c.Request.URL.Query().Get("status"))

	where := ""
	args := []any{}
	if st != "" {
		where = `WHERE c.status::text=$1`
		args = append(args, st)
	}

	page := parsePageReq(c.Request)
	perPage := 30
	ctx := c.Request.Context()

	var total int64
	qc := `SELECT COUNT(*) FROM commissions c ` + where
	if err := s.Pool.QueryRow(ctx, qc, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not list.")
		return
	}

	offset := (page - 1) * perPage
	args2 := append(append([]any{}, args...), perPage, offset)
	lim := strconv.Itoa(len(args) + 1)
	off := strconv.Itoa(len(args) + 2)

	rows, err := s.Pool.Query(ctx, `
		SELECT row_to_json(t) FROM (
		  SELECT c.*, row_to_json(s) AS seller, row_to_json(t2) AS transaction
		  FROM commissions c
		  JOIN users s ON s.id=c.seller_id
		  JOIN transactions t2 ON t2.id=c.transaction_id
		  `+where+`
		  ORDER BY c.created_at DESC
		  LIMIT $`+lim+` OFFSET $`+off+`
		) t
	`, args2...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not list.")
		return
	}
	defer rows.Close()

	items := []any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			break
		}
		var obj any
		_ = json.Unmarshal(raw, &obj)
		items = append(items, obj)
	}
	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, items))
}

func (s *Server) adminMarkCommissionPaid(c *gin.Context) {
	cid, err := uuid.Parse(c.Param("commission"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if err := s.commissionProcessPayment(c.Request.Context(), cid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update commission.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Commission marked as paid. Seller account checked for restoration."})
}

func (s *Server) adminWaiveCommission(c *gin.Context) {
	cid, err := uuid.Parse(c.Param("commission"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil || strings.TrimSpace(body.Reason) == "" {
		writeValidation(c, "Validation failed.", map[string][]string{"reason": {"required"}})
		return
	}

	var seller uuid.UUID
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT seller_id FROM commissions WHERE id=$1`, cid).Scan(&seller); err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE commissions SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1`, cid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not waive.")
		return
	}

	var ks string
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT kyc_status::text FROM users WHERE id=$1`, seller).Scan(&ks)
	if ks == "blocked" {
		_ = s.commissionProcessPayment(c.Request.Context(), cid) // idempotent-ish; recomputes unpaid
	}

	c.JSON(http.StatusOK, map[string]string{"message": "Commission waived."})
}

func (s *Server) adminGrantBadge(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	var body struct {
		Days *int `json:"days"`
	}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)
	days := 365
	if body.Days != nil && *body.Days > 0 {
		days = *body.Days
	}
	until := time.Now().UTC().AddDate(0, 0, days)
	if _, err := s.Pool.Exec(c.Request.Context(), `
		UPDATE users SET blue_badge=TRUE, blue_badge_expires_at=$2, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL
	`, uid, until); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not grant badge.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Blue badge granted."})
}

func (s *Server) adminRevokeBadge(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET blue_badge=FALSE, blue_badge_expires_at=NULL, updated_at=NOW() WHERE id=$1`, uid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not revoke badge.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Blue badge revoked."})
}

func (s *Server) adminBookings(c *gin.Context) {
	st := strings.TrimSpace(c.Request.URL.Query().Get("status"))
	where := ""
	args := []any{}
	if st != "" {
		where = `WHERE b.status::text=$1`
		args = append(args, st)
	}
	page := parsePageReq(c.Request)
	perPage := 30
	offset := (page - 1) * perPage
	ctx := c.Request.Context()

	var total int64
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings b `+where, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load.")
		return
	}

	args2 := append(append([]any{}, args...), perPage, offset)
	lim := strconv.Itoa(len(args) + 1)
	off := strconv.Itoa(len(args) + 2)

	rows, err := s.Pool.Query(ctx, `
		SELECT row_to_json(t) FROM (
		  SELECT b.*,
		         row_to_json(buyer) AS buyer,
		         row_to_json(prop) AS property,
		         row_to_json(sel) AS property_seller
		  FROM bookings b
		  JOIN users buyer ON buyer.id=b.buyer_id
		  JOIN properties prop ON prop.id=b.property_id
		  JOIN users sel ON sel.id=prop.seller_id
		  `+where+`
		  ORDER BY b.created_at DESC
		  LIMIT $`+lim+` OFFSET $`+off+`
		) t
	`, args2...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load.")
		return
	}
	defer rows.Close()

	items := []any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			break
		}
		var obj any
		_ = json.Unmarshal(raw, &obj)
		items = append(items, obj)
	}
	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, items))
}

func (s *Server) adminBookingStatus(c *gin.Context) {
	bid, err := uuid.Parse(c.Param("booking"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
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
	valid := map[string]bool{"confirmed": true, "rejected": true, "completed": true, "cancelled": true}
	if !valid[body.Status] {
		writeValidation(c, "Validation failed.", map[string][]string{"status": {"invalid"}})
		return
	}

	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE bookings SET status=$2, updated_at=NOW() WHERE id=$1`, bid, body.Status); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Booking updated."})
}

func (s *Server) adminGrantBookingAccess(c *gin.Context) {
	seller, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var ks string
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT kyc_status::text FROM users WHERE id=$1`, seller).Scan(&ks); err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if ks != "verified" {
		jsonErr(c, http.StatusUnprocessableEntity, "Seller must be KYC verified first.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET booking_enabled=TRUE, updated_at=NOW() WHERE id=$1`, seller); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not grant access.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Online booking access granted."})
}

func (s *Server) adminRevokeBookingAccess(c *gin.Context) {
	seller, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET booking_enabled=FALSE, updated_at=NOW() WHERE id=$1`, seller); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not revoke.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Online booking access revoked."})
}

func (s *Server) adminRatings(c *gin.Context) {
	vis := strings.TrimSpace(c.Request.URL.Query().Get("is_visible"))

	where := ""
	args := []any{}
	if vis == "true" || vis == "false" {
		where = `WHERE r.is_visible=$1`
		args = append(args, vis == "true")
	}

	page := parsePageReq(c.Request)
	perPage := 30
	offset := (page - 1) * perPage
	ctx := c.Request.Context()

	var total int64
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM ratings r `+where, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load ratings: "+err.Error())
		return
	}

	args2 := append(append([]any{}, args...), perPage, offset)
	lim := strconv.Itoa(len(args) + 1)
	off := strconv.Itoa(len(args) + 2)

	rows, err := s.Pool.Query(ctx, `
		SELECT row_to_json(t) FROM (
		  SELECT r.*,
		    row_to_json(buyer) AS buyer,
		    row_to_json(seller) AS seller,
		    row_to_json(prop) AS property
		  FROM ratings r
		  JOIN users buyer ON buyer.id=r.buyer_id
		  JOIN users seller ON seller.id=r.seller_id
		  LEFT JOIN properties prop ON prop.id=r.property_id
		  `+where+`
		  ORDER BY r.created_at DESC
		  LIMIT $`+lim+` OFFSET $`+off+`
		) t
	`, args2...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load ratings: "+err.Error())
		return
	}
	defer rows.Close()

	items := []any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			break
		}
		var obj any
		_ = json.Unmarshal(raw, &obj)
		items = append(items, obj)
	}
	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, items))
}

func (s *Server) adminHideRating(c *gin.Context) {
	rid, err := uuid.Parse(c.Param("rating"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE ratings SET is_visible=FALSE, updated_at=NOW() WHERE id=$1`, rid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not hide.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Review hidden from public profile."})
}

func (s *Server) adminRestoreRating(c *gin.Context) {
	rid, err := uuid.Parse(c.Param("rating"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE ratings SET is_visible=TRUE, updated_at=NOW() WHERE id=$1`, rid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not restore.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Review restored."})
}

func (s *Server) adminDeleteRating(c *gin.Context) {
	rid, err := uuid.Parse(c.Param("rating"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `DELETE FROM ratings WHERE id=$1`, rid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not delete.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Review permanently deleted."})
}

func (s *Server) adminLeads(c *gin.Context) {
	q := c.Request.URL.Query()
	where := ""
	args := []any{}
	idx := 1

	if m := strings.TrimSpace(q.Get("method")); m != "" {
		where = `WHERE l.contact_method::text=$` + strconv.Itoa(idx)
		args = append(args, m)
		idx++
	}
	if sid := strings.TrimSpace(q.Get("seller_id")); sid != "" {
		pfx := "WHERE"
		if where != "" {
			pfx = "AND"
		}
		where += ` ` + pfx + ` l.seller_id=$` + strconv.Itoa(idx) + `::uuid`
		args = append(args, sid)
		idx++
	}

	page := parsePageReq(c.Request)
	perPage := 30
	offset := (page - 1) * perPage

	ctx := c.Request.Context()

	var total int64
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads l `+where, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load.")
		return
	}

	args2 := append(append([]any{}, args...), perPage, offset)
	lim := strconv.Itoa(len(args) + 1)
	off := strconv.Itoa(len(args) + 2)

	rows, err := s.Pool.Query(ctx, `
		SELECT row_to_json(t) FROM (
		  SELECT l.*,
		    row_to_json(buyer) AS buyer,
		    row_to_json(seller) AS seller,
		    row_to_json(prop) AS property
		  FROM leads l
		  JOIN users buyer ON buyer.id=l.buyer_id
		  JOIN users seller ON seller.id=l.seller_id
		  JOIN properties prop ON prop.id=l.property_id
		  `+where+`
		  ORDER BY l.created_at DESC
		  LIMIT $`+lim+` OFFSET $`+off+`
		) t
	`, args2...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load.")
		return
	}
	defer rows.Close()

	items := []any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			break
		}
		var obj any
		_ = json.Unmarshal(raw, &obj)
		items = append(items, obj)
	}
	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, items))
}

func (s *Server) adminSettingsGet(c *gin.Context) {
	rows, err := s.Pool.Query(c.Request.Context(), `SELECT row_to_json(s) FROM settings s`)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load settings.")
		return
	}
	defer rows.Close()

	settings := map[string]any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			break
		}
		var obj map[string]any
		if json.Unmarshal(raw, &obj) != nil {
			continue
		}
		key, _ := obj["key"].(string)
		settings[key] = obj
	}
	c.JSON(http.StatusOK, settings)
}

func (s *Server) adminSettingsPatch(c *gin.Context) {
	key := c.Param("key")

	var body struct {
		Value any `json:"value"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	val := ""
	switch v := body.Value.(type) {
	case string:
		val = v
	case float64:
		val = strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		val = strconv.FormatBool(v)
	default:
		b, _ := json.Marshal(body.Value)
		val = string(b)
	}

	if err := repo.SettingUpdate(c.Request.Context(), s.Pool, key, val); err != nil {
		jsonErr(c, http.StatusNotFound, "Setting not found.")
		return
	}

	c.JSON(http.StatusOK, map[string]string{"message": "Setting updated."})
}
