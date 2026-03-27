<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// ── Block suspended sellers from creating new listings or receiving bookings ──
class EnsureSellerNotBlocked
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->kyc_status === 'blocked') {
            $unpaid = $user->commissions()
                ->whereIn('status', ['pending', 'reminded', 'overdue'])
                ->where('due_date', '<', now())
                ->sum('commission_amount');

            return response()->json([
                'message'       => 'Your account is suspended due to unpaid commissions.',
                'unpaid_amount' => $unpaid,
                'action'        => 'Please pay your outstanding commissions to restore your account.',
                'pay_url'       => url('/dashboard/commissions'),
            ], 403);
        }

        return $next($request);
    }
}
