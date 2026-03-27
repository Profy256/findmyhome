<?php
namespace App\Notifications;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class AccountReactivated extends Notification
{
    use Queueable;
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("✅ Account Restored — Find My Home")
            ->greeting("Hello {$notifiable->name},")
            ->line("Your commission payment has been received. Account **fully restored**.")
            ->line("All your listings are visible to buyers again.")
            ->action("View Dashboard", url('/dashboard'));
    }
    public function toArray(object $notifiable): array { return ['type' => 'account_reactivated', 'message' => 'Account restored. All listings are visible to buyers.']; }
    public function toSms(): string { return "Find My Home: Account RESTORED. All listings visible again. Thank you."; }
}
