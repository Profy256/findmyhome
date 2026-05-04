package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"findmyhome/backend/internal/auth"
	"findmyhome/backend/internal/config"
	"findmyhome/backend/internal/repo"
)

type Server struct {
	Cfg  config.Config
	Pool *pgxpool.Pool
}

func (s *Server) verifiedSeller() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := UserFromContext(c.Request.Context())
		if !ok || u == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthenticated."})
			c.Abort()
			return
		}
		switch u.Role {
		case "seller", "company", "admin":
		default:
			c.JSON(http.StatusForbidden, gin.H{"message": "Only seller or company accounts can perform this action."})
			c.Abort()
			return
		}
		if u.KycStatus != "verified" && u.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"message":    "Your identity must be verified before you can list properties.",
				"kyc_status": u.KycStatus,
				"action":     "Please complete KYC verification in your dashboard.",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func (s *Server) sellerActive() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := UserFromContext(c.Request.Context())
		if !ok || u == nil {
			c.Next()
			return
		}
		if u.KycStatus != "blocked" {
			c.Next()
			return
		}
		var unpaid int64
		_ = s.Pool.QueryRow(c.Request.Context(), `
			SELECT COALESCE(SUM(commission_amount), 0)::bigint
			FROM commissions
			WHERE seller_id = $1 AND status IN ('pending','reminded','overdue') AND due_date < CURRENT_DATE
		`, u.ID).Scan(&unpaid)
		c.JSON(http.StatusForbidden, gin.H{
			"message":       "Your account is suspended due to unpaid commissions.",
			"unpaid_amount": unpaid,
			"action":        "Please pay your outstanding commissions to restore your account.",
			"pay_url":       "/dashboard/commissions",
		})
		c.Abort()
	}
}

func (s *Server) adminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := UserFromContext(c.Request.Context())
		if !ok || u == nil || u.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"message": "Admin access required."})
			c.Abort()
			return
		}
		c.Next()
	}
}

func (s *Server) bearerAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		hdr := c.GetHeader("Authorization")
		if !strings.HasPrefix(strings.ToLower(hdr), "bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthenticated. Please log in."})
			c.Abort()
			return
		}
		token := strings.TrimSpace(hdr[len("Bearer "):])
		uid, err := auth.ResolveUser(c.Request.Context(), s.Pool, token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthenticated. Please log in."})
			c.Abort()
			return
		}
		u, err := repo.GetUser(c.Request.Context(), s.Pool, uid)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthenticated. Please log in."})
			c.Abort()
			return
		}
		c.Request = c.Request.WithContext(WithUser(c.Request.Context(), u))
		c.Next()
	}
}
