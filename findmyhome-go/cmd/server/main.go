package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gin-gonic/gin"

	"findmyhome/backend/internal/api"
	"findmyhome/backend/internal/config"
	"findmyhome/backend/internal/db"
	dbschema "findmyhome/backend/db"
)

func main() {
	cfg := config.Load()

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

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
	slog.Info("schema ready")

	srv := api.Server{
		Cfg:  cfg,
		Pool: pool,
	}

	httpServer := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           srv.Engine(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("listening", slog.String("addr", cfg.HTTPAddr))
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http server", slog.Any("err", err))
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown", slog.Any("err", err))
	}
}
