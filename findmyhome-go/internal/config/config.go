package config

import (
	"os"
	"strings"
)

type Config struct {
	HTTPAddr string

	DBURL string

	// Pesapal optional — mirrors Laravel services.pesapal
	PesapalConsumerKey    string
	PesapalConsumerSecret string
	PesapalEnv            string // sandbox | production

	FrontendURL string
	// Absolute base URL clients/Pesapal can call back (scheme + host + optional port).
	PublicAPIURL string
}

func Load() Config {
	addr := getenv("ADDR", ":8000")

	pub := getenv("PUBLIC_API_URL", "http://localhost:8000")
	return Config{
		HTTPAddr:              addr,
		DBURL:                 getenv("DATABASE_URL", getenv("DATABASE_DSN", "postgres://postgres:password@localhost:5432/findmyhome?sslmode=disable")),
		PesapalConsumerKey:    getenv("PESAPAL_CONSUMER_KEY", ""),
		PesapalConsumerSecret: getenv("PESAPAL_CONSUMER_SECRET", ""),
		PesapalEnv:            getenv("PESAPAL_ENV", "sandbox"),
		FrontendURL:           getenv("FRONTEND_URL", "http://localhost:3000"),
		PublicAPIURL:          strings.TrimRight(pub, "/"),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
