<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasUuids, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'phone', 'password',
        'role', 'kyc_status', 'blue_badge',
        'blue_badge_expires_at', 'fcm_token',
        'company_name', 'registration_number', 'seller_categories',
        'booking_enabled', 'free_featured_slots',
        'commission_rate_override',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at'       => 'datetime',
        'blue_badge_expires_at'   => 'datetime',
        'blue_badge'              => 'boolean',
        'seller_categories'       => 'array',
        'booking_enabled'         => 'boolean',
        'free_featured_slots'     => 'integer',
        'commission_rate_override'=> 'float',
        'password'                => 'hashed',
    ];

    // ── Relationships ────────────────────────────────────────────────────────

    public function kycDocuments()
    {
        return $this->hasMany(KycDocument::class);
    }

    public function properties()
    {
        return $this->hasMany(Property::class, 'seller_id');
    }

    public function leadsAsBuyer()
    {
        return $this->hasMany(Lead::class, 'buyer_id');
    }

    public function leadsAsSeller()
    {
        return $this->hasMany(Lead::class, 'seller_id');
    }

    /**
     * Ratings this seller has received from buyers.
     * Buyers rate sellers — this is the seller's public review profile.
     */
    public function ratingsReceived()
    {
        return $this->hasMany(Rating::class, 'seller_id');
    }

    /**
     * Ratings this buyer has given to sellers.
     */
    public function ratingsGiven()
    {
        return $this->hasMany(Rating::class, 'buyer_id');
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class, 'buyer_id');
    }

    public function commissions()
    {
        return $this->hasMany(Commission::class, 'seller_id');
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'seller_id');
    }

    // ── Role helpers ─────────────────────────────────────────────────────────

    public function isVerified(): bool
    {
        return $this->kyc_status === 'verified';
    }

    public function isSeller(): bool
    {
        return in_array($this->role, ['seller', 'company']);
    }

    public function isCompany(): bool
    {
        return $this->role === 'company';
    }

    public function isBuyer(): bool
    {
        return $this->role === 'buyer';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isBlocked(): bool
    {
        return $this->kyc_status === 'blocked';
    }

    /**
     * Check if this seller is registered for a given property category.
     * Companies can list any category. Admins can list any category.
     */
    public function canListCategory(string $propertyType): bool
    {
        if (in_array($this->role, ['admin', 'company'])) return true;
        $categories = $this->seller_categories ?? [];
        return \App\Services\SellerCategoryService::canListType($categories, $propertyType, $this->role);
    }

    // ── Badge helpers ────────────────────────────────────────────────────────

    public function hasBlueBadge(): bool
    {
        return $this->blue_badge &&
               ($this->blue_badge_expires_at === null ||
                $this->blue_badge_expires_at->isFuture());
    }

    // ── Rating helpers ───────────────────────────────────────────────────────

    /**
     * Average star rating received from buyers.
     * Only visible reviews are counted.
     */
    public function averageRating(): float
    {
        return round(
            $this->ratingsReceived()->where('is_visible', true)->avg('stars') ?? 0,
            1
        );
    }

    /**
     * Total number of public reviews this seller has received.
     */
    public function totalReviews(): int
    {
        return $this->ratingsReceived()->where('is_visible', true)->count();
    }

    // ── Commission helpers ───────────────────────────────────────────────────

    public function pendingCommissions(): int
    {
        return $this->commissions()
            ->whereIn('status', ['pending', 'reminded', 'overdue'])
            ->count();
    }

    public function hasUnpaidCommissions(): bool
    {
        return $this->commissions()
            ->whereIn('status', ['pending', 'reminded', 'overdue'])
            ->where('due_date', '<', now())
            ->exists();
    }

    /**
     * Get this seller's effective commission rate.
     * Companies may have an override rate set on verification.
     * Falls back to the platform default rate.
     */
    public function effectiveCommissionRate(): float
    {
        if ($this->commission_rate_override !== null) {
            return $this->commission_rate_override;
        }

        return $this->isCompany()
            ? Setting::get('commission_rate_company', 3.0)
            : Setting::get('commission_rate', 5.0);
    }
}
