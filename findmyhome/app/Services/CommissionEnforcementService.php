<?php

namespace App\Services;

use App\Models\Commission;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\CommissionReminder;
use App\Notifications\CommissionFinalWarning;
use App\Notifications\AccountSuspended;
use App\Notifications\AccountReactivated;
use Illuminate\Support\Facades\Log;

class CommissionEnforcementService
{
    /**
     * Run daily by the scheduler.
     *
     * Two separate jobs:
     *  1. Send reminders on each individual overdue commission
     *  2. Block sellers who have reached the unpaid commission threshold
     *     (default: 3 unpaid commissions — admin can change this in settings)
     */
    public function processOverdueCommissions(): void
    {
        $this->sendReminders();
        $this->blockSellersOverThreshold();
    }

    // ── Step 1: Reminders on individual overdue commissions ──────────────────
    private function sendReminders(): void
    {
        Commission::whereIn('status', ['pending', 'reminded', 'overdue'])
            ->with('seller')
            ->get()
            ->each(function (Commission $commission) {
                $days = $this->daysOverdue($commission);
                if ($days >= 0) {
                    $this->maybeSendReminder($commission, $days);
                }
            });
    }

    // ── Step 2: Block sellers who hit the unpaid threshold ───────────────────
    private function blockSellersOverThreshold(): void
    {
        $threshold = Setting::commissionBlockThreshold(); // default 3, admin can change

        User::whereIn('role', ['seller', 'company'])
            ->where('kyc_status', 'verified')
            ->withCount(['commissions as unpaid_count' => fn($q) =>
                $q->whereIn('status', ['pending', 'reminded', 'overdue'])
                  ->where('due_date', '<', now())
            ])
            ->having('unpaid_count', '>=', $threshold)
            ->get()
            ->each(fn(User $seller) => $this->blockSeller($seller));
    }

    private function maybeSendReminder(Commission $commission, int $daysOverdue): void
    {
        if ($commission->last_reminded_at &&
            $commission->last_reminded_at->diffInHours(now()) < 6) {
            return; // throttle
        }

        $r1 = Setting::get('commission_reminder_1_days', 0);
        $r2 = Setting::get('commission_reminder_2_days', 7);
        $r3 = Setting::get('commission_reminder_3_days', 14);

        if      ($commission->reminder_count < 3 && $daysOverdue >= $r3) $this->sendReminder($commission, 3, $daysOverdue);
        elseif  ($commission->reminder_count < 2 && $daysOverdue >= $r2) $this->sendReminder($commission, 2, $daysOverdue);
        elseif  ($commission->reminder_count < 1 && $daysOverdue >= $r1) $this->sendReminder($commission, 1, $daysOverdue);
    }

    private function sendReminder(Commission $commission, int $number, int $daysOverdue = 0): void
    {
        $commission->update([
            'reminder_count'   => $number,
            'status'           => $number === 3 ? 'overdue' : 'reminded',
            'last_reminded_at' => now(),
        ]);

        $notification = $number === 3
            ? new CommissionFinalWarning($commission)
            : new CommissionReminder($commission, $number);

        $commission->seller->notify($notification);
        $this->sendSms($commission->seller->phone, $notification->toSms());

        Log::info("Commission reminder #{$number} sent", [
            'commission_id' => $commission->id,
            'seller_id'     => $commission->seller_id,
            'amount_ugx'    => $commission->commission_amount,
            'days_overdue'  => $daysOverdue,
        ]);
    }

    private function blockSeller(User $seller): void
    {
        $unpaidCount = $seller->commissions()
            ->whereIn('status', ['pending', 'reminded', 'overdue'])
            ->where('due_date', '<', now())
            ->count();

        $seller->update(['kyc_status' => 'blocked']);

        $hidden = $seller->properties()
            ->where('status', 'active')
            ->update(['status' => 'frozen']);

        $seller->commissions()
            ->whereIn('status', ['pending', 'reminded'])
            ->where('due_date', '<', now())
            ->update(['status' => 'overdue']);

        $latestCommission = $seller->commissions()
            ->where('status', 'overdue')
            ->latest()
            ->first();

        $seller->notify(new AccountSuspended($latestCommission));

        $this->sendSms(
            $seller->phone,
            "Find My Home: Your account has been SUSPENDED due to {$unpaidCount} unpaid " .
            "commission(s). Pay all outstanding commissions to restore: findmyhome.ug/dashboard"
        );

        Log::warning("Seller BLOCKED", [
            'seller_id'       => $seller->id,
            'unpaid_count'    => $unpaidCount,
            'threshold'       => Setting::commissionBlockThreshold(),
            'listings_hidden' => $hidden,
        ]);
    }

    /**
     * Called when seller pays a commission.
     * Unblocks them only when ALL overdue commissions are cleared.
     */
    public function processPayment(Commission $commission): void
    {
        $commission->markPaid();

        $seller = $commission->fresh()->seller;

        $remainingOverdue = $seller->commissions()
            ->whereIn('status', ['pending', 'reminded', 'overdue'])
            ->where('due_date', '<', now())
            ->count();

        Log::info("Commission payment received", [
            'commission_id'    => $commission->id,
            'seller_id'        => $seller->id,
            'remaining_overdue'=> $remainingOverdue,
        ]);

        if ($remainingOverdue === 0 && $seller->kyc_status === 'blocked') {
            $this->unblockSeller($seller);
        }
    }

    private function unblockSeller(User $seller): void
    {
        $seller->update(['kyc_status' => 'verified']);

        $restored = $seller->properties()
            ->where('status', 'frozen')
            ->update(['status' => 'active']);

        $seller->notify(new AccountReactivated());

        $this->sendSms(
            $seller->phone,
            "Find My Home: All commissions cleared! Your account is RESTORED and your " .
            "{$restored} listing(s) are visible to buyers again. Thank you."
        );

        Log::info("Seller UNBLOCKED — all commissions paid", [
            'seller_id'         => $seller->id,
            'listings_restored' => $restored,
        ]);
    }

    private function sendSms(string $phone, string $message): void
    {
        try {
            $at = new \AfricasTalking\SDK\AfricasTalking(
                config('services.africastalking.username'),
                config('services.africastalking.api_key')
            );
            $at->sms()->send([
                'to'      => $phone,
                'message' => $message,
                'from'    => config('services.africastalking.sender_id'),
            ]);
        } catch (\Exception $e) {
            Log::error("SMS failed to {$phone}: " . $e->getMessage());
        }
    }

    private function daysOverdue(Commission $commission): int
    {
        return (int) (now()->startOfDay()->diffInDays(
            $commission->due_date->startOfDay(), false
        ) * -1);
    }
}
