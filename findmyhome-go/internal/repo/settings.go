package repo

import (
	"context"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func SettingFloat(ctx context.Context, pool *pgxpool.Pool, key string, def float64) float64 {
	var val string
	err := pool.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&val)
	if err != nil {
		return def
	}
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return def
	}
	return f
}

func SettingInt(ctx context.Context, pool *pgxpool.Pool, key string, def int) int {
	var val string
	err := pool.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&val)
	if err != nil {
		return def
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return def
	}
	return n
}

func SettingUpdate(ctx context.Context, pool *pgxpool.Pool, key, value string) error {
	tag, err := pool.Exec(ctx, `UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`, key, value)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
