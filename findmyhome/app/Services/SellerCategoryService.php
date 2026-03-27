<?php

namespace App\Services;

/**
 * SellerCategoryService
 *
 * Single source of truth for all rules around seller categories.
 *
 * Categories a seller can register under (multi-select):
 *   - land         — plots and land for sale
 *   - apartment    — apartments for sale or rent
 *   - house_rent   — houses for long-term rent
 *   - short_stay   — "AirBnB" as known in Uganda (daily/weekly stays)
 *   - lodge        — guest houses and lodges
 *
 * Strictness levels (KYC AI auto-approve thresholds):
 *   - land       → 95%  (strictest — land fraud is the biggest risk in Uganda)
 *   - apartment  → 90%  (moderate — large money involved)
 *   - house_rent → 80%  (light — tenant can walk away if something is wrong)
 *   - short_stay → 80%  (light — short money, low risk)
 *   - lodge      → 80%  (light — hospitality, short stays)
 *
 * Multi-category rule:
 *   A seller's KYC is assessed at the STRICTEST level they selected.
 *   e.g. Land + Short Stay → assessed at 95% (land threshold).
 */
class SellerCategoryService
{
    // All valid seller categories
    const CATEGORIES = [
        'house',
        'airbnb',
        'lodge',
        'rental',
        'apartment',
        'land',
    ];

    // Human-readable labels
    const LABELS = [
        'house'      => 'Houses',
        'airbnb'     => 'Airbnb',
        'lodge'      => 'Lodges',
        'rental'     => 'Rentals',
        'apartment'  => 'Apartments',
        'land'       => 'Land',
    ];

    // KYC AI auto-approve threshold per category
    const THRESHOLDS = [
        'land'       => 95,
        'apartment'  => 90,
        'house'      => 90,
        'rental'     => 80,
        'airbnb'     => 80,
        'lodge'      => 80,
    ];

    // Which property_type values belong to each category
    const CATEGORY_TO_PROPERTY_TYPES = [
        'house'      => ['house'],
        'airbnb'     => ['airbnb'],
        'lodge'      => ['lodge'],
        'rental'     => ['rental'],
        'apartment'  => ['apartment'],
        'land'       => ['land'],
    ];

    // Reverse: property_type → category
    const PROPERTY_TYPE_TO_CATEGORY = [
        'house'      => 'house',
        'airbnb'     => 'airbnb',
        'lodge'      => 'lodge',
        'rental'     => 'rental',
        'apartment'  => 'apartment',
        'land'       => 'land',
    ];

    // Whether land title is required per listing (individual sellers only)
    const REQUIRES_LAND_TITLE = [
        'land' => true,
        // all others → false
    ];

    // Strictness description shown to users
    const STRICTNESS_LABELS = [
        'land'       => 'Very strict — land title required per listing',
        'apartment'  => 'Moderate — slightly higher KYC scrutiny',
        'house'      => 'Moderate — higher KYC scrutiny for property sales',
        'rental'     => 'Light — National ID is sufficient',
        'airbnb'     => 'Light — National ID is sufficient',
        'lodge'      => 'Light — National ID is sufficient',
    ];

    /**
     * Get the KYC auto-approve threshold for a seller
     * based on the STRICTEST category they selected.
     *
     * If no categories selected (buyer / admin) — return default 90%.
     */
    public static function kycThreshold(array $categories): int
    {
        if (empty($categories)) return 90;

        $thresholds = array_map(
            fn($cat) => self::THRESHOLDS[$cat] ?? 80,
            $categories
        );

        return max($thresholds); // highest threshold = strictest
    }

    /**
     * Check if a seller is registered for the category
     * required to list a given property type.
     *
     * Returns true if:
     *  - The property type has no category restriction (e.g. commercial)
     *  - The seller's categories include the required one
     *  - The seller is a company (companies can list any category)
     *  - The seller is admin
     */
    public static function canListType(array $sellerCategories, string $propertyType, string $role): bool
    {
        if (in_array($role, ['admin', 'company'])) return true;

        $requiredCategory = self::PROPERTY_TYPE_TO_CATEGORY[$propertyType] ?? null;

        if ($requiredCategory === null) return true; // no restriction

        return in_array($requiredCategory, $sellerCategories);
    }

    /**
     * Does this property type require a land title upload?
     * Only applies to individual sellers — companies are exempt.
     */
    public static function requiresLandTitle(string $propertyType, string $role): bool
    {
        if ($role === 'company') return false;
        return self::REQUIRES_LAND_TITLE[$propertyType] ?? false;
    }

    /**
     * Get the listing type for a property type.
     * short_stay and lodge are always 'short_stay' listing type.
     * land is always 'sale'.
     * Others can be sale or rent.
     */
    public static function defaultListingType(string $propertyType): string
    {
        return match($propertyType) {
            'airbnb', 'lodge'     => 'short_stay',
            'apartment', 'rental' => 'rent',
            'land', 'house'       => 'sale',
            default               => 'sale',
        };
    }

    /**
     * Human-readable description of what each category requires.
     * Shown to the seller during registration.
     */
    public static function registrationInfo(): array
    {
        return [
            'land' => [
                'label'        => 'Land',
                'description'  => 'Sell land plots. We are very strict — you must upload a land title for every land listing to protect buyers from fraud.',
                'requires'     => ['National ID or Passport', 'Land title document per listing (mandatory)'],
                'kyc_level'    => 'Strict',
                'color'        => 'red',
            ],
            'apartment' => [
                'label'        => 'Apartments',
                'description'  => 'Sell or rent apartments. We are moderately strict — apartments involve large amounts of money.',
                'requires'     => ['National ID or Passport'],
                'kyc_level'    => 'Moderate',
                'color'        => 'amber',
            ],
            'house' => [
                'label'        => 'Houses',
                'description'  => 'Sell houses. Moderate verification — a clear National ID or Passport is required.',
                'requires'     => ['National ID or Passport'],
                'kyc_level'    => 'Moderate',
                'color'        => 'amber',
            ],
            'rental' => [
                'label'        => 'Rentals',
                'description'  => 'List long-term rentals. Light verification — National ID is sufficient.',
                'requires'     => ['National ID or Passport'],
                'kyc_level'    => 'Light',
                'color'        => 'green',
            ],
            'airbnb' => [
                'label'        => 'Airbnb',
                'description'  => 'List short-stay properties for daily/weekly stays. Light verification — National ID is sufficient.',
                'requires'     => ['National ID or Passport'],
                'kyc_level'    => 'Light',
                'color'        => 'green',
            ],
            'lodge' => [
                'label'        => 'Lodge / Guest House',
                'description'  => 'List lodges and guest houses. Light verification — National ID is sufficient.',
                'requires'     => ['National ID or Passport'],
                'kyc_level'    => 'Light',
                'color'        => 'green',
            ],
        ];
    }
}
