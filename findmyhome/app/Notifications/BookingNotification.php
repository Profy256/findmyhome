<?php
namespace App\Notifications;
use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class BookingNotification extends Notification
{
    use Queueable;
    public function __construct(public Booking $booking, public string $event, public ?string $reason = null) {}
    public function via(object $notifiable): array { return ['mail', 'database']; }
    public function toMail(object $notifiable): MailMessage
    {
        $property = $this->booking->property;
        $subjects = ['new_request' => "📅 New Booking Request — {$property->title}", 'confirmed' => "✅ Booking Confirmed — {$property->title}", 'rejected' => "❌ Booking Declined — {$property->title}", 'completed' => "🏁 Booking Completed — {$property->title}"];
        $mail = (new MailMessage)->subject($subjects[$this->event] ?? "Booking Update")->greeting("Hello {$notifiable->name},");
        match($this->event) {
            'new_request' => $mail->line("New booking request for **{$property->title}**.") ->line("Check-in: {$this->booking->checkin_date} · Check-out: {$this->booking->checkout_date}")->action('Manage Bookings', url('/dashboard/bookings')),
            'confirmed'   => $mail->line("Your booking for **{$property->title}** is confirmed!")->action('View Booking', url('/dashboard/bookings')),
            'rejected'    => $mail->line("Your booking for **{$property->title}** was not accepted.")->line($this->reason ? "Reason: {$this->reason}" : '')->action('Browse Properties', url('/search')),
            'completed'   => $mail->line("Your stay at **{$property->title}** is complete. Leave a review?")->action('Leave a Review', url("/sellers/{$property->seller_id}")),
            default       => $mail->line("Your booking status has been updated."),
        };
        return $mail;
    }
    public function toArray(object $notifiable): array
    {
        return ['type' => 'booking_' . $this->event, 'booking_id' => $this->booking->id, 'property' => $this->booking->property->title, 'message' => match($this->event) { 'new_request' => "New booking request for {$this->booking->property->title}.", 'confirmed' => "Your booking for {$this->booking->property->title} is confirmed.", 'rejected' => "Your booking for {$this->booking->property->title} was declined.", default => "Booking update for {$this->booking->property->title}." }];
    }
}
