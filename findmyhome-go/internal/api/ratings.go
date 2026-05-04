package api

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"findmyhome/backend/internal/model"
	"findmyhome/backend/internal/repo"
	"findmyhome/backend/internal/response"
)

func (s *Server) rateSeller(c *gin.Context) {
	buyer, ok := UserFromContext(c.Request.Context())
	if !ok || buyer == nil {
		return
	}
	if buyer.Role != "buyer" {
		c.JSON(http.StatusForbidden, map[string]string{"message": "Only buyers can leave ratings and reviews."})
		return
	}

	sellerID, err := uuid.Parse(c.Param("seller"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	sellerRow, err := repo.GetUser(c.Request.Context(), s.Pool, sellerID)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if sellerRow.Role != "seller" && sellerRow.Role != "company" && sellerRow.Role != "admin" {
		jsonErr(c, http.StatusUnprocessableEntity, "You can only rate sellers and companies.")
		return
	}

	var hasLead int
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT 1 FROM leads WHERE buyer_id=$1 AND seller_id=$2 LIMIT 1`, buyer.ID, sellerID).Scan(&hasLead)
	if hasLead == 0 {
		c.JSON(http.StatusForbidden, map[string]any{
			"message": "You can only rate sellers you have contacted through Find My Home.",
			"reason":  "No contact found between you and this seller on our platform.",
		})
		return
	}

	var existing uuid.UUID
	err = s.Pool.QueryRow(c.Request.Context(), `SELECT id FROM ratings WHERE buyer_id=$1 AND seller_id=$2`, buyer.ID, sellerID).Scan(&existing)
	if err == nil {
		var stars int
		var review *string
		var created time.Time
		_ = s.Pool.QueryRow(c.Request.Context(), `SELECT stars, review, created_at FROM ratings WHERE id=$1`, existing).
			Scan(&stars, &review, &created)
		c.JSON(http.StatusUnprocessableEntity, map[string]any{
			"message":     "You have already rated this seller.",
			"your_rating": map[string]any{"id": existing.String(), "stars": stars, "review": review, "created_at": created.UTC().Format(time.RFC3339Nano)},
			"tip":         "You can update your existing rating instead.",
		})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		jsonErr(c, http.StatusInternalServerError, "Could not create rating.")
		return
	}

	var body struct {
		Stars      int        `json:"stars"`
		Review     *string    `json:"review"`
		PropertyID *uuid.UUID `json:"property_id"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	if body.Stars < 1 || body.Stars > 5 {
		writeValidation(c, "Validation failed.", map[string][]string{"stars": {"invalid"}})
		return
	}

	var rid uuid.UUID
	err = s.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO ratings (buyer_id, seller_id, property_id, stars, review, is_visible, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,TRUE,NOW(),NOW())
		RETURNING id
	`, buyer.ID, sellerID, body.PropertyID, int16(body.Stars), body.Review).Scan(&rid)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not create rating.")
		return
	}

	avg, total := ratingStats(c.Request.Context(), s.Pool, sellerID)

	c.JSON(http.StatusCreated, map[string]any{
		"message":        "Thank you for your review. It is now visible to other buyers.",
		"rating":         map[string]any{"id": rid.String(), "buyer": map[string]any{"id": buyer.ID.String(), "name": buyer.Name}},
		"seller_average": avg,
		"seller_total":   total,
	})
}

func (s *Server) updateRating(c *gin.Context) {
	buyer, ok := UserFromContext(c.Request.Context())
	if !ok || buyer == nil {
		return
	}
	rid, err := uuid.Parse(c.Param("rating"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var owner uuid.UUID
	err = s.Pool.QueryRow(c.Request.Context(), `SELECT buyer_id FROM ratings WHERE id=$1`, rid).Scan(&owner)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if owner != buyer.ID {
		jsonErr(c, http.StatusForbidden, "Unauthorized.")
		return
	}

	var body struct {
		Stars  int     `json:"stars"`
		Review *string `json:"review"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	if body.Stars < 1 || body.Stars > 5 {
		writeValidation(c, "Validation failed.", map[string][]string{"stars": {"invalid"}})
		return
	}

	_, err = s.Pool.Exec(c.Request.Context(), `UPDATE ratings SET stars=$2, review=$3, updated_at=NOW() WHERE id=$1`, rid, int16(body.Stars), body.Review)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update.")
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"message": "Your review has been updated.",
		"rating":  map[string]any{"id": rid.String(), "buyer": map[string]any{"id": buyer.ID.String(), "name": buyer.Name}},
	})
}

