<?php

namespace App\Notifications;

use App\Models\Property;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class DuplicatePropertyDetected extends Notification
{
    use Queueable;

    public function __construct(
        public Property  $newProperty,
        public Property  $existingProperty,
        public int       $score,
        public bool      $isForSeller = false
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->isForSeller) {
            return (new MailMessage)
                ->subject('⚠️ Possible Duplicate Listing Detected — Find My Home')
                ->greeting("Hello {$notifiable->name},")
                ->line("Our system has detected that your listing may be similar to an existing property on Find My Home.")
                ->line("**Your listing:** {$this->newProperty->title}")
                ->line("**Similar listing:** {$this->existingProperty->title} in {$this->existingProperty->location}")
                ->line("If your listing is a unique property, no action is needed. Our admin team will review it shortly.")
                ->line("If this was posted by mistake, please remove it from your dashboard.")
                ->action('View My Listings', url('/dashboard/listings'))
                ->line('Duplicate listings violate our platform policy and may result in listing removal.');
        }

        return (new MailMessage)
            ->subject("🔍 Duplicate Listing Alert — Admin Review Needed")
            ->greeting("Hello {$notifiable->name},")
            ->line("A potential duplicate property listing has been detected.")
            ->line("**New listing:** {$this->newProperty->title} (by {$this->newProperty->seller->name})")
            ->line("**Existing listing:** {$this->existingProperty->title} (by {$this->existingProperty->seller->name})")
            ->line("**Similarity score:** {$this->score}%")
            ->action('Review in Admin Panel', url("/admin/properties/{$this->newProperty->id}"))
            ->line('Please review and approve, freeze, or delete the new listing as appropriate.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'                  => 'duplicate_property',
            'new_property_id'       => $this->newProperty->id,
            'existing_property_id'  => $this->existingProperty->id,
            'score'                 => $this->score,
            'is_for_seller'         => $this->isForSeller,
            'message'               => $this->isForSeller
                ? "Your listing '{$this->newProperty->title}' may be a duplicate. Admin will review it."
                : "Duplicate listing detected: '{$this->newProperty->title}' ({$this->score}% match). Review required.",
        ];
    }
}
