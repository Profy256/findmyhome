<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Builder;

class Property extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'seller_id', 'title', 'description', 'price',
        'location', 'district', 'property_type', 'listing_type',
        'bedrooms', 'bathrooms', 'size', 'photos', 'status',
        'featured', 'featured_until',
        'land_title_url', 'land_title_cloudinary_id',
        'land_title_lat', 'land_title_lng', 'land_title_verified',
    ];

    protected $casts = [
        'photos'              => 'array',
        'amenities'           => 'array',
        'featured'            => 'boolean',
        'land_title_verified' => 'boolean',
        'land_title_lat'      => 'decimal:7',
        'land_title_lng'      => 'decimal:7',
        'featured_until'      => 'datetime',
        'price'               => 'integer',
    ];

    // ── Relationships ────────────────────────────────────────────────────────

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    // ── Land Title Rules ─────────────────────────────────────────────────────

    /**
     * Individuals MUST upload a land title to list land.
     * Companies are exempt — their business registration is sufficient proof.
     */
    public function requiresLandTitle(): bool
    {
        return \App\Services\SellerCategoryService::requiresLandTitle(
            $this->property_type,
            $this->seller->role
        );
    }

    public function passesLandTitleCheck(): bool
    {
        if (!$this->requiresLandTitle()) return true;
        return !empty($this->land_title_url);
    }

    /**
     * Coordinates can be added by anyone who has a title,
     * but are not mandatory for companies since title upload itself is not required.
     */
    public function hasMapLocation(): bool
    {
        return $this->land_title_lat !== null && $this->land_title_lng !== null;
    }

    public function googleMapsUrl(): ?string
    {
        if (!$this->hasMapLocation()) return null;
        return "https://maps.google.com/?q={$this->land_title_lat},{$this->land_title_lng}";
    }

    // ── Trust Level ──────────────────────────────────────────────────────────

    /**
     * Returns a trust label shown on the listing to buyers.
     *
     * Company:    "Registered Business ✔"
     * Individual: "Identity Verified ✔" (only if KYC passed)
     * Individual land with title: "Land Title Uploaded ✔"
     */
    public function trustLabel(): string
    {
        $seller = $this->seller;

        if ($seller->role === 'company') {
            return 'Registered Business ✔';
        }

        if ($this->property_type === 'land' && $this->land_title_url) {
            return 'Land Title Uploaded ✔';
        }

        return 'Identity Verified ✔';
    }

    /**
     * Icon/emoji for the property type shown in UI.
     */
    public function typeEmoji(): string
    {
        return match($this->property_type) {
            'land'       => '🌿',
            'apartment'  => '🏢',
            'rental'     => '🏠',
            'house'      => '🏡',
            'airbnb'     => '🏖️',
            'lodge'      => '🏨',
            'commercial' => '🏗️',
            default      => '🏠',
        };
    }

    /**
     * Human-readable label for the property type.
     */
    public function typeLabel(): string
    {
        return match($this->property_type) {
            'land'       => 'Land',
            'apartment'  => 'Apartments',
            'rental'     => 'Rentals',
            'house'      => 'Houses',
            'airbnb'     => 'Airbnb',
            'lodge'      => 'Lodges',
            'commercial' => 'Commercial',
            default      => ucfirst($this->property_type),
        };
    }

    // ── Search Scopes ────────────────────────────────────────────────────────

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeByLocation(Builder $query, ?string $location): Builder
    {
        if (!$location) return $query;
        return $query->where(function ($q) use ($location) {
            $q->where('location', 'ilike', "%{$location}%")
              ->orWhere('district', 'ilike', "%{$location}%");
        });
    }

    public function scopeByType(Builder $query, ?string $type): Builder
    {
        if (!$type) return $query;
        return $query->where('property_type', $type);
    }

    public function scopeByListing(Builder $query, ?string $listing): Builder
    {
        if (!$listing) return $query;
        return $query->where('listing_type', $listing);
    }

    public function scopeByPriceRange(Builder $query, ?int $min, ?int $max): Builder
    {
        if ($min) $query->where('price', '>=', $min);
        if ($max) $query->where('price', '<=', $max);
        return $query;
    }

    public function scopeByMaxPrice(Builder $query, ?int $max): Builder
    {
        if (!$max) return $query;
        return $query->where('price', '<=', $max);
    }

    public function scopeByBedrooms(Builder $query, ?int $min): Builder
    {
        if (!$min) return $query;
        return $query->where('bedrooms', '>=', $min);
    }

    public function scopeCompaniesFirst(Builder $query): Builder
    {
        // Company listings rank above individual sellers
        // Within each tier: blue badge first, then featured, then newest
        return $query->join('users', 'properties.seller_id', '=', 'users.id')
            ->orderByRaw("CASE WHEN users.role = 'company' THEN 0 ELSE 1 END")
            ->orderByDesc('users.blue_badge')
            ->orderByDesc('properties.featured')
            ->orderByDesc('properties.created_at')
            ->select('properties.*');
    }

    public function markAsSold(): void
    {
        $this->update(['status' => 'sold']);
    }

    public function markAsRented(): void
    {
        $this->update(['status' => 'rented']);
    }
}
