<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Rating extends Model
{
    use HasUuids;

    protected $fillable = [
        'buyer_id', 'seller_id', 'property_id',
        'stars', 'review', 'is_visible',
    ];

    protected $casts = [
        'is_visible' => 'boolean',
        'stars'      => 'integer',
    ];

    // ── Relationships ────────────────────────────────────────────────────────

    public function buyer()
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    // ── Scopes ───────────────────────────────────────────────────────────────

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('is_visible', true);
    }
}