func (s *Server) sellerReviews(c *gin.Context) {
	sellerID, err := uuid.Parse(c.Param("seller"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	su, err := repo.GetUser(c.Request.Context(), s.Pool, sellerID)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	page := parsePageReq(c.Request)
	perPage := 10

	var total int64
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM ratings WHERE seller_id=$1 AND is_visible=TRUE`, sellerID).Scan(&total)
	offset := (page - 1) * perPage

	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT r.id::text, r.stars, r.review, r.created_at,
		       buyer.id::text, buyer.name,
		       prop.id::text, prop.title, prop.location
		FROM ratings r
		JOIN users buyer ON buyer.id=r.buyer_id
		LEFT JOIN properties prop ON prop.id=r.property_id
		WHERE r.seller_id=$1 AND r.is_visible=TRUE
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3
	`, sellerID, perPage, offset)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load reviews.")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id string
		var stars int32
		var review *string
		var created time.Time
		var bid, bname string
		var pid, ptitle, ploc *string
		if err := rows.Scan(&id, &stars, &review, &created, &bid, &bname, &pid, &ptitle, &ploc); err != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not load reviews.")
			return
		}
		var prop any
		if pid != nil {
			prop = map[string]any{"id": *pid, "title": *ptitle, "location": *ploc}
		}
		items = append(items, map[string]any{
			"id":         id,
			"stars":      stars,
			"review":     review,
			"created_at": created.UTC().Format(time.RFC3339Nano),
			"buyer":      map[string]any{"id": bid, "name": bname},
			"property":   prop,
		})
	}

	breakdown := starBreakdown(c.Request.Context(), s.Pool, sellerID)
	avg, totalR := ratingStats(c.Request.Context(), s.Pool, sellerID)

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, map[string]any{
		"seller": map[string]any{
			"id":             su.ID.String(),
			"name":           displayName(*su),
			"role":           su.Role,
			"blue_badge":     model.HasBlueBadge(*su, time.Now()),
			"average_rating": avg,
			"total_reviews":  totalR,
			"breakdown":      breakdown,
		},
		"reviews": response.Paginator(path, page, perPage, total, items),
	})
}

func (s *Server) canRate(c *gin.Context) {
	buyer, ok := UserFromContext(c.Request.Context())
	if !ok || buyer == nil {
		return
	}
	sellerID, err := uuid.Parse(c.Param("seller"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	if buyer.Role != "buyer" {
		c.JSON(http.StatusOK, map[string]any{"can_rate": false, "reason": "Only buyers can leave ratings."})
		return
	}

	var hasLead int
	_ = s.Pool.QueryRow(c.Request.Context(), `SELECT 1 FROM leads WHERE buyer_id=$1 AND seller_id=$2 LIMIT 1`, buyer.ID, sellerID).Scan(&hasLead)
	hasInteracted := hasLead == 1

	var rid uuid.UUID
	var already bool
	var existing any
	err = s.Pool.QueryRow(c.Request.Context(), `SELECT id FROM ratings WHERE buyer_id=$1 AND seller_id=$2`, buyer.ID, sellerID).Scan(&rid)
	if err == nil {
		already = true
		var stars int
		var review *string
		var created time.Time
		_ = s.Pool.QueryRow(c.Request.Context(), `SELECT stars, review, created_at FROM ratings WHERE id=$1`, rid).
			Scan(&stars, &review, &created)
		existing = map[string]any{
			"id": rid.String(), "stars": stars, "review": review,
			"created_at": created.UTC().Format(time.RFC3339Nano),
		}
	}

	var reason any
	if !hasInteracted {
		reason = "You have not contacted this seller through Find My Home yet."
	} else if already {
		reason = "You have already rated this seller."
	}

	c.JSON(http.StatusOK, map[string]any{
		"can_rate":        hasInteracted && !already,
		"can_update":      already,
		"has_interacted":  hasInteracted,
		"already_rated":   already,
		"existing_rating": existing,
		"reason":          reason,
	})
}

func starBreakdown(ctx context.Context, pool *pgxpool.Pool, sellerID uuid.UUID) map[int]map[string]any {
	out := map[int]map[string]any{}
	var total int64
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM ratings WHERE seller_id=$1 AND is_visible=TRUE`, sellerID).Scan(&total)
	for stars := 5; stars >= 1; stars-- {
		var c int64
		_ = pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM ratings WHERE seller_id=$1 AND is_visible=TRUE AND stars=$2
		`, sellerID, stars).Scan(&c)
		pct := 0
		if total > 0 {
			pct = int((float64(c) / float64(total)) * 100)
		}
		out[stars] = map[string]any{"count": c, "percentage": pct}
	}
	return out
}
