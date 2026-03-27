<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// ── Verified seller only ──────────────────────────────────────────────────────
class EnsureVerifiedSeller
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!in_array($user->role, ['seller', 'company', 'admin'])) {
            return response()->json([
                'message' => 'Only seller or company accounts can perform this action.',
            ], 403);
        }

        if ($user->kyc_status !== 'verified' && $user->role !== 'admin') {
            return response()->json([
                'message'    => 'Your identity must be verified before you can list properties.',
                'kyc_status' => $user->kyc_status,
                'action'     => 'Please complete KYC verification in your dashboard.',
            ], 403);
        }

        return $next($request);
    }
}
