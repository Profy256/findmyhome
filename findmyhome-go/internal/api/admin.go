package api

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
	"strconv"
	"strings"
	"time"

	"findmyhome/backend/internal/repo"
	"findmyhome/backend/internal/response"
)

func (s *Server) adminDashboard(c *gin.Context) {
	ctx := c.Request.Context()

	var usersTotal, buyers, sellers, companies, blocked, kycPending int64
	var propsTotal, active, frozen, sold, rented, featured int64
	var leadsTotal, leadsPlat, leadsWA, leadsToday int64
	var cpending, coverdue, cpaid int64
	var bookedTotal, bookPending, bookConfirmed int64
	var collected int64

	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`).Scan(&usersTotal)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role='buyer'`).Scan(&buyers)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role='seller'`).Scan(&sellers)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role='company'`).Scan(&companies)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND kyc_status='blocked'`).Scan(&blocked)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND kyc_status='pending'`).Scan(&kycPending)

	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL`).Scan(&propsTotal)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL AND status='active'`).Scan(&active)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL AND status='frozen'`).Scan(&frozen)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL AND status='sold'`).Scan(&sold)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL AND status='rented'`).Scan(&rented)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL AND featured=TRUE`).Scan(&featured)

	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads`).Scan(&leadsTotal)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads WHERE contact_method='platform'`).Scan(&leadsPlat)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads WHERE contact_method='whatsapp'`).Scan(&leadsWA)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads WHERE created_at::date = CURRENT_DATE`).Scan(&leadsToday)

	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM commissions WHERE status IN ('pending','reminded')`).Scan(&cpending)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM commissions WHERE status='overdue'`).Scan(&coverdue)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM commissions WHERE status='paid'`).Scan(&cpaid)
	_ = s.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(commission_amount),0)::bigint FROM commissions WHERE status='paid'`).Scan(&collected)

	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings`).Scan(&bookedTotal)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings WHERE status='pending'`).Scan(&bookPending)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings WHERE status='confirmed'`).Scan(&bookConfirmed)

	bookingFeesCollected := int64(0)
	_ = s.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(platform_fee),0)::bigint FROM bookings WHERE payment_status='paid'
	`).Scan(&bookingFeesCollected)

	c.JSON(http.StatusOK, map[string]any{
		"users":       map[string]int64{"total": usersTotal, "buyers": buyers, "sellers": sellers, "companies": companies, "blocked": blocked, "kyc_pending": kycPending},
		"properties":  map[string]int64{"total": propsTotal, "active": active, "frozen": frozen, "sold": sold, "rented": rented, "featured": featured},
		"leads":       map[string]int64{"total": leadsTotal, "platform": leadsPlat, "whatsapp": leadsWA, "today": leadsToday},
		"commissions": map[string]int64{"pending": cpending, "overdue": coverdue, "paid": cpaid},
		"bookings":    map[string]int64{"total": bookedTotal, "pending": bookPending, "confirmed": bookConfirmed},
		"revenue":     map[string]int64{"commission_ugx": collected, "booking_fees_ugx": bookingFeesCollected},
		"current_settings": map[string]any{
			"commission_rate":            repo.SettingFloat(ctx, s.Pool, "commission_rate", 5),
			"commission_rate_company":    repo.SettingFloat(ctx, s.Pool, "commission_rate_company", 3),
			"commission_block_threshold": repo.SettingInt(ctx, s.Pool, "commission_block_threshold", 3),
			"commission_due_days":        repo.SettingInt(ctx, s.Pool, "commission_due_days", 14),
			"booking_fee_rate":           repo.SettingFloat(ctx, s.Pool, "booking_fee_rate", 7),
			"blue_badge_price_ugx":       repo.SettingInt(ctx, s.Pool, "blue_badge_price", 300000),
		},
	})
}

func (s *Server) adminUsers(c *gin.Context) {
	ctx := c.Request.Context()
	q := c.Request.URL.Query()

	where := []string{"deleted_at IS NULL"}
	args := []any{}
	idx := 1

	if role := strings.TrimSpace(q.Get("role")); role != "" {
		where = append(where, `role::text=$`+strconv.Itoa(idx))
		args = append(args, role)
		idx++
	}
	if ks := strings.TrimSpace(q.Get("kyc_status")); ks != "" {
		where = append(where, `kyc_status::text=$`+strconv.Itoa(idx))
		args = append(args, ks)
		idx++
	}
	if search := strings.TrimSpace(q.Get("search")); search != "" {
		pat := "%" + search + "%"
		where = append(where, `(name ILIKE $`+strconv.Itoa(idx)+` OR email ILIKE $`+strconv.Itoa(idx)+` OR phone ILIKE $`+strconv.Itoa(idx)+`)`)
		args = append(args, pat)
		idx++
	}

	page := parsePageReq(c.Request)
	perPage := 30
	offset := (page - 1) * perPage

	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE `+whereSQL, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not list users.")
		return
	}

	args2 := append(append([]any{}, args...), perPage, offset)
	limitIdx := strconv.Itoa(idx)
	offsetIdx := strconv.Itoa(idx + 1)

	sql := `
		SELECT u.id::text, u.name, u.email, u.phone, u.role::text, u.kyc_status::text, u.created_at,
		       (SELECT COUNT(*) FROM properties p WHERE p.seller_id=u.id AND p.deleted_at IS NULL) AS properties_count,
		       (SELECT COUNT(*) FROM leads l WHERE l.seller_id=u.id) AS leads_count,
		       (SELECT COUNT(*) FROM commissions c WHERE c.seller_id=u.id) AS commissions_count
		FROM users u
		WHERE ` + whereSQL + `
		ORDER BY u.created_at DESC
		LIMIT $` + limitIdx + ` OFFSET $` + offsetIdx

	rows, err := s.Pool.Query(ctx, sql, args2...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not list users.")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, name, email, phone, role, kyc string
		var created time.Time
		var pc, lc, cc int64
		if err := rows.Scan(&id, &name, &email, &phone, &role, &kyc, &created, &pc, &lc, &cc); err != nil {
			break
		}
		items = append(items, map[string]any{
			"id": id, "name": name, "email": email, "phone": phone,
			"role": role, "kyc_status": kyc, "created_at": created.UTC().Format(time.RFC3339Nano),
			"properties_count": pc, "leads_as_seller_count": lc, "commissions_count": cc,
		})
	}

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, items))
}

func (s *Server) adminUser(c *gin.Context) {
	uid, err := uuid.Parse(c.Param("user"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	u, err := repo.GetUser(c.Request.Context(), s.Pool, uid)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	avg, reviews := ratingStats(c.Request.Context(), s.Pool, uid)

	var pendCom int64
	_ = s.Pool.QueryRow(c.Request.Context(), `
		SELECT COUNT(*) FROM commissions WHERE seller_id=$1 AND status IN ('pending','reminded','overdue')
	`, uid).Scan(&pendCom)

	c.JSON(http.StatusOK, map[string]any{
		"user":                userPayload(c.Request.Context(), s.Pool, *u),
		"average_rating":      avg,
		"total_reviews":       reviews,
		"pending_commissions": pendCom,
	})
}
