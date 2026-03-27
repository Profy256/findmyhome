<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Commission extends Model
{
    use HasUuids;

    protected $fillable = [
        'seller_id', 'transaction_id', 'property_price',
        'commission_amount', 'status', 'reminder_count',
        'last_reminded_at', 'due_date', 'paid_at',
    ];

    protected $casts = [
        'last_reminded_at' => 'datetime',
        'paid_at'          => 'datetime',
        'due_date'         => 'date',
        'commission_amount'=> 'integer',
        'property_price'   => 'integer',
    ];

    public function seller()      { return $this->belongsTo(User::class, 'seller_id'); }
    public function transaction() { return $this->belongsTo(Transaction::class); }

    public function isOverdue(): bool
    {
        return $this->due_date->isPast() && $this->status !== 'paid';
    }

    public function markPaid(): void
    {
        $this->update(['status' => 'paid', 'paid_at' => now()]);
        // Full unblock logic handled by CommissionEnforcementService::processPayment()
    }
}
