package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) corsMiddleware() gin.HandlerFunc {
	// Build a set of allowed origins from comma-separated FRONTEND_URL and ADMIN_URL.
	// Entries without a scheme get https:// prepended automatically.
	allowedOrigins := map[string]bool{}
	for _, raw := range strings.Split(s.Cfg.FrontendURL+","+s.Cfg.AdminURL, ",") {
		o := strings.TrimSpace(raw)
		if o == "" {
			continue
		}
		if !strings.HasPrefix(o, "http://") && !strings.HasPrefix(o, "https://") {
			o = "https://" + o
		}
		allowedOrigins[strings.ToLower(o)] = true
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		allowed := false
		if origin != "" {
			switch {
			case allowedOrigins[strings.ToLower(origin)],
				strings.HasPrefix(origin, "http://localhost"),
				strings.HasPrefix(origin, "http://127.0.0.1"):
				allowed = true
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func (s *Server) Engine() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(s.corsMiddleware())

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "Find My Home API",
			"version": "1.0.0",
		})
	})

	v1 := r.Group("/api/v1")

	v1.POST("/auth/register", s.register)
	v1.POST("/auth/login", s.login)
	v1.GET("/auth/categories", s.categories)
	v1.POST("/forgot-password", s.forgotPassword)
	v1.POST("/reset-password", s.resetPassword)

	v1.GET("/properties", s.propertiesIndex)
	v1.GET("/properties/:property", s.propertyShow)
	v1.GET("/sellers/:seller/reviews", s.sellerReviews)

	authed := v1.Group("")
	authed.Use(s.bearerAuth())

	authed.POST("/auth/logout", s.logout)
	authed.GET("/auth/me", s.me)
	authed.POST("/auth/fcm-token", s.updateFCM)
	authed.PATCH("/auth/profile", s.updateProfile)

	authed.GET("/kyc", s.kycStatus)
	authed.POST("/kyc/upload", s.kycUpload)
	authed.GET("/kyc/documents", s.kycDocuments)

	writeGrp := authed.Group("")
	writeGrp.Use(s.verifiedSeller(), s.sellerActive())
	{
		writeGrp.POST("/properties", s.propertyStore)
		writeGrp.PUT("/properties/:property", s.propertyUpdate)
		writeGrp.DELETE("/properties/:property", s.propertyDestroy)
	}

	authedGrp := authed.Group("")
	authedGrp.Use(s.verifiedSeller())
	{
		authedGrp.GET("/my-listings", s.myListings)
		authedGrp.GET("/my-leads", s.myLeads)
	}

	authed.POST("/properties/:property/enquire", s.enquireLead)
	authed.POST("/properties/:property/whatsapp", s.whatsappLead)

	authed.POST("/sellers/:seller/rate", s.rateSeller)
	authed.PUT("/ratings/:rating", s.updateRating)
	authed.GET("/sellers/:seller/can-rate", s.canRate)

	authed.POST("/properties/:property/book", s.bookingStore)
	authed.PATCH("/bookings/:booking/status", s.bookingUpdateStatus)
	authed.GET("/my-bookings", s.myBookings)

	authed.POST("/transactions", s.transactionStore)
	authed.POST("/transactions/:transaction/confirm", s.transactionConfirm)
	authed.GET("/my-transactions", s.myTransactions)

	notifs := authed.Group("/notifications")
	{
		notifs.GET("/", s.notificationsIndex)
		notifs.GET("/unread", s.notificationsUnread)
		notifs.POST("/mark-all-read", s.notificationsMarkAllRead)
		notifs.PATCH("/:id/read", s.notificationsMarkRead)
		notifs.DELETE("/:id", s.notificationsDelete)
	}

	admin := authed.Group("/admin")
	admin.Use(s.adminOnly())
	{
		admin.GET("/dashboard", s.adminDashboard)
		admin.GET("/users", s.adminUsers)
		admin.GET("/users/:user", s.adminUser)
		admin.POST("/users/:user/block", s.adminBlockUser)
		admin.POST("/users/:user/unblock", s.adminUnblockUser)
		admin.DELETE("/users/:user", s.adminDeleteUser)
		admin.PATCH("/users/:user/role", s.adminRole)

		admin.GET("/kyc", s.adminListKYC)
		admin.POST("/kyc/:document/approve", s.adminApproveKYC)
		admin.POST("/kyc/:document/reject", s.adminRejectKYC)
		admin.POST("/users/:user/revoke-kyc", s.adminRevokeKYC)

		admin.GET("/properties", s.adminListProperties)
		admin.POST("/properties/:property/freeze", s.adminFreezeProperty)
		admin.POST("/properties/:property/unfreeze", s.adminUnfreezeProperty)
		admin.DELETE("/properties/:property", s.adminDeleteProperty)
		admin.POST("/properties/:property/feature", s.adminFeatureProperty)
		admin.POST("/properties/:property/unfeature", s.adminUnfeatureProperty)
		admin.POST("/properties/:property/verify-title", s.adminVerifyTitle)

		admin.GET("/commissions", s.adminListCommissions)
		admin.POST("/commissions/:commission/paid", s.adminMarkCommissionPaid)
		admin.POST("/commissions/:commission/waive", s.adminWaiveCommission)

		admin.POST("/users/:user/grant-badge", s.adminGrantBadge)
		admin.POST("/users/:user/revoke-badge", s.adminRevokeBadge)

		admin.GET("/bookings", s.adminBookings)
		admin.PATCH("/bookings/:booking/status", s.adminBookingStatus)
		admin.POST("/users/:user/booking-access", s.adminGrantBookingAccess)
		admin.DELETE("/users/:user/booking-access", s.adminRevokeBookingAccess)

		admin.GET("/ratings", s.adminRatings)
		admin.POST("/ratings/:rating/hide", s.adminHideRating)
		admin.POST("/ratings/:rating/restore", s.adminRestoreRating)
		admin.DELETE("/ratings/:rating", s.adminDeleteRating)

		admin.GET("/leads", s.adminLeads)

		admin.GET("/settings", s.adminSettingsGet)
		admin.PATCH("/settings/:key", s.adminSettingsPatch)
	}

	subAdmin := authed.Group("/sub-admin")
	subAdmin.Use(s.subAdminOnly())
	{
		subAdmin.GET("/dashboard", s.adminDashboard)
		subAdmin.GET("/users", s.adminUsers)
		subAdmin.GET("/users/:user", s.adminUser)
		subAdmin.GET("/kyc", s.adminListKYC)
		subAdmin.POST("/kyc/:document/approve", s.adminApproveKYC)
		subAdmin.GET("/properties", s.adminListProperties)
		subAdmin.GET("/commissions", s.adminListCommissions)
		subAdmin.GET("/bookings", s.adminBookings)
		subAdmin.GET("/ratings", s.adminRatings)
		subAdmin.GET("/leads", s.adminLeads)
		subAdmin.POST("/users/:user/grant-badge", s.adminGrantBadge)
	}

	r.POST("/api/payments/ipn", s.pesapalIPN)
	r.POST("/api/v1/payments/ipn", s.pesapalIPN)

	return r
}
