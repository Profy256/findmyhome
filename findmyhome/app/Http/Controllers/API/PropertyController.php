<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Services\SellerCategoryService;
use App\Jobs\DetectDuplicateProperty;
use Illuminate\Http\{Request, JsonResponse};

class PropertyController extends Controller
{
    // ── Public search ─────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Property::active()
            ->with('seller:id,name,role,blue_badge,blue_badge_expires_at,kyc_status,company_name,booking_enabled,seller_categories')
            ->byLocation($request->location)
            ->byType($request->type)
            ->byListing($request->listing)
            ->byBedrooms($request->bedrooms)
            ->companiesFirst();

        // Price filter
        if ($request->listing === 'rent' && $request->max_price) {
            $query->byMaxPrice((int) $request->max_price);
        } elseif ($request->min_price || $request->max_price) {
            $query->byPriceRange(
                $request->min_price ? (int) $request->min_price : null,
                $request->max_price ? (int) $request->max_price : null,
            );
        }

        if ($request->blue_badge_only) {
            $query->whereHas('seller', fn($q) => $q->where('blue_badge', true));
        }

        return response()->json($query->paginate(20));
    }

    // ── Single property ───────────────────────────────────────────────────────

    public function show(Property $property): JsonResponse
    {
        $property->load('seller:id,name,role,blue_badge,blue_badge_expires_at,kyc_status,company_name,booking_enabled,seller_categories');

        return response()->json([
            'property'         => $property,
            'trust_label'      => $property->trustLabel(),
            'has_map_location' => $property->hasMapLocation(),
            'google_maps_url'  => $property->googleMapsUrl(),
            'seller_rating'    => $property->seller->averageRating(),
            'seller_reviews'   => $property->seller->totalReviews(),
            'category_info'    => $this->categoryInfo($property),
        ]);
    }

    // ── Create listing ────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $seller = $request->user();

        if (!$seller->isVerified()) {
            return response()->json([
                'message'    => 'You must complete identity verification before listing a property.',
                'kyc_status' => $seller->kyc_status,
                'action'     => 'Upload your documents in the KYC section of your dashboard.',
            ], 403);
        }

        if (!$seller->isSeller()) {
            return response()->json([
                'message' => 'Only seller or company accounts can list properties.',
            ], 403);
        }

        $data = $request->validate([
            'title'          => 'required|string|max:255',
            'description'    => 'required|string',
            'price'          => 'required|integer|min:1',
            'location'       => 'required|string|max:255',
            'district'       => 'nullable|string|max:100',
            'property_type'  => 'required|in:land,apartment,rental,house,airbnb,lodge',
            // listing_type is derived from property_type (we ignore client input)
            'listing_type'   => 'nullable|in:sale,rent,short_stay',
            'bedrooms'       => 'nullable|integer|min:0',
            'bathrooms'      => 'nullable|integer|min:0',
            'size'           => 'nullable|string|max:100',
            'max_guests'     => 'nullable|integer|min:1',
            'amenities'      => 'nullable|array',
            'amenities.*'    => 'string',
            'photos'         => 'required|array|min:1',
            'photos.*'       => 'string',
            // Land title fields
            'land_title_url'           => 'nullable|string',
            'land_title_cloudinary_id' => 'nullable|string',
            'land_title_lat'           => 'nullable|numeric|between:-90,90',
            'land_title_lng'           => 'nullable|numeric|between:-180,180',
        ]);

        $propertyType = $data['property_type'];
        $categories   = $seller->seller_categories ?? [];

        // ── Check seller is registered for this category ──────────────────────
        if (!SellerCategoryService::canListType($categories, $propertyType, $seller->role)) {
            $required = SellerCategoryService::PROPERTY_TYPE_TO_CATEGORY[$propertyType] ?? null;
            $label    = $required ? SellerCategoryService::LABELS[$required] : $propertyType;
            return response()->json([
                'message' => "You are not registered to list {$label} properties. "
                           . "Please update your seller categories in account settings.",
                'required_category' => $required,
                'your_categories'   => $categories,
            ], 403);
        }

        // ── Land title enforcement — individuals only ──────────────────────────
        if (SellerCategoryService::requiresLandTitle($propertyType, $seller->role)) {
            if (empty($data['land_title_url'])) {
                return response()->json([
                    'message'  => 'Land sellers must upload a land title document for every land listing. '
                                . 'This is mandatory to protect buyers from fraud. '
                                . 'Registered companies are exempt from this requirement.',
                    'requires' => 'land_title_url',
                ], 422);
            }
        }

        // ── Companies cannot upload land titles (not needed) ───────────────────
        if ($seller->role === 'company') {
            unset($data['land_title_url'], $data['land_title_cloudinary_id']);
        }

        // ── Set listing type automatically ────────────────────────────────────
        $data['listing_type'] = match ($propertyType) {
            'airbnb', 'lodge'     => 'short_stay',
            'apartment', 'rental' => 'rent',
            'land', 'house'       => 'sale',
            default               => 'sale',
        };

        $property = Property::create(array_merge($data, [
            'seller_id' => $seller->id,
            'status'    => 'active',
        ]));

        DetectDuplicateProperty::dispatch($property);

        return response()->json([
            'message'  => 'Property listed successfully.',
            'property' => $property,
        ], 201);
    }

    // ── Update listing ────────────────────────────────────────────────────────

    public function update(Request $request, Property $property): JsonResponse
    {
        $seller = $request->user();

        if ($property->seller_id !== $seller->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (in_array($property->status, ['sold', 'rented'])) {
            return response()->json(['message' => 'Cannot edit a sold or rented listing.'], 422);
        }

        $data = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'price'       => 'sometimes|integer|min:1',
            'location'    => 'sometimes|string|max:255',
            'district'    => 'nullable|string|max:100',
            'bedrooms'    => 'nullable|integer|min:0',
            'bathrooms'   => 'nullable|integer|min:0',
            'size'        => 'nullable|string|max:100',
            'max_guests'  => 'nullable|integer|min:1',
            'amenities'   => 'nullable|array',
            'photos'      => 'sometimes|array|min:1',
            'photos.*'    => 'string',
            'land_title_url'           => 'nullable|string',
            'land_title_cloudinary_id' => 'nullable|string',
            'land_title_lat'           => 'nullable|numeric|between:-90,90',
            'land_title_lng'           => 'nullable|numeric|between:-180,180',
        ]);

        // Companies still cannot upload titles
        if ($seller->role === 'company') {
            unset($data['land_title_url'], $data['land_title_cloudinary_id']);
        }

        $property->update($data);

        return response()->json([
            'message'  => 'Listing updated.',
            'property' => $property->fresh(),
        ]);
    }

    // ── Delete listing ────────────────────────────────────────────────────────

    public function destroy(Request $request, Property $property): JsonResponse
    {
        if ($property->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }
        $property->delete();
        return response()->json(['message' => 'Listing deleted.']);
    }

    // ── Seller's own listings ─────────────────────────────────────────────────

    public function myListings(Request $request): JsonResponse
    {
        $listings = Property::where('seller_id', $request->user()->id)
            ->withCount(['leads', 'bookings'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($listings);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function categoryInfo(Property $property): array
    {
        $category = SellerCategoryService::PROPERTY_TYPE_TO_CATEGORY[$property->property_type] ?? null;
        if (!$category) return [];

        return [
            'category'         => $category,
            'label'            => SellerCategoryService::LABELS[$category] ?? $category,
            'strictness_label' => SellerCategoryService::STRICTNESS_LABELS[$category] ?? '',
        ];
    }
}
