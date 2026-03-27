<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// ── USER RESOURCE ─────────────────────────────────────────────────────────────
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'company_name'    => $this->company_name,
            'display_name'    => $this->company_name ?? $this->name,
            'email'           => $this->when($request->user()?->id === $this->id || $request->user()?->isAdmin(), $this->email),
            'phone'           => $this->when($request->user()?->id === $this->id || $request->user()?->isAdmin(), $this->phone),
            'role'            => $this->role,
            'kyc_status'      => $this->kyc_status,
            'is_verified'     => $this->isVerified(),
            'is_blocked'      => $this->isBlocked(),
            'blue_badge'      => $this->hasBlueBadge(),
            'blue_badge_expires_at' => $this->blue_badge_expires_at,
            'booking_enabled' => $this->booking_enabled,
            'average_rating'  => $this->averageRating(),
            'total_reviews'   => $this->totalReviews(),
            'trust_label'     => $this->role === 'company' ? 'Registered Business ✔' : 'Identity Verified ✔',
            'free_featured_slots' => $this->when($request->user()?->id === $this->id, $this->free_featured_slots),
            'member_since'    => $this->created_at?->format('M Y'),
        ];
    }
}

// ── PROPERTY RESOURCE ─────────────────────────────────────────────────────────
class PropertyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'title'           => $this->title,
            'description'     => $this->description,
            'price'           => $this->price,
            'price_formatted' => 'UGX ' . number_format($this->price),
            'location'        => $this->location,
            'district'        => $this->district,
            'property_type'   => $this->property_type,
            'listing_type'    => $this->listing_type,
            'bedrooms'        => $this->bedrooms,
            'bathrooms'       => $this->bathrooms,
            'size'            => $this->size,
            'photos'          => $this->photos ?? [],
            'status'          => $this->status,
            'featured'        => $this->featured,
            'trust_label'     => $this->trustLabel(),

            // Land title — only shown if it exists
            'has_land_title'   => !empty($this->land_title_url),
            'land_title_verified' => $this->land_title_verified,
            'has_map_location' => $this->hasMapLocation(),
            'google_maps_url'  => $this->googleMapsUrl(),
            'land_title_lat'   => $this->land_title_lat,
            'land_title_lng'   => $this->land_title_lng,

            // Seller info (always included)
            'seller'          => $this->whenLoaded('seller', fn() => new UserResource($this->seller)),
            'seller_id'       => $this->seller_id,

            // Stats
            'leads_count'     => $this->whenCounted('leads'),
            'bookings_count'  => $this->whenCounted('bookings'),

            'created_at'      => $this->created_at,
            'updated_at'      => $this->updated_at,
        ];
    }
}

// ── RATING RESOURCE ───────────────────────────────────────────────────────────
class RatingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'stars'      => $this->stars,
            'review'     => $this->review,
            'buyer'      => $this->whenLoaded('buyer', fn() => [
                'id'   => $this->buyer->id,
                'name' => $this->buyer->name,
            ]),
            'property'   => $this->whenLoaded('property', fn() => [
                'id'    => $this->property?->id,
                'title' => $this->property?->title,
            ]),
            'created_at' => $this->created_at?->diffForHumans(),
            'created_at_full' => $this->created_at?->format('d M Y'),
        ];
    }
}

// ── LEAD RESOURCE ─────────────────────────────────────────────────────────────
class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'contact_method' => $this->contact_method,
            'seller_notified'=> $this->seller_notified,
            'buyer'          => $this->whenLoaded('buyer', fn() => [
                'id'    => $this->buyer->id,
                'name'  => $this->buyer->name,
                'phone' => $this->buyer->phone,
            ]),
            'property'       => $this->whenLoaded('property', fn() => [
                'id'       => $this->property->id,
                'title'    => $this->property->title,
                'location' => $this->property->location,
                'price'    => number_format($this->property->price),
            ]),
            'created_at'     => $this->created_at,
            'time_ago'       => $this->created_at?->diffForHumans(),
        ];
    }
}

// ── BOOKING RESOURCE ──────────────────────────────────────────────────────────
class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'checkin_date'      => $this->checkin_date?->format('d M Y'),
            'checkout_date'     => $this->checkout_date?->format('d M Y'),
            'nights'            => $this->nights(),
            'guests'            => $this->guests,
            'total_price'       => $this->total_price,
            'total_formatted'   => 'UGX ' . number_format($this->total_price),
            'platform_fee'      => $this->platform_fee,
            'status'            => $this->status,
            'payment_status'    => $this->payment_status,
            'buyer'             => $this->whenLoaded('buyer', fn() => new UserResource($this->buyer)),
            'property'          => $this->whenLoaded('property', fn() => new PropertyResource($this->property)),
            'created_at'        => $this->created_at,
        ];
    }
}

// ── COMMISSION RESOURCE ───────────────────────────────────────────────────────
class CommissionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'commission_amount' => $this->commission_amount,
            'amount_formatted'  => 'UGX ' . number_format($this->commission_amount),
            'property_price'    => $this->property_price,
            'status'            => $this->status,
            'reminder_count'    => $this->reminder_count,
            'due_date'          => $this->due_date?->format('d M Y'),
            'is_overdue'        => $this->isOverdue(),
            'days_overdue'      => $this->due_date?->isPast()
                ? (int) $this->due_date->diffInDays(now())
                : 0,
            'paid_at'           => $this->paid_at,
            'seller'            => $this->whenLoaded('seller', fn() => new UserResource($this->seller)),
            'property'          => $this->whenLoaded('transaction.property', fn() => [
                'title'    => $this->transaction->property->title,
                'location' => $this->transaction->property->location,
            ]),
            'created_at'        => $this->created_at,
        ];
    }
}

// ── KYC DOCUMENT RESOURCE ─────────────────────────────────────────────────────
class KycDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                   => $this->id,
            'document_type'        => $this->document_type,
            'status'               => $this->status,
            'rejection_reason'     => $this->rejection_reason,
            'review_note'          => $this->when($request->user()?->isAdmin(), $this->review_note),
            'ai_confidence_score'  => $this->when($request->user()?->isAdmin(), $this->ai_confidence_score),
            'ai_checks'            => $this->when($request->user()?->isAdmin(), $this->ai_checks),
            'reviewed_at'          => $this->reviewed_at,
            'created_at'           => $this->created_at,
            // File URL only shown to the owner and admin
            'file_url'             => $this->when(
                $request->user()?->id === $this->user_id || $request->user()?->isAdmin(),
                $this->file_url
            ),
        ];
    }
}

// ── TRANSACTION RESOURCE ──────────────────────────────────────────────────────
class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                   => $this->id,
            'agreed_price'         => $this->agreed_price,
            'price_formatted'      => 'UGX ' . number_format($this->agreed_price),
            'buyer_confirmed'      => $this->buyer_confirmed,
            'seller_confirmed'     => $this->seller_confirmed,
            'is_complete'          => $this->isComplete(),
            'buyer_confirmed_at'   => $this->buyer_confirmed_at,
            'seller_confirmed_at'  => $this->seller_confirmed_at,
            'completed_at'         => $this->completed_at,
            'buyer'                => $this->whenLoaded('buyer', fn() => new UserResource($this->buyer)),
            'seller'               => $this->whenLoaded('seller', fn() => new UserResource($this->seller)),
            'property'             => $this->whenLoaded('property', fn() => new PropertyResource($this->property)),
            'commission'           => $this->whenLoaded('commission', fn() => new CommissionResource($this->commission)),
            'created_at'           => $this->created_at,
        ];
    }
}
