<?php
namespace App\Notifications;
use App\Models\KycDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class KycNeedsReview extends Notification
{
    use Queueable;
    public function __construct(public KycDocument $document, public string $note) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('🔍 KYC Needs Review — Admin')
            ->greeting("Hello {$notifiable->name},")
            ->line("KYC document from **{$this->document->user->name}** requires manual review.")
            ->line("**AI Note:** {$this->note}")
            ->action('Review Document', url("/admin/kyc/{$this->document->id}"));
    }
    public function toArray(object $notifiable): array { return ['type' => 'kyc_needs_review', 'document_id' => $this->document->id, 'seller_name' => $this->document->user->name, 'note' => $this->note, 'message' => "KYC from {$this->document->user->name} needs manual review."]; }
}
