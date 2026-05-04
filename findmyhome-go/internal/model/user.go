package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                     uuid.UUID
	Name                   string
	Email                  string
	Phone                  string
	PasswordHash           string
	Role                   string
	KycStatus              string
	BlueBadge              bool
	BlueBadgeExpiresAt     *time.Time
	FCMToken               *string
	CompanyName            *string
	RegistrationNumber     *string
	SellerCategories       []byte // raw json [] from DB (nullable)
	BookingEnabled         bool
	FreeFeaturedSlots      int
	CommissionRateOverride *float64
	GoogleID               *string
	Avatar                 *string
	TermsAgreedAt          *time.Time
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

func (u User) SellerCategoriesSlice() ([]string, error) {
	if u.SellerCategories == nil || len(u.SellerCategories) == 0 {
		return []string{}, nil
	}
	var out []string
	if err := json.Unmarshal(u.SellerCategories, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func HasBlueBadge(u User, now time.Time) bool {
	if !u.BlueBadge {
		return false
	}
	if u.BlueBadgeExpiresAt == nil {
		return true
	}
	return u.BlueBadgeExpiresAt.After(now)
}
