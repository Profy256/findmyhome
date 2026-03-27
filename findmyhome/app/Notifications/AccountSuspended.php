<?php
namespace App\Notifications;
use App\Models\Commission;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class AccountSuspended extends Notification
{
    use Queueable;
    public function __construct(public ?Commission $commission = null) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        $amount = $this->commission ? number_format($this->commission->commission_amount) : '0';
        return (new MailMessage)
            ->subject("🔴 Account Suspended — Find My Home")
            ->greeting("Hello {$notifiable->name},")
            ->line("Your account has been **suspended** due to unpaid commissions.")
            ->line("All your listings are hidden from buyers.")
            ->action("Pay to Restore Account", url('/dashboard/commissions'));
    }
    public function toArray(object $notifiable): array { return ['type' => 'account_suspended', 'message' => 'Your account is suspended. Pay outstanding commissions to restore.']; }
    public function toSms(): string { return "Find My Home: Account SUSPENDED. Pay commissions to restore: findmyhome.ug/dashboard"; }
}
