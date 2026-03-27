<?php
namespace App\Notifications;
use App\Models\KycDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class KycApproved extends Notification
{
    use Queueable;
    public function __construct(public KycDocument $document, public bool $autoApproved = false) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('✅ Identity Verified — Find My Home')
            ->greeting("Hello {$notifiable->name},")
            ->line('Your identity has been verified successfully.')
            ->line($this->autoApproved ? 'Verified automatically by our system.' : 'Reviewed and approved by our team.')
            ->line('You can now list properties on Find My Home.')
            ->action('Start Listing', url('/dashboard'));
    }
    public function toArray(object $notifiable): array { return ['type' => 'kyc_approved', 'auto_approved' => $this->autoApproved, 'message' => 'Your identity has been verified. You can now list properties.']; }
    public function toSms(): string { return "Find My Home: Identity verified! You can now list properties: findmyhome.ug/dashboard"; }
}
