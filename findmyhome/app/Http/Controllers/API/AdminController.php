<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\{User, Property, KycDocument, Commission, Lead, Booking, Rating, Setting};
use App\Services\CommissionEnforcementService;
use App\Notifications\{AccountSuspended, AccountReactivated};
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\Log;

class AdminController extends Controller
{
    public function __construct()
    {
        // All admin routes require auth + admin role — enforced in routes/api.php
    }

    // ══════════════════════════════════════════════════════════════════════════
    // USER MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function listUsers(Request $request): JsonResponse
    {
        $users = User::query()
            ->when($request->role,       fn($q) => $q->where('role', $request->role))
            ->when($request->kyc_status, fn($q) => $q->where('kyc_status', $request->kyc_status))
            ->when($request->search,     fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name',  'ilike', "%{$request->search}%")
                  ->orWhere('email', 'ilike', "%{$request->search}%")
                  ->orWhere('phone', 'ilike', "%{$request->search}%");
            }))
            ->withCount(['properties', 'leadsAsSeller', 'commissions'])
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($users);
    }

    public function viewUser(User $user): JsonResponse
    {
        $user->load(['kycDocuments', 'properties', 'commissions', 'ratingsReceived']);
        return response()->json([
            'user'            => $user,
            'average_rating'  => $user->averageRating(),
            'total_reviews'   => $user->totalReviews(),
            'pending_commissions' => $user->pendingCommissions(),
            'total_leads'     => $user->leadsAsSeller()->count(),
            'whatsapp_leads'  => $user->leadsAsSeller()->where('contact_method', 'whatsapp')->count(),
        ]);
    }

    /** Block any user manually — admin will, no reason required */
    public function blockUser(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $user->update(['kyc_status' => 'blocked']);

        // Hide all active listings
        $hidden = $user->properties()
            ->where('status', 'active')
            ->update(['status' => 'frozen']);

        $this->adminLog('user_blocked', $request->user(), $user, [
            'reason'          => $request->reason ?? 'Admin manual block',
            'listings_hidden' => $hidden,
        ]);

        return response()->json([
            'message'         => "User blocked. {$hidden} listing(s) hidden.",
            'listings_hidden' => $hidden,
        ]);
    }

    /** Unblock any user manually — even if they have unpaid commissions */
    public function unblockUser(Request $request, User $user): JsonResponse
    {
        $user->update(['kyc_status' => 'verified']);

        // Restore frozen listings
        $restored = $user->properties()
            ->where('status', 'frozen')
            ->update(['status' => 'active']);

        $user->notify(new AccountReactivated());

        $this->adminLog('user_unblocked', $request->user(), $user, [
            'reason'            => $request->reason ?? 'Admin manual unblock',
            'listings_restored' => $restored,
        ]);

        return response()->json([
            'message'           => "User unblocked. {$restored} listing(s) restored.",
            'listings_restored' => $restored,
        ]);
    }

    public function deleteUser(Request $request, User $user): JsonResponse
    {
        // Soft delete — data retained for audit
        $user->delete();

        $this->adminLog('user_deleted', $request->user(), $user, [
            'reason' => $request->reason ?? 'Admin deletion',
        ]);

        return response()->json(['message' => 'User deleted.']);
    }

    public function changeUserRole(Request $request, User $user): JsonResponse
    {
        $request->validate(['role' => 'required|in:buyer,seller,company,admin']);

        $old = $user->role;
        $user->update(['role' => $request->role]);

        $this->adminLog('role_changed', $request->user(), $user, [
            'from' => $old, 'to' => $request->role,
        ]);

        return response()->json(['message' => "Role changed from {$old} to {$request->role}."]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // KYC MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function listKyc(Request $request): JsonResponse
    {
        $docs = KycDocument::with('user')
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($docs);
    }

    public function approveKyc(Request $request, KycDocument $document): JsonResponse
    {
        $document->approve($request->user());

        $this->adminLog('kyc_approved', $request->user(), $document->user);

        return response()->json(['message' => 'KYC approved. Seller can now list properties.']);
    }

    public function rejectKyc(Request $request, KycDocument $document): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:500']);

        $document->reject($request->user(), $request->reason);

        $this->adminLog('kyc_rejected', $request->user(), $document->user, [
            'reason' => $request->reason,
        ]);

        return response()->json(['message' => 'KYC rejected.']);
    }

    public function revokeKyc(Request $request, User $user): JsonResponse
    {
        $user->update(['kyc_status' => 'none']);
        $user->kycDocuments()->update(['status' => 'rejected']);

        // Freeze all their listings
        $frozen = $user->properties()
            ->where('status', 'active')
            ->update(['status' => 'frozen']);

        $this->adminLog('kyc_revoked', $request->user(), $user, [
            'reason'          => $request->reason ?? 'Admin KYC revocation',
            'listings_frozen' => $frozen,
        ]);

        return response()->json([
            'message'         => "KYC revoked. {$frozen} listing(s) frozen.",
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROPERTY LISTING MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function listProperties(Request $request): JsonResponse
    {
        $props = Property::with('seller')
            ->when($request->status,       fn($q) => $q->where('status', $request->status))
            ->when($request->property_type,fn($q) => $q->where('property_type', $request->property_type))
            ->when($request->search,       fn($q) => $q->where('title', 'ilike', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($props);
    }

    public function freezeListing(Request $request, Property $property): JsonResponse
    {
        $property->update(['status' => 'frozen']);

        $this->adminLog('listing_frozen', $request->user(), $property->seller, [
            'property_id' => $property->id,
            'reason'      => $request->reason ?? 'Admin freeze',
        ]);

        return response()->json(['message' => 'Listing frozen and hidden from buyers.']);
    }

    public function unfreezeListing(Request $request, Property $property): JsonResponse
    {
        $property->update(['status' => 'active']);

        $this->adminLog('listing_unfrozen', $request->user(), $property->seller, [
            'property_id' => $property->id,
        ]);

        return response()->json(['message' => 'Listing restored and visible to buyers.']);
    }

    public function deleteListing(Request $request, Property $property): JsonResponse
    {
        $property->delete();

        $this->adminLog('listing_deleted', $request->user(), $property->seller, [
            'property_id' => $property->id,
            'reason'      => $request->reason ?? 'Admin deletion',
        ]);

        return response()->json(['message' => 'Listing permanently deleted.']);
    }

    public function featureListing(Request $request, Property $property): JsonResponse
    {
        $request->validate(['days' => 'required|integer|min:1|max:90']);

        $property->update([
            'featured'       => true,
            'featured_until' => now()->addDays($request->days),
        ]);

        return response()->json([
            'message' => "Listing featured for {$request->days} day(s).",
        ]);
    }

    public function unfeatureListing(Property $property): JsonResponse
    {
        $property->update(['featured' => false, 'featured_until' => null]);
        return response()->json(['message' => 'Featured status removed.']);
    }

    public function verifyLandTitle(Request $request, Property $property): JsonResponse
    {
        if ($property->property_type !== 'land' || !$property->land_title_url) {
            return response()->json(['message' => 'No land title to verify.'], 422);
        }

        $property->update(['land_title_verified' => true]);

        $this->adminLog('land_title_verified', $request->user(), $property->seller, [
            'property_id' => $property->id,
        ]);

        return response()->json(['message' => 'Land title marked as verified.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COMMISSION MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function listCommissions(Request $request): JsonResponse
    {
        $commissions = Commission::with(['seller', 'transaction.property'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($commissions);
    }

    /** Admin manually marks a commission as paid (e.g. seller paid via bank transfer) */
    public function markCommissionPaid(Request $request, Commission $commission): JsonResponse
    {
        app(CommissionEnforcementService::class)->processPayment($commission);

        $this->adminLog('commission_manually_paid', $request->user(), $commission->seller, [
            'commission_id' => $commission->id,
            'amount'        => $commission->commission_amount,
            'note'          => $request->note ?? 'Marked paid by admin',
        ]);

        return response()->json(['message' => 'Commission marked as paid. Seller account checked for restoration.']);
    }

    /** Admin waives a commission entirely */
    public function waiveCommission(Request $request, Commission $commission): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:500']);

        $commission->update(['status' => 'paid', 'paid_at' => now()]);

        // Check if seller can be unblocked
        $seller = $commission->seller;
        if ($seller->kyc_status === 'blocked' && !$seller->hasUnpaidCommissions()) {
            app(CommissionEnforcementService::class)->processPayment($commission);
        }

        $this->adminLog('commission_waived', $request->user(), $commission->seller, [
            'commission_id' => $commission->id,
            'amount'        => $commission->commission_amount,
            'reason'        => $request->reason,
        ]);

        return response()->json(['message' => 'Commission waived.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BLUE BADGE MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function grantBlueBadge(Request $request, User $user): JsonResponse
    {
        $request->validate(['days' => 'nullable|integer|min:1']);

        $days = $request->days ?? 365;

        $user->update([
            'blue_badge'             => true,
            'blue_badge_expires_at'  => now()->addDays($days),
        ]);

        $this->adminLog('blue_badge_granted', $request->user(), $user, [
            'days' => $days, 'reason' => $request->reason ?? 'Admin grant',
        ]);

        return response()->json(['message' => "Blue badge granted for {$days} day(s)."]);
    }

    public function revokeBlueBadge(Request $request, User $user): JsonResponse
    {
        $user->update(['blue_badge' => false, 'blue_badge_expires_at' => null]);

        $this->adminLog('blue_badge_revoked', $request->user(), $user, [
            'reason' => $request->reason ?? 'Admin revocation',
        ]);

        return response()->json(['message' => 'Blue badge revoked.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BOOKING MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function listBookings(Request $request): JsonResponse
    {
        $bookings = Booking::with(['buyer', 'property.seller'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($bookings);
    }

    public function approveBookingAccess(Request $request, User $seller): JsonResponse
    {
        if (!$seller->isVerified()) {
            return response()->json(['message' => 'Seller must be KYC verified first.'], 422);
        }

        $seller->update(['booking_enabled' => true]);

        $this->adminLog('booking_access_granted', $request->user(), $seller);

        return response()->json(['message' => 'Online booking access granted.']);
    }

    public function revokeBookingAccess(Request $request, User $seller): JsonResponse
    {
        $seller->update(['booking_enabled' => false]);

        $this->adminLog('booking_access_revoked', $request->user(), $seller, [
            'reason' => $request->reason ?? 'Admin revocation',
        ]);

        return response()->json(['message' => 'Online booking access revoked.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RATINGS & REVIEWS
    // ══════════════════════════════════════════════════════════════════════════

    public function listRatings(Request $request): JsonResponse
    {
        $ratings = Rating::with(['buyer', 'seller', 'property'])
            ->when($request->is_visible !== null, fn($q) => $q->where('is_visible', $request->is_visible))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($ratings);
    }

    public function hideRating(Request $request, Rating $rating): JsonResponse
    {
        $rating->update(['is_visible' => false]);

        $this->adminLog('rating_hidden', $request->user(), $rating->seller, [
            'rating_id' => $rating->id,
            'reason'    => $request->reason ?? 'Admin moderation',
        ]);

        return response()->json(['message' => 'Review hidden from public profile.']);
    }

    public function restoreRating(Rating $rating): JsonResponse
    {
        $rating->update(['is_visible' => true]);
        return response()->json(['message' => 'Review restored.']);
    }

    public function deleteRating(Request $request, Rating $rating): JsonResponse
    {
        $rating->delete();

        $this->adminLog('rating_deleted', $request->user(), $rating->seller, [
            'rating_id' => $rating->id,
            'reason'    => $request->reason ?? 'Admin deletion',
        ]);

        return response()->json(['message' => 'Review permanently deleted.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PLATFORM SETTINGS
    // ══════════════════════════════════════════════════════════════════════════

    public function getSettings(): JsonResponse
    {
        $settings = Setting::all()->keyBy('key');
        return response()->json($settings);
    }

    public function updateSetting(Request $request, string $key): JsonResponse
    {
        $request->validate(['value' => 'required']);

        $setting = Setting::find($key);
        if (!$setting) {
            return response()->json(['message' => 'Setting not found.'], 404);
        }

        $old = $setting->value;
        Setting::set($key, $request->value);

        $this->adminLog('setting_updated', $request->user(), null, [
            'key' => $key, 'from' => $old, 'to' => $request->value,
        ]);

        return response()->json([
            'message' => "Setting '{$key}' updated from {$old} to {$request->value}.",
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ANALYTICS DASHBOARD
    // ══════════════════════════════════════════════════════════════════════════

    public function dashboard(): JsonResponse
    {
        return response()->json([
            'users' => [
                'total'     => User::count(),
                'buyers'    => User::where('role', 'buyer')->count(),
                'sellers'   => User::where('role', 'seller')->count(),
                'companies' => User::where('role', 'company')->count(),
                'blocked'   => User::where('kyc_status', 'blocked')->count(),
                'kyc_pending' => User::where('kyc_status', 'pending')->count(),
            ],
            'properties' => [
                'total'    => Property::count(),
                'active'   => Property::where('status', 'active')->count(),
                'frozen'   => Property::where('status', 'frozen')->count(),
                'sold'     => Property::where('status', 'sold')->count(),
                'rented'   => Property::where('status', 'rented')->count(),
                'featured' => Property::where('featured', true)->count(),
            ],
            'leads' => [
                'total'     => Lead::count(),
                'platform'  => Lead::where('contact_method', 'platform')->count(),
                'whatsapp'  => Lead::where('contact_method', 'whatsapp')->count(),
                'today'     => Lead::whereDate('created_at', today())->count(),
            ],
            'commissions' => [
                'pending'  => Commission::whereIn('status', ['pending', 'reminded'])->count(),
                'overdue'  => Commission::where('status', 'overdue')->count(),
                'paid'     => Commission::where('status', 'paid')->count(),
                'total_collected_ugx' => Commission::where('status', 'paid')->sum('commission_amount'),
                'total_pending_ugx'   => Commission::whereIn('status', ['pending', 'reminded', 'overdue'])->sum('commission_amount'),
            ],
            'bookings' => [
                'total'     => Booking::count(),
                'pending'   => Booking::where('status', 'pending')->count(),
                'confirmed' => Booking::where('status', 'confirmed')->count(),
            ],
            'revenue' => [
                'commission_ugx'   => Commission::where('status', 'paid')->sum('commission_amount'),
                'booking_fees_ugx' => Booking::where('payment_status', 'paid')->sum('platform_fee'),
            ],
            'current_settings' => [
                'commission_rate'            => Setting::commissionRate(),
                'commission_block_threshold' => Setting::commissionBlockThreshold(),
                'commission_due_days'        => Setting::commissionDueDays(),
                'booking_fee_rate'           => Setting::bookingFeeRate(),
                'blue_badge_price_ugx'       => Setting::blueBadgePrice(),
            ],
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEADS VIEW
    // ══════════════════════════════════════════════════════════════════════════

    public function listLeads(Request $request): JsonResponse
    {
        $leads = Lead::with(['buyer', 'seller', 'property'])
            ->when($request->method, fn($q) => $q->where('contact_method', $request->method))
            ->when($request->seller_id, fn($q) => $q->where('seller_id', $request->seller_id))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($leads);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AUDIT LOG (private helper)
    // ══════════════════════════════════════════════════════════════════════════

    private function adminLog(string $action, User $admin, ?User $target, array $context = []): void
    {
        Log::channel('admin_audit')->info($action, array_merge([
            'admin_id'    => $admin->id,
            'admin_name'  => $admin->name,
            'target_id'   => $target?->id,
            'target_name' => $target?->name,
            'ip'          => request()->ip(),
            'timestamp'   => now()->toIso8601String(),
        ], $context));
    }

    // ── Admin booking management ─────────────────────────────────────────────
    public function adminUpdateBooking(Request $request, \App\Models\Booking $booking): JsonResponse
    {
        $request->validate(['status' => 'required|in:confirmed,rejected,completed,cancelled', 'reason' => 'nullable|string|max:500']);
        $booking->update(['status' => $request->status]);
        $booking->buyer->notify(new \App\Notifications\BookingNotification($booking, $request->status, $request->reason));
        $this->adminLog('booking_status_updated', $request->user(), $booking->buyer, ['booking_id' => $booking->id, 'status' => $request->status]);
        return response()->json(['message' => "Booking {$request->status}.", 'booking' => $booking->fresh()]);
    }
}
