<?php
namespace App\Notifications;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class CompanyVerified extends Notification
{
    use Queueable;
    public function __construct(public User $company, public array $benefits) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        $name = $notifiable->company_name ?? $notifiable->name;
        return (new MailMessage)
            ->subject("✅ {$name} is Verified on Find My Home")
            ->greeting("Welcome, {$name}!")
            ->line("Your business is **fully verified**.")
            ->line("🔵 **Blue Badge** — Free for {$this->benefits['free_badge_days']} days.")
            ->line("⭐ **{$this->benefits['free_featured_slots']} Free Featured Listings**")
            ->line("📅 **Online Booking Enabled**")
            ->line("💰 **Reduced Commission — {$this->benefits['commission_rate']}%**")
            ->action('Go to Dashboard', url('/dashboard'));
    }
    public function toArray(object $notifiable): array
    {
        return ['type' => 'company_verified', 'message' => 'Your company is verified. All benefits activated.', 'benefits' => $this->benefits];
    }
    public function toSms(): string { $name = $this->company->company_name ?? $this->company->name; return "Find My Home: {$name} verified! Blue Badge active, booking enabled. Start listing: findmyhome.ug/dashboard"; }
}
