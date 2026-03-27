<?php
namespace App\Notifications;
use App\Models\KycDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class KycRejected extends Notification
{
    use Queueable;
    public function __construct(public KycDocument $document, public string $reason, public bool $autoRejected = false) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('❌ Identity Verification Failed — Find My Home')
            ->greeting("Hello {$notifiable->name},")
            ->line("Verification failed. **Reason:** {$this->reason}")
            ->line('Please resubmit a clear, well-lit photo of your document.')
            ->action('Resubmit Documents', url('/dashboard/kyc'));
    }
    public function toArray(object $notifiable): array { return ['type' => 'kyc_rejected', 'reason' => $this->reason, 'message' => "Identity verification failed: {$this->reason}"]; }
    public function toSms(): string { return "Find My Home: KYC verification failed. Please resubmit: findmyhome.ug/dashboard/kyc"; }
}
