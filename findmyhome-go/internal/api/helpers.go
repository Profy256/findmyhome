package api

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"findmyhome/backend/internal/model"
	"findmyhome/backend/internal/repo"
)

func userPayload(ctx context.Context, pool *pgxpool.Pool, u model.User) map[string]any {
	cats, _ := u.SellerCategoriesSlice()
	if cats == nil {
		cats = []string{}
	}
	avg, total := ratingStats(ctx, pool, u.ID)
	return map[string]any{
		"id":                  u.ID.String(),
		"name":                u.Name,
		"company_name":        u.CompanyName,
		"display_name":        displayName(u),
		"email":               u.Email,
		"phone":               u.Phone,
		"role":                u.Role,
		"kyc_status":          u.KycStatus,
		"seller_categories":   cats,
		"blue_badge":          model.HasBlueBadge(u, time.Now()),
		"booking_enabled":     u.BookingEnabled,
		"average_rating":      avg,
		"total_reviews":       total,
		"free_featured_slots": u.FreeFeaturedSlots,
		"created_at":          u.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func ratingStats(ctx context.Context, pool *pgxpool.Pool, sellerID uuid.UUID) (avg float64, total int) {
	_ = pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(stars)::float8, 0), COUNT(*)::int
		FROM ratings
		WHERE seller_id = $1 AND is_visible = true
	`, sellerID).Scan(&avg, &total)
	return round1(avg), total
}

func round1(v float64) float64 {
	return float64(int64(v*10+0.5)) / 10
}

func displayName(u model.User) string {
	if u.CompanyName != nil && strings.TrimSpace(*u.CompanyName) != "" {
		return *u.CompanyName
	}
	return u.Name
}

func parsePageReq(r *http.Request) int {
	p, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if p < 1 {
		return 1
	}
	return p
}

func jsonErr(c *gin.Context, code int, msg string) {
	c.JSON(code, gin.H{"message": msg})
}

func writeValidation(c *gin.Context, msg string, errs map[string][]string) {
	c.JSON(http.StatusUnprocessableEntity, gin.H{"message": msg, "errors": errs})
}

func effectiveCommissionRate(ctx context.Context, pool *pgxpool.Pool, u *model.User) float64 {
	if u.CommissionRateOverride != nil {
		return *u.CommissionRateOverride
	}
	if u.Role == "company" {
		return repo.SettingFloat(ctx, pool, "commission_rate_company", 3)
	}
	return repo.SettingFloat(ctx, pool, "commission_rate", 5)
}
