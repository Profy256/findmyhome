<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SellerCategoryService;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'               => 'required|string|max:255',
            'email'              => 'required|email|unique:users',
            'phone'              => 'required|string|unique:users',
            'password'           => ['required', Password::min(8)],
            'role'               => 'required|in:buyer,seller,company',
            'company_name'       => 'required_if:role,company|nullable|string|max:255',
            'registration_number'=> 'nullable|string|max:100',

            // Seller categories — required for sellers and companies, multi-select
            'seller_categories'  => 'required_if:role,seller|required_if:role,company|nullable|array',
            'seller_categories.*'=> 'in:land,apartment,house_rent,short_stay,lodge',
        ]);

        // Validate at least one category if seller or company
        if (in_array($data['role'], ['seller', 'company']) && empty($data['seller_categories'])) {
            return response()->json([
                'message' => 'Please select at least one property category you will be listing.',
                'errors'  => ['seller_categories' => ['At least one category is required for sellers.']],
            ], 422);
        }

        $user = User::create([
            'name'                => $data['name'],
            'email'               => $data['email'],
            'phone'               => $data['phone'],
            'password'            => $data['password'],
            'role'                => $data['role'],
            'company_name'        => $data['company_name'] ?? null,
            'registration_number' => $data['registration_number'] ?? null,
            'seller_categories'   => $data['seller_categories'] ?? null,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        // Tell the seller what KYC level applies to them
        $kycInfo = null;
        if (in_array($user->role, ['seller', 'company']) && $user->seller_categories) {
            $threshold = SellerCategoryService::kycThreshold($user->seller_categories);
            $strictest = $this->strictestCategory($user->seller_categories);
            $kycInfo = [
                'threshold'        => $threshold,
                'strictest_category' => $strictest,
                'message'          => $this->kycMessage($strictest),
            ];
        }

        return response()->json([
            'message'  => 'Account created successfully.',
            'user'     => $this->userPayload($user),
            'token'    => $token,
            'kyc_info' => $kycInfo,
            'next_step'=> in_array($user->role, ['seller', 'company'])
                ? 'Upload your identity document to get verified and start listing.'
                : null,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'     => 'required|email',
            'password'  => 'required|string',
            'fcm_token' => 'nullable|string',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($data['fcm_token']) {
            $user->update(['fcm_token' => $data['fcm_token']]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'user'    => $this->userPayload($user),
            'token'   => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
    }

    public function updateFcmToken(Request $request): JsonResponse
    {
        $request->validate(['fcm_token' => 'required|string']);
        $request->user()->update(['fcm_token' => $request->fcm_token]);
        return response()->json(['message' => 'FCM token updated.']);
    }

    /**
     * Get available seller categories with their descriptions.
     * Called by the frontend to render the registration category picker.
     */
    public function categories(): JsonResponse
    {
        return response()->json([
            'categories' => SellerCategoryService::registrationInfo(),
            'note'       => 'Select all categories you plan to list. Your KYC will be assessed at the strictest level you select.',
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function userPayload(User $user): array
    {
        return [
            'id'                  => $user->id,
            'name'                => $user->name,
            'company_name'        => $user->company_name,
            'display_name'        => $user->company_name ?? $user->name,
            'email'               => $user->email,
            'phone'               => $user->phone,
            'role'                => $user->role,
            'kyc_status'          => $user->kyc_status,
            'seller_categories'   => $user->seller_categories ?? [],
            'blue_badge'          => $user->hasBlueBadge(),
            'booking_enabled'     => $user->booking_enabled,
            'average_rating'      => $user->averageRating(),
            'total_reviews'       => $user->totalReviews(),
            'free_featured_slots' => $user->free_featured_slots,
            'created_at'          => $user->created_at,
        ];
    }

    private function strictestCategory(array $categories): string
    {
        $thresholds = SellerCategoryService::THRESHOLDS;
        usort($categories, fn($a, $b) => ($thresholds[$b] ?? 80) <=> ($thresholds[$a] ?? 80));
        return $categories[0];
    }

    private function kycMessage(string $strictest): string
    {
        return match($strictest) {
            'land'      => 'You have selected Land. We are very strict on land sellers. Upload a clear National ID or Passport. You will also need to upload a land title for every land listing.',
            'apartment' => 'You have selected Apartments. We take extra care to verify apartment sellers. Upload a clear National ID or Passport.',
            default     => 'Upload a clear National ID or Passport to get verified. Verification is quick and free.',
        };
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'phone'             => 'sometimes|string|unique:users,phone,' . $user->id,
            'company_name'      => 'nullable|string|max:255',
            'seller_categories' => 'nullable|array',
            'seller_categories.*' => 'in:land,apartment,house_rent,short_stay,lodge',
        ]);
        $user->update($data);
        return response()->json(['message' => 'Profile updated.', 'user' => $this->userPayload($user->fresh())]);
    }
}
