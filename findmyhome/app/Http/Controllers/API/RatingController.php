<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\{Rating, User, Lead};
use Illuminate\Http\{Request, JsonResponse};

class RatingController extends Controller
{
    /**
     * Submit a rating for a seller.
     *
     * Rules:
     *  - Only buyers can rate
     *  - Must have contacted the seller through the platform first
     *  - One rating per buyer per seller
     *  - Written review is optional — stars alone is fine
     *  - Reviews are public — other buyers can read them
     */
    public function store(Request $request, User $seller): JsonResponse
    {
        $buyer = $request->user();

        // Only buyers can rate
        if ($buyer->role !== 'buyer') {
            return response()->json([
                'message' => 'Only buyers can leave ratings and reviews.',
            ], 403);
        }

        // Target must be a seller or company
        if (!$seller->isSeller()) {
            return response()->json([
                'message' => 'You can only rate sellers and companies.',
            ], 422);
        }

        // Must have had a genuine interaction — contact recorded via platform or WhatsApp
        $hasInteracted = Lead::where('buyer_id',  $buyer->id)
            ->where('seller_id', $seller->id)
            ->exists();

        if (!$hasInteracted) {
            return response()->json([
                'message' => 'You can only rate sellers you have contacted through Find My Home.',
                'reason'  => 'No contact found between you and this seller on our platform.',
            ], 403);
        }

        // One rating per buyer per seller — no duplicates
        $existing = Rating::where('buyer_id',  $buyer->id)
            ->where('seller_id', $seller->id)
            ->first();

        if ($existing) {
            return response()->json([
                'message'    => 'You have already rated this seller.',
                'your_rating'=> $existing,
                'tip'        => 'You can update your existing rating instead.',
            ], 422);
        }

        $data = $request->validate([
            'stars'       => 'required|integer|min:1|max:5',
            'review'      => 'nullable|string|max:1000',
            'property_id' => 'nullable|uuid|exists:properties,id',
        ]);

        $rating = Rating::create([
            'buyer_id'    => $buyer->id,
            'seller_id'   => $seller->id,
            'property_id' => $data['property_id'] ?? null,
            'stars'       => $data['stars'],
            'review'      => $data['review'] ?? null,
            'is_visible'  => true,
        ]);

        return response()->json([
            'message'        => 'Thank you for your review. It is now visible to other buyers.',
            'rating'         => $rating->load('buyer:id,name'),
            'seller_average' => $seller->fresh()->averageRating(),
            'seller_total'   => $seller->fresh()->totalReviews(),
        ], 201);
    }

    /**
     * Update the buyer's existing rating for a seller.
     */
    public function update(Request $request, Rating $rating): JsonResponse
    {
        // Only the buyer who wrote it can update it
        if ($rating->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'stars'  => 'required|integer|min:1|max:5',
            'review' => 'nullable|string|max:1000',
        ]);

        $rating->update($data);

        return response()->json([
            'message' => 'Your review has been updated.',
            'rating'  => $rating->fresh()->load('buyer:id,name'),
        ]);
    }

    /**
     * Get all public reviews for a seller.
     * This is what other buyers read on the seller profile page.
     */
    public function sellerReviews(User $seller): JsonResponse
    {
        $ratings = Rating::where('seller_id', $seller->id)
            ->where('is_visible', true)
            ->with('buyer:id,name', 'property:id,title,location')
            ->orderByDesc('created_at')
            ->paginate(10);

        return response()->json([
            'seller' => [
                'id'             => $seller->id,
                'name'           => $seller->company_name ?? $seller->name,
                'role'           => $seller->role,
                'blue_badge'     => $seller->hasBlueBadge(),
                'average_rating' => $seller->averageRating(),
                'total_reviews'  => $seller->totalReviews(),
                'breakdown'      => $this->starBreakdown($seller->id),
            ],
            'reviews' => $ratings,
        ]);
    }

    /**
     * Check if the authenticated buyer can rate a specific seller.
     * Called by the frontend to decide whether to show the "Leave a Review" button.
     */
    public function canRate(Request $request, User $seller): JsonResponse
    {
        $buyer = $request->user();

        if ($buyer->role !== 'buyer') {
            return response()->json(['can_rate' => false, 'reason' => 'Only buyers can leave ratings.']);
        }

        $hasInteracted = Lead::where('buyer_id',  $buyer->id)
            ->where('seller_id', $seller->id)
            ->exists();

        $alreadyRated = Rating::where('buyer_id',  $buyer->id)
            ->where('seller_id', $seller->id)
            ->exists();

        $existingRating = $alreadyRated
            ? Rating::where('buyer_id', $buyer->id)->where('seller_id', $seller->id)->first()
            : null;

        return response()->json([
            'can_rate'        => $hasInteracted && !$alreadyRated,
            'can_update'      => $alreadyRated,
            'has_interacted'  => $hasInteracted,
            'already_rated'   => $alreadyRated,
            'existing_rating' => $existingRating,
            'reason'          => !$hasInteracted
                ? 'You have not contacted this seller through Find My Home yet.'
                : ($alreadyRated ? 'You have already rated this seller.' : null),
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function starBreakdown(string $sellerId): array
    {
        $breakdown = [];
        $total = Rating::where('seller_id', $sellerId)->where('is_visible', true)->count();

        for ($i = 5; $i >= 1; $i--) {
            $count = Rating::where('seller_id', $sellerId)
                ->where('is_visible', true)
                ->where('stars', $i)
                ->count();

            $breakdown[$i] = [
                'count'      => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100) : 0,
            ];
        }
        return $breakdown;
    }
}
