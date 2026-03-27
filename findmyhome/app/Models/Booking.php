<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasUuids;

    protected $fillable = [
        'buyer_id', 'property_id', 'checkin_date', 'checkout_date',
        'guests', 'total_price', 'platform_fee', 'status',
        'pesapal_order_id', 'pesapal_tracking_id', 'payment_status',
    ];

    protected $casts = [
        'checkin_date'  => 'date',
        'checkout_date' => 'date',
        'total_price'   => 'integer',
        'platform_fee'  => 'integer',
    ];

    public function buyer()    { return $this->belongsTo(User::class, 'buyer_id'); }
    public function property() { return $this->belongsTo(Property::class); }

    public function nights(): int
    {
        return $this->checkin_date->diffInDays($this->checkout_date);
    }
}
