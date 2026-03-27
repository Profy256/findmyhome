<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use App\Models\Setting;

class Transaction extends Model
{
    use HasUuids;

    protected $fillable = [
        'buyer_id', 'seller_id', 'property_id', 'agreed_price',
        'buyer_confirmed', 'seller_confirmed',
        'buyer_confirmed_at', 'seller_confirmed_at', 'completed_at',
    ];

    protected $casts = [
        'buyer_confirmed'    => 'boolean',
        'seller_confirmed'   => 'boolean',
        'buyer_confirmed_at' => 'datetime',
        'seller_confirmed_at'=> 'datetime',
        'completed_at'       => 'datetime',
        'agreed_price'       => 'integer',
    ];

    public function buyer()    { return $this->belongsTo(User::class, 'buyer_id'); }
    public function seller()   { return $this->belongsTo(User::class, 'seller_id'); }
    public function property() { return $this->belongsTo(Property::class); }
    public function commission(){ return $this->hasOne(Commission::class); }

    public function isComplete(): bool
    {
        return $this->buyer_confirmed && $this->seller_confirmed;
    }

    // Called when both parties confirm — marks property sold/rented + creates commission
    public function complete(): void
    {
        $this->update(['completed_at' => now()]);

        $this->property->listing_type === 'sale'
            ? $this->property->markAsSold()
            : $this->property->markAsRented();

        // Use the seller's effective commission rate
        // Companies get a lower rate — individuals use the platform default
        $rate             = $this->seller->effectiveCommissionRate();
        $dueDays          = \App\Models\Setting::commissionDueDays();
        $commissionAmount = (int) round($this->agreed_price * ($rate / 100));

        Commission::create([
            'seller_id'         => $this->seller_id,
            'transaction_id'    => $this->id,
            'property_price'    => $this->agreed_price,
            'commission_amount' => $commissionAmount,
            'due_date'          => now()->addDays($dueDays)->toDateString(),
        ]);
    }
}
