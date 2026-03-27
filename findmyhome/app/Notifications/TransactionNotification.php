<?php
namespace App\Notifications;
use App\Models\Transaction;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class TransactionNotification extends Notification
{
    use Queueable;
    public function __construct(public Transaction $transaction, public string $event) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        $property = $this->transaction->property;
        if ($this->event === 'completed') {
            $type = $property->listing_type === 'sale' ? 'sold' : 'rented';
            return (new MailMessage)
                ->subject("✅ Transaction Completed — {$property->title}")
                ->greeting("Hello {$notifiable->name},")
                ->line("Transaction completed for **{$property->title}**. Marked as **{$type}**.")
                ->line("**Agreed Price:** UGX " . number_format($this->transaction->agreed_price))
                ->action('View Dashboard', url('/dashboard/transactions'));
        }
        return (new MailMessage)
            ->subject("⏳ Confirmation Needed — {$property->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("Please confirm the transaction for **{$property->title}**.")
            ->line("**Agreed Price:** UGX " . number_format($this->transaction->agreed_price))
            ->action('Confirm Transaction', url('/dashboard/transactions'));
    }
    public function toArray(object $notifiable): array
    {
        return ['type' => 'transaction_' . $this->event, 'transaction_id' => $this->transaction->id, 'property_title' => $this->transaction->property->title, 'agreed_price' => $this->transaction->agreed_price, 'message' => $this->event === 'completed' ? "Transaction completed for {$this->transaction->property->title}." : "Please confirm the transaction for {$this->transaction->property->title}."];
    }
}
