package config

import (
	"os"
	"strings"
)

type Config struct {
	// ── Server ────────────────────────────────────────────────────────────
	HTTPAddr     string
	AppEnv       string // production | development
	AppURL       string // https://findmyhome-api.onrender.com
	FrontendURL  string // Web app Vercel URL — used for CORS
	AdminURL     string // Admin panel Vercel URL — used for CORS
	PublicAPIURL string // Absolute base URL for IPN callbacks etc.

	// ── Database (Neon PostgreSQL) ─────────────────────────────────────────
	DBURL string

	// ── Cloudinary (property photos + KYC docs) ───────────────────────────
	CloudinaryURL        string
	CloudinaryCloudName  string
	CloudinaryAPIKey     string
	CloudinaryAPISecret  string

	// ── Resend (transactional email) ──────────────────────────────────────
	ResendKey       string
	MailFromAddress string
	MailFromName    string

	// ── Africa's Talking (SMS notifications) ─────────────────────────────
	ATUsername string
	ATAPIKey   string
	ATSenderID string

	// ── Google Vision API (KYC AI auto-verification) ─────────────────────
	GoogleVisionAPIKey  string
	FirebaseCredentials string // path to service-account JSON file
	FirebaseProjectID   string

	// ── Pesapal (payments) ────────────────────────────────────────────────
	PesapalConsumerKey    string
	PesapalConsumerSecret string
	PesapalEnv            string // sandbox | production
}

func Load() Config {
	addr := getenv("ADDR", ":8000")
	pub := getenv("PUBLIC_API_URL", getenv("APP_URL", "http://localhost:8000"))

	return Config{
		// Server
		HTTPAddr:     addr,
		AppEnv:       getenv("APP_ENV", "development"),
		AppURL:       strings.TrimRight(pub, "/"),
		FrontendURL:  getenv("FRONTEND_URL", "http://localhost:3000"),
		AdminURL:     getenv("ADMIN_URL", "http://localhost:3001"),
		PublicAPIURL: strings.TrimRight(pub, "/"),

		// Database
		DBURL: getenv("DATABASE_URL", "postgres://postgres:password@localhost:5432/findmyhome?sslmode=disable"),

		// Cloudinary
		CloudinaryURL:       getenv("CLOUDINARY_URL", ""),
		CloudinaryCloudName: getenv("CLOUDINARY_CLOUD_NAME", ""),
		CloudinaryAPIKey:    getenv("CLOUDINARY_API_KEY", ""),
		CloudinaryAPISecret: getenv("CLOUDINARY_API_SECRET", ""),

		// Resend / Email
		ResendKey:       getenv("RESEND_KEY", ""),
		MailFromAddress: getenv("MAIL_FROM_ADDRESS", "hello@findmyhome.com"),
		MailFromName:    getenv("MAIL_FROM_NAME", "Find My Home"),

		// Africa's Talking
		ATUsername: getenv("AT_USERNAME", ""),
		ATAPIKey:   getenv("AT_API_KEY", ""),
		ATSenderID: getenv("AT_SENDER_ID", "FindMyHome"),

		// Google Vision / Firebase
		GoogleVisionAPIKey:  getenv("GOOGLE_VISION_API_KEY", ""),
		FirebaseCredentials: getenv("FIREBASE_CREDENTIALS", "storage/app/firebase-credentials.json"),
		FirebaseProjectID:   getenv("FIREBASE_PROJECT_ID", ""),

		// Pesapal
		PesapalConsumerKey:    getenv("PESAPAL_CONSUMER_KEY", ""),
		PesapalConsumerSecret: getenv("PESAPAL_CONSUMER_SECRET", ""),
		PesapalEnv:            getenv("PESAPAL_ENV", "sandbox"),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
