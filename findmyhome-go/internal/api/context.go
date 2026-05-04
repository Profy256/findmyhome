package api

import (
	"context"

	"github.com/google/uuid"

	"findmyhome/backend/internal/model"
)

type ctxKey int

const userKey ctxKey = 1

func WithUser(ctx context.Context, u *model.User) context.Context {
	return context.WithValue(ctx, userKey, u)
}

func UserFromContext(ctx context.Context) (*model.User, bool) {
	u, ok := ctx.Value(userKey).(*model.User)
	return u, ok
}

func MustUserID(ctx context.Context) uuid.UUID {
	u, _ := UserFromContext(ctx)
	return u.ID
}
