<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    use HasUuids;

    protected $fillable = [
        'buyer_id', 'seller_id', 'property_id',
        'contact_method', 'seller_notified', 'notified_at',
    ];

    protected $casts = [
        'seller_notified' => 'boolean',
        'notified_at'     => 'datetime',
    ];

    public function buyer()    { return $this->belongsTo(User::class, 'buyer_id'); }
    public function seller()   { return $this->belongsTo(User::class, 'seller_id'); }
    public function property() { return $this->belongsTo(Property::class); }
}
