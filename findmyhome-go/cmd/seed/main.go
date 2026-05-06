package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"findmyhome/backend/internal/config"
	"findmyhome/backend/internal/db"
)

func main() {
	email := strings.TrimSpace(strings.ToLower(os.Getenv("SEED_ADMIN_EMAIL")))
	password := os.Getenv("SEED_ADMIN_PASSWORD")

	if email == "" || password == "" {
		slog.Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set")
		os.Exit(1)
	}
	if len(password) < 8 {
		slog.Error("SEED_ADMIN_PASSWORD must be at least 8 characters")
		os.Exit(1)
	}

	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg)
	if err != nil {
		slog.Error("database", slog.Any("err", err))
		os.Exit(1)
	}
	defer pool.Close()

	if err := seedAdmin(ctx, pool, email, password); err != nil {
		slog.Error("seed failed", slog.Any("err", err))
		os.Exit(1)
	}
}

func seedAdmin(ctx context.Context, pool *pgxpool.Pool, email, password string) error {
	var exists bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE lower(email)=$1 AND deleted_at IS NULL)`,
		email,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check existing user: %w", err)
	}
	if exists {
		// Ensure the existing account has admin role.
		tag, err := pool.Exec(ctx,
			`UPDATE users SET role='admin', updated_at=NOW() WHERE lower(email)=$1 AND deleted_at IS NULL AND role::text <> 'admin'`,
			email,
		)
		if err != nil {
			return fmt.Errorf("promote to admin: %w", err)
		}
		if tag.RowsAffected() > 0 {
			slog.Info("existing account promoted to admin", slog.String("email", email))
		} else {
			slog.Info("admin account already exists, no changes made", slog.String("email", email))
		}
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO users (name, email, phone, password, role, kyc_status, terms_agreed_at, created_at, updated_at)
		VALUES ('Admin', $1, '0000000000', $2, 'admin', 'verified', NOW(), NOW(), NOW())
	`, email, string(hash))
	if err != nil {
		return fmt.Errorf("insert admin: %w", err)
	}

	slog.Info("admin account created", slog.String("email", email))
	return nil
}
