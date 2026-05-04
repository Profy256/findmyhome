package repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"findmyhome/backend/internal/model"
)

func GetUser(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (*model.User, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, name, email, phone, password, role::text, kyc_status::text,
		       blue_badge, blue_badge_expires_at, fcm_token, company_name, registration_number,
		       seller_categories, booking_enabled, free_featured_slots,
		       commission_rate_override, google_id, avatar,
		       terms_agreed_at, created_at, updated_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, id)
	return scanUser(row)
}

func GetUserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (*model.User, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, name, email, phone, password, role::text, kyc_status::text,
		       blue_badge, blue_badge_expires_at, fcm_token, company_name, registration_number,
		       seller_categories, booking_enabled, free_featured_slots,
		       commission_rate_override, google_id, avatar,
		       terms_agreed_at, created_at, updated_at
		FROM users
		WHERE lower(email) = lower($1) AND deleted_at IS NULL
	`, email)
	return scanUser(row)
}

func scanUser(row pgxRow) (*model.User, error) {
	var u model.User
	var sellerCat []byte

	err := row.Scan(
		&u.ID,
		&u.Name,
		&u.Email,
		&u.Phone,
		&u.PasswordHash,
		&u.Role,
		&u.KycStatus,
		&u.BlueBadge,
		&u.BlueBadgeExpiresAt,
		&u.FCMToken,
		&u.CompanyName,
		&u.RegistrationNumber,
		&sellerCat,
		&u.BookingEnabled,
		&u.FreeFeaturedSlots,
		&u.CommissionRateOverride,
		&u.GoogleID,
		&u.Avatar,
		&u.TermsAgreedAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	u.SellerCategories = sellerCat
	return &u, nil
}

type pgxRow interface {
	Scan(dest ...any) error
}
