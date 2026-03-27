<?php
namespace App\Notifications;
use App\Models\Commission;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class CommissionFinalWarning extends Notification
{
    use Queueable;
    public function __construct(public Commission $commission) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        $amount = number_format($this->commission->commission_amount);
        return (new MailMessage)
            ->subject("🚨 FINAL WARNING: Commission Payment — Find My Home")
            ->greeting("Hello {$notifiable->name},")
            ->line("This is your **FINAL WARNING** regarding unpaid commission of **UGX {$amount}**.")
            ->line("Your account will be **suspended** if payment is not received within 24 hours.")
            ->action("Pay Now — UGX {$amount}", url('/dashboard/commissions'))
            ->line("Account and listings restored immediately upon payment.");
    }
    public function toArray(object $notifiable): array { return ['type' => 'commission_final_warning', 'commission_id' => $this->commission->id, 'amount' => $this->commission->commission_amount, 'message' => "FINAL WARNING: Pay UGX " . number_format($this->commission->commission_amount) . " or account suspended."]; }
    public function toSms(): string { $amount = number_format($this->commission->commission_amount); return "FINAL WARNING - Find My Home: Pay UGX {$amount} commission NOW or account SUSPENDED: findmyhome.ug/dashboard"; }
}
