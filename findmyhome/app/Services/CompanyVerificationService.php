<?php

namespace App\Services;

use App\Models\{KycDocument, User, Setting};
use App\Notifications\CompanyVerified;
use App\Notifications\KycApproved;
use Illuminate\Support\Facades\Log;

class CompanyVerificationService
{
    /**
     * Called after every KYC document on a company account is approved.
     * Checks if BOTH required documents are now verified.
     * If yes — grants all company privileges automatically.
     */
    public function checkAndActivate(User $company): void
    {
        if ($company->role !== 'company') return;

        $verified = $company->kycDocuments()
            ->where('status', 'verified')
            ->pluck('document_type')
            ->toArray();

        $hasCertificate = in_array('business_registration', $verified);

        // Only business registration document is required
        if (!$hasCertificate) {
            Log::info("Company KYC incomplete — waiting for business document", [
                'company_id'     => $company->id,
                'has_cert'       => $hasCertificate,
                'verified_docs'  => $verified,
            ]);
            return;
        }

        // Both verified — activate the company
        $this->activateCompany($company);
    }

    /**
     * Grant all company privileges upon full verification.
     */
    private function activateCompany(User $company): void
    {
        // Don't activate twice
        if ($company->kyc_status === 'verified') return;

        $freeBadgeDays      = Setting::get('company_free_badge_days', 30);
        $freeFeaturedSlots  = Setting::get('company_free_featured_slots', 2);
        $companyCommission  = Setting::get('commission_rate_company', 3.0);

        $company->update([
            // 1. Mark as fully verified
            'kyc_status'              => 'verified',

            // 2. Blue Badge — free for configurable days
            'blue_badge'              => true,
            'blue_badge_expires_at'   => now()->addDays($freeBadgeDays),

            // 3. Online booking — pre-approved for companies
            'booking_enabled'         => true,

            // 4. Free featured listing credits
            'free_featured_slots'     => $freeFeaturedSlots,

            // 5. Reduced commission rate
            'commission_rate_override'=> $companyCommission,
        ]);

        // Notify the company with full breakdown of their benefits
        $company->notify(new CompanyVerified($company, [
            'free_badge_days'     => $freeBadgeDays,
            'free_featured_slots' => $freeFeaturedSlots,
            'commission_rate'     => $companyCommission,
        ]));

        Log::info("Company FULLY VERIFIED — all privileges granted", [
            'company_id'          => $company->id,
            'company_name'        => $company->company_name ?? $company->name,
            'free_badge_days'     => $freeBadgeDays,
            'free_featured_slots' => $freeFeaturedSlots,
            'commission_rate'     => $companyCommission,
        ]);
    }
}
