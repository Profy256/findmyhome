package api

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
	"strconv"
	"strings"
	"time"

	"findmyhome/backend/internal/response"
)

func (s *Server) adminBlockUser(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	var body struct {
		Reason *string `json:"reason"`
	}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)

	tx, err := s.Pool.Begin(c.Request.Context())
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not block user.")
		return
	}
	defer tx.Rollback(c.Request.Context())

	tag, err := tx.Exec(c.Request.Context(), `UPDATE users SET kyc_status='blocked', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, uid)
	if err != nil || tag.RowsAffected() == 0 {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	hidden, _ := tx.Exec(c.Request.Context(), `UPDATE properties SET status='frozen', updated_at=NOW() WHERE seller_id=$1 AND status='active' AND deleted_at IS NULL`, uid)

	_ = tx.Commit(c.Request.Context())
	c.JSON(http.StatusOK, map[string]any{
		"message":         "User blocked. Listing(s) hidden.",
		"listings_hidden": hidden.RowsAffected(),
		"reason":          body.Reason,
	})
}

func (s *Server) adminUnblockUser(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET kyc_status='verified', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, uid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not unblock.")
		return
	}
	restored, _ := s.Pool.Exec(c.Request.Context(), `
		UPDATE properties SET status='active', updated_at=NOW()
		WHERE seller_id=$1 AND status='frozen' AND deleted_at IS NULL
	`, uid)
	c.JSON(http.StatusOK, map[string]any{
		"message":           "User unblocked. Listing(s) restored.",
		"listings_restored": restored.RowsAffected(),
	})
}

func (s *Server) adminDeleteUser(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1`, uid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not delete.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "User deleted."})
}

func (s *Server) adminRole(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	var body struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	valid := map[string]bool{"buyer": true, "seller": true, "company": true, "admin": true, "sub_admin": true}
	if !valid[body.Role] {
		writeValidation(c, "Validation failed.", map[string][]string{"role": {"invalid"}})
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET role=$2::user_role_enum, updated_at=NOW() WHERE id=$1`, uid, body.Role); err != nil {
		if _, err2 := s.Pool.Exec(c.Request.Context(), `UPDATE users SET role=$2, updated_at=NOW() WHERE id=$1`, uid, body.Role); err2 != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not change role.")
			return
		}
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Role updated."})
}

func (s *Server) adminListKYC(c *gin.Context) {
	status := strings.TrimSpace(c.Request.URL.Query().Get("status"))

	where := ""
	args := []any{}
	if status != "" {
		where = `WHERE status::text=$1`
		args = append(args, status)
	}

	page := parsePageReq(c.Request)
	perPage := 20
	offset := (page - 1) * perPage

	ctx := c.Request.Context()

	var total int64
	qc := `SELECT COUNT(*) FROM kyc_documents `
	if where != "" {
		qc += where
	}
	if err := s.Pool.QueryRow(ctx, qc, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load KYC.")
		return
	}

	args2 := append(append([]any{}, args...), perPage, offset)
	limit := strconv.Itoa(len(args) + 1)
	off := strconv.Itoa(len(args) + 2)

	q := `
		SELECT row_to_json(t)
		FROM (
		  SELECT d.*, row_to_json(u) AS user
		  FROM kyc_documents d
		  JOIN users u ON u.id=d.user_id
		  ` + where + `
		  ORDER BY d.created_at DESC
		  LIMIT $` + limit + ` OFFSET $` + off + `
		) t
	`

	rows, err := s.Pool.Query(ctx, q, args2...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load KYC.")
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

func (s *Server) adminApproveKYC(c *gin.Context) {
	adm, ok := UserFromContext(c.Request.Context())
	if !ok || adm == nil {
		return
	}
	did, err := uuid.Parse(c.Param("document"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var uid uuid.UUID
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT user_id FROM kyc_documents WHERE id=$1`, did).Scan(&uid); err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	_, err = s.Pool.Exec(c.Request.Context(), `
		UPDATE kyc_documents SET status='verified', reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW()
		WHERE id=$1
	`, did, adm.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not approve.")
		return
	}
	_, _ = s.Pool.Exec(c.Request.Context(), `UPDATE users SET kyc_status='verified', updated_at=NOW() WHERE id=$1`, uid)

	c.JSON(http.StatusOK, map[string]string{"message": "KYC approved. Seller can now list properties."})
}

