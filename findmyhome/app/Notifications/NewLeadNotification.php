<?php
namespace App\Notifications;
use App\Models\{Lead, Property, User};
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class NewLeadNotification extends Notification
{
    use Queueable;
    public function __construct(public Lead $lead, public Property $property, public User $buyer) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        $method = $this->lead->contact_method === 'whatsapp' ? 'WhatsApp' : 'Find My Home platform';
        return (new MailMessage)
            ->subject($this->lead->contact_method === 'whatsapp' ? "💬 New WhatsApp Enquiry — {$this->property->title}" : "📩 New Enquiry — {$this->property->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("New enquiry from **{$this->buyer->name}** via {$method}.")
            ->line("**Property:** {$this->property->title}")
            ->line("**Buyer phone:** {$this->buyer->phone}")
            ->action('View Dashboard', url('/dashboard/leads'));
    }
    public function toArray(object $notifiable): array
    {
        return ['type' => 'new_lead', 'contact_method' => $this->lead->contact_method, 'buyer_name' => $this->buyer->name, 'buyer_phone' => $this->buyer->phone, 'property_id' => $this->property->id, 'property_title' => $this->property->title, 'lead_id' => $this->lead->id, 'message' => "{$this->buyer->name} enquired about {$this->property->title} via " . ($this->lead->contact_method === 'whatsapp' ? 'WhatsApp' : 'the platform') . '.'];
    }
    public function toSms(): string { return "Find My Home: New enquiry from {$this->buyer->name} about '{$this->property->title}'. Phone: {$this->buyer->phone}"; }
}
