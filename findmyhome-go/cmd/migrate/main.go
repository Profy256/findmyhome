package main

import (
	"context"
	"log/slog"
	"os"

	dbschema "findmyhome/backend/db"
	"findmyhome/backend/internal/config"
	"findmyhome/backend/internal/db"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg)
	if err != nil {
		slog.Error("database", slog.Any("err", err))
		os.Exit(1)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, dbschema.SQL); err != nil {
		slog.Error("migrate", slog.Any("err", err))
		os.Exit(1)
	}

	slog.Info("schema applied successfully")
}
