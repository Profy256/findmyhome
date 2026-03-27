<?php

namespace App\Notifications;

use App\Models\Commission;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class CommissionReminder extends Notification
{
    use Queueable;

    public function __construct(
        public Commission $commission,
        public int $reminderNumber
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database']; // SMS sent separately via AfricasTalking
    }

    public function toMail(object $notifiable): MailMessage
    {
        $amount    = number_format($this->commission->commission_amount);
        $dueDate   = $this->commission->due_date->format('d M Y');
        $isUrgent  = $this->reminderNumber === 2;

        return (new MailMessage)
            ->subject($isUrgent
                ? "⚠️ Urgent: Commission Payment Due — Find My Home"
                : "Commission Payment Reminder — Find My Home")
            ->greeting("Hello {$notifiable->name},")
            ->line($isUrgent
                ? "This is an urgent reminder that your platform commission payment is overdue."
                : "This is a reminder that you have a commission payment due.")
            ->line("**Amount Due:** UGX {$amount}")
            ->line("**Due Date:** {$dueDate}")
            ->line("This commission was generated from a confirmed property sale on Find My Home.")
            ->action('Pay Now', url('/dashboard/commissions'))
            ->line($isUrgent
                ? "⚠️ If payment is not received by your due date, your account will be suspended and all your listings will be hidden from buyers."
                : "Please ensure payment is made by the due date to keep your account and listings active.");
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'              => 'commission_reminder',
            'reminder_number'   => $this->reminderNumber,
            'commission_id'     => $this->commission->id,
            'amount'            => $this->commission->commission_amount,
            'due_date'          => $this->commission->due_date,
            'message'           => "Commission payment reminder #{$this->reminderNumber}: UGX " .
                                   number_format($this->commission->commission_amount) . " due.",
        ];
    }

    // SMS message — called manually from the service via AfricasTalking
    public function toSms(): string
    {
        $amount  = number_format($this->commission->commission_amount);
        $dueDate = $this->commission->due_date->format('d/m/Y');

        if ($this->reminderNumber === 2) {
            return "URGENT - Find My Home: Commission of UGX {$amount} is overdue (due {$dueDate}). " .
                   "Pay now to avoid account suspension. Visit findmyhome.ug/dashboard";
        }

        return "Find My Home: You have a commission payment of UGX {$amount} due by {$dueDate}. " .
               "Log in to pay: findmyhome.ug/dashboard";
    }
}