func (s *Server) adminRejectKYC(c *gin.Context) {
	adm, ok := UserFromContext(c.Request.Context())
	if !ok || adm == nil {
		return
	}
	did, err := uuid.Parse(c.Param("document"))
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

	var uid uuid.UUID
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT user_id FROM kyc_documents WHERE id=$1`, did).Scan(&uid); err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	_, err = s.Pool.Exec(c.Request.Context(), `
		UPDATE kyc_documents SET status='rejected', rejection_reason=$2, reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
		WHERE id=$1
	`, did, strings.TrimSpace(body.Reason), adm.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not reject.")
		return
	}
	_, _ = s.Pool.Exec(c.Request.Context(), `UPDATE users SET kyc_status='rejected', updated_at=NOW() WHERE id=$1`, uid)

	c.JSON(http.StatusOK, map[string]string{"message": "KYC rejected."})
}

func (s *Server) adminRevokeKYC(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	tx, err := s.Pool.Begin(c.Request.Context())
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not revoke KYC.")
		return
	}
	defer tx.Rollback(c.Request.Context())

	_, _ = tx.Exec(c.Request.Context(), `UPDATE users SET kyc_status='none', updated_at=NOW() WHERE id=$1`, uid)
	_, _ = tx.Exec(c.Request.Context(), `UPDATE kyc_documents SET status='rejected', updated_at=NOW() WHERE user_id=$1`, uid)
	frozen, _ := tx.Exec(c.Request.Context(), `
		UPDATE properties SET status='frozen', updated_at=NOW()
		WHERE seller_id=$1 AND status='active' AND deleted_at IS NULL
	`, uid)
	_ = tx.Commit(c.Request.Context())

	c.JSON(http.StatusOK, map[string]any{
		"message":         "KYC revoked. Listing(s) frozen.",
		"listings_frozen": frozen.RowsAffected(),
	})
}

func (s *Server) adminListProperties(c *gin.Context) {
	q := c.Request.URL.Query()
	where := []string{"p.deleted_at IS NULL"}
	args := []any{}
	idx := 1
	if st := strings.TrimSpace(q.Get("status")); st != "" {
		where = append(where, `p.status::text=$`+strconv.Itoa(idx))
		args = append(args, st)
		idx++
	}
	if pt := strings.TrimSpace(q.Get("property_type")); pt != "" {
		where = append(where, `p.property_type::text=$`+strconv.Itoa(idx))
		args = append(args, pt)
		idx++
	}
	if se := strings.TrimSpace(q.Get("search")); se != "" {
		where = append(where, `p.title ILIKE $`+strconv.Itoa(idx))
		args = append(args, "%"+se+"%")
		idx++
	}
	page := parsePageReq(c.Request)
	perPage := 30
	offset := (page - 1) * perPage

	whereSQL := strings.Join(where, " AND ")
	ctx := c.Request.Context()

	var total int64
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties p WHERE `+whereSQL, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not list.")
		return
	}

	args2 := append(append([]any{}, args...), perPage, offset)
	lim := strconv.Itoa(idx)
	off := strconv.Itoa(idx + 1)

	rows, err := s.Pool.Query(ctx, `
		SELECT row_to_json(t) FROM (
		  SELECT p.*, row_to_json(u) AS seller
		  FROM properties p
		  JOIN users u ON u.id=p.seller_id
		  WHERE `+whereSQL+`
		  ORDER BY p.created_at DESC
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

func (s *Server) adminFreezeProperty(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE properties SET status='frozen', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, pid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not freeze.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Listing frozen and hidden from buyers."})
}

func (s *Server) adminUnfreezeProperty(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE properties SET status='active', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, pid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not unfreeze.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Listing restored and visible to buyers."})
}

func (s *Server) adminDeleteProperty(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE properties SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1`, pid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not delete.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Listing permanently deleted."})
}

func (s *Server) adminFeatureProperty(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	var body struct {
		Days int `json:"days"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil || body.Days < 1 || body.Days > 90 {
		writeValidation(c, "Validation failed.", map[string][]string{"days": {"invalid"}})
		return
	}
	until := time.Now().UTC().AddDate(0, 0, body.Days)
	if _, err := s.Pool.Exec(c.Request.Context(), `
		UPDATE properties SET featured=TRUE, featured_until=$2, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL
	`, pid, until); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not feature.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Listing featured."})
}

func (s *Server) adminUnfeatureProperty(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE properties SET featured=FALSE, featured_until=NULL, updated_at=NOW() WHERE id=$1`, pid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not unfeature.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Featured status removed."})
}

func (s *Server) adminVerifyTitle(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var typ string
	var landURL *string
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT property_type::text, land_title_url FROM properties WHERE id=$1`, pid).
		Scan(&typ, &landURL); err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if typ != "land" || landURL == nil || strings.TrimSpace(*landURL) == "" {
		jsonErr(c, http.StatusUnprocessableEntity, "No land title to verify.")
		return
	}
	if _, err := s.Pool.Exec(c.Request.Context(), `UPDATE properties SET land_title_verified=TRUE, updated_at=NOW() WHERE id=$1`, pid); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not verify.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Land title marked as verified."})
}
