<?php

use App\Http\Controllers\API\{
    AuthController,
    KycController,
    PropertyController,
    LeadController,
    RatingController,
    BookingController,
    TransactionController,
    NotificationController,
    AdminController,
};
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Find My Home — API Routes
|--------------------------------------------------------------------------
| Base URL: /api/v1
| Auth:     Laravel Sanctum (Bearer token)
| Versioning: All routes are under /v1 prefix.
|             Old /api/* paths are kept as aliases for backward compat.
|--------------------------------------------------------------------------
*/

// ── Health check (no version prefix — always available) ───────────────────────
Route::get('/health', fn() => response()->json([
    'status'  => 'ok',
    'service' => 'Find My Home API',
    'version' => '1.0.0',
]));

// ── API v1 ────────────────────────────────────────────────────────────────────
Route::prefix('v1')->group(function () {

// Auth
Route::middleware('throttle:auth')->prefix('auth')->group(function () {
    Route::post('/register',  [AuthController::class, 'register']);
    Route::post('/login',     [AuthController::class, 'login']);
    // Returns seller categories — used to render the multi-select on registration
    Route::get('/categories', [AuthController::class, 'categories']);
});

// ── Password Reset ────────────────────────────────────────────────────────────
Route::middleware('throttle:auth')->group(function () {
    Route::post('/forgot-password', [\App\Http\Controllers\API\PasswordResetController::class, 'sendLink']);
    Route::post('/reset-password',  [\App\Http\Controllers\API\PasswordResetController::class, 'reset']);
});

// Properties — public search (anyone can browse)
Route::get('/properties',          [PropertyController::class, 'index']);
Route::get('/properties/{property}',[PropertyController::class, 'show']);

// Public seller reviews — other buyers can read these
Route::get('/sellers/{seller}/reviews', [RatingController::class, 'sellerReviews']);

// ── Authenticated routes (all require valid Sanctum token) ────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // ── Auth ──────────────────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('/logout',         [AuthController::class, 'logout']);
        Route::get('/me',              [AuthController::class, 'me']);
        Route::post('/fcm-token',      [AuthController::class, 'updateFcmToken']);
    Route::patch('/profile',          [AuthController::class, 'updateProfile']);
    });

    // ── KYC ───────────────────────────────────────────────────────────────────
    Route::middleware('throttle:kyc')->prefix('kyc')->group(function () {
        Route::get('/',            [KycController::class, 'status']);
        Route::post('/upload',     [KycController::class, 'upload']);
        Route::get('/documents',   [KycController::class, 'myDocuments']);
    });

    // ── Properties (seller + company only for write operations) ───────────────
    Route::middleware(['verified.seller', 'seller.active'])->group(function () {
        Route::post('/properties',                    [PropertyController::class, 'store']);
        Route::put('/properties/{property}',          [PropertyController::class, 'update']);
        Route::delete('/properties/{property}',       [PropertyController::class, 'destroy']);
    });
    Route::get('/my-listings', [PropertyController::class, 'myListings'])
        ->middleware('verified.seller');

    // ── Leads ─────────────────────────────────────────────────────────────────
    // Both buyer-facing actions — record when they contact a seller
    Route::post('/properties/{property}/enquire',  [LeadController::class, 'recordPlatformLead']);
    Route::post('/properties/{property}/whatsapp', [LeadController::class, 'recordWhatsappLead']);
    // Seller views their leads
    Route::get('/my-leads', [LeadController::class, 'myLeads'])->middleware('verified.seller');

    // ── Ratings ───────────────────────────────────────────────────────────────
    // Only buyers can rate sellers
    Route::post('/sellers/{seller}/rate',        [RatingController::class, 'store']);
    Route::put('/ratings/{rating}',              [RatingController::class, 'update']);
    Route::get('/sellers/{seller}/can-rate',     [RatingController::class, 'canRate']);

    // ── Bookings ──────────────────────────────────────────────────────────────
    Route::post('/properties/{property}/book',           [BookingController::class, 'store']);
    Route::patch('/bookings/{booking}/status',           [BookingController::class, 'updateStatus']);
    Route::get('/my-bookings',                           [BookingController::class, 'myBookings']);

    // ── Transactions ──────────────────────────────────────────────────────────
    Route::post('/transactions',                  [TransactionController::class, 'store']);
    Route::post('/transactions/{transaction}/confirm', [TransactionController::class, 'confirm']);
    Route::get('/my-transactions',                [TransactionController::class, 'myTransactions']);

    // ── Notifications ─────────────────────────────────────────────────────────
    Route::prefix('notifications')->group(function () {
        Route::get('/',                          [NotificationController::class, 'index']);
        Route::get('/unread',                    [NotificationController::class, 'unread']);
        Route::post('/mark-all-read',            [NotificationController::class, 'markAllRead']);
        Route::patch('/{id}/read',               [NotificationController::class, 'markRead']);
        Route::delete('/{id}',                   [NotificationController::class, 'destroy']);
    });

    // ── Admin (admin role only) ───────────────────────────────────────────────
    Route::middleware('admin')->prefix('admin')->group(function () {

        // Dashboard stats
        Route::get('/dashboard', [AdminController::class, 'dashboard']);

        // User management
        Route::get('/users',                          [AdminController::class, 'listUsers']);
        Route::get('/users/{user}',                   [AdminController::class, 'viewUser']);
        Route::post('/users/{user}/block',            [AdminController::class, 'blockUser']);
        Route::post('/users/{user}/unblock',          [AdminController::class, 'unblockUser']);
        Route::delete('/users/{user}',                [AdminController::class, 'deleteUser']);
        Route::patch('/users/{user}/role',            [AdminController::class, 'changeUserRole']);

        // KYC management
        Route::get('/kyc',                            [AdminController::class, 'listKyc']);
        Route::post('/kyc/{document}/approve',        [AdminController::class, 'approveKyc']);
        Route::post('/kyc/{document}/reject',         [AdminController::class, 'rejectKyc']);
        Route::post('/users/{user}/revoke-kyc',       [AdminController::class, 'revokeKyc']);

        // Property management
        Route::get('/properties',                     [AdminController::class, 'listProperties']);
        Route::post('/properties/{property}/freeze',  [AdminController::class, 'freezeListing']);
        Route::post('/properties/{property}/unfreeze',[AdminController::class, 'unfreezeListing']);
        Route::delete('/properties/{property}',       [AdminController::class, 'deleteListing']);
        Route::post('/properties/{property}/feature', [AdminController::class, 'featureListing']);
        Route::post('/properties/{property}/unfeature',[AdminController::class,'unfeatureListing']);
        Route::post('/properties/{property}/verify-title', [AdminController::class, 'verifyLandTitle']);

        // Commission management
        Route::get('/commissions',                    [AdminController::class, 'listCommissions']);
        Route::post('/commissions/{commission}/paid', [AdminController::class, 'markCommissionPaid']);
        Route::post('/commissions/{commission}/waive',[AdminController::class, 'waiveCommission']);

        // Blue Badge management
        Route::post('/users/{user}/grant-badge',      [AdminController::class, 'grantBlueBadge']);
        Route::post('/users/{user}/revoke-badge',     [AdminController::class, 'revokeBlueBadge']);

        // Booking management
        Route::get('/bookings',                         [AdminController::class, 'listBookings']);
        Route::patch('/bookings/{booking}/status',      [AdminController::class, 'adminUpdateBooking']);
        Route::post('/users/{seller}/booking-access',   [AdminController::class, 'approveBookingAccess']);
        Route::delete('/users/{seller}/booking-access', [AdminController::class, 'revokeBookingAccess']);

        // Ratings & Reviews
        Route::get('/ratings',                        [AdminController::class, 'listRatings']);
        Route::post('/ratings/{rating}/hide',         [AdminController::class, 'hideRating']);
        Route::post('/ratings/{rating}/restore',      [AdminController::class, 'restoreRating']);
        Route::delete('/ratings/{rating}',            [AdminController::class, 'deleteRating']);

        // Leads
        Route::get('/leads',                          [AdminController::class, 'listLeads']);

        // Platform settings
        Route::get('/settings',                       [AdminController::class, 'getSettings']);
        Route::patch('/settings/{key}',               [AdminController::class, 'updateSetting']);
    });
});

}); // end v1

// ── Pesapal IPN callback (outside v1 — called by Pesapal directly) ───────────
Route::post('/payments/ipn',    [BookingController::class, 'pesapalIpn']);
Route::post('/v1/payments/ipn', [BookingController::class, 'pesapalIpn']);
