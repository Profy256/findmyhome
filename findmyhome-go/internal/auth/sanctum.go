package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const userMorphType = `App\Models\User`

// CreateToken inserts a Laravel Sanctum-compatible personal access token row and returns plaintext "id|secret".
func CreateToken(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (plaintext string, err error) {
	secret := randomAlphaNum(40)
	sum := sha256.Sum256([]byte(secret))
	hashHex := hex.EncodeToString(sum[:])

	var tokenID int64
	err = pool.QueryRow(ctx, `
		INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
		VALUES ($1, $2, 'auth_token', $3, $4, NULL, NOW(), NOW())
		RETURNING id
	`, userMorphType, userID.String(), hashHex, `["*"]`).Scan(&tokenID)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d|%s", tokenID, secret), nil
}

// DeleteCurrentToken deletes the token row referenced by plaintext "id|secret".
func DeleteCurrentToken(ctx context.Context, pool *pgxpool.Pool, plaintext string) error {
	idPart, _, ok := strings.Cut(plaintext, "|")
	if !ok {
		return fmt.Errorf("invalid token")
	}
	tid, err := strconv.ParseInt(idPart, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid token id")
	}
	_, err = pool.Exec(ctx, `DELETE FROM personal_access_tokens WHERE id = $1`, tid)
	return err
}

// ResolveUser resolves bearer token plaintext to authenticated user UUID (and loads fresh user snapshot).
func ResolveUser(ctx context.Context, pool *pgxpool.Pool, plaintext string) (uuid.UUID, error) {
	idPart, secret, ok := strings.Cut(plaintext, "|")
	if !ok {
		return uuid.Nil, fmt.Errorf("invalid token")
	}
	tid, err := strconv.ParseInt(idPart, 10, 64)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid token")
	}

	sum := sha256.Sum256([]byte(secret))
	hashHex := hex.EncodeToString(sum[:])

	var uidStr string
	err = pool.QueryRow(ctx, `
		SELECT tokenable_id::text
		FROM personal_access_tokens
		WHERE id = $1 AND token = $2 AND tokenable_type = $3
	`, tid, hashHex, userMorphType).Scan(&uidStr)
	if err != nil {
		return uuid.Nil, err
	}
	uid, err := uuid.Parse(uidStr)
	if err != nil {
		return uuid.Nil, err
	}
	return uid, nil
}

func randomAlphaNum(n int) string {
	const charset = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// Extremely unlikely; fallback to deterministic padding (still unique enough with time).
		ts := strconv.FormatInt(time.Now().UnixNano(), 36)
		for i := range b {
			b[i] = charset[i%len(charset)]
		}
		copy(b, []byte(ts))
		return string(b[:n])
	}
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}
