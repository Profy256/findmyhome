<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $primaryKey = 'key';
    public    $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['key', 'value', 'type', 'label', 'description'];

    // ── Get a typed value by key ─────────────────────────────────────────────
    public static function get(string $key, mixed $default = null): mixed
    {
        // Cache settings for 10 minutes to avoid DB hit on every request
        $setting = Cache::remember("setting_{$key}", 600, function () use ($key) {
            return static::find($key);
        });

        if (!$setting) return $default;

        return match ($setting->type) {
            'integer' => (int) $setting->value,
            'float'   => (float) $setting->value,
            'boolean' => filter_var($setting->value, FILTER_VALIDATE_BOOLEAN),
            default   => $setting->value,
        };
    }

    // ── Update a setting and clear its cache ─────────────────────────────────
    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(
            ['key' => $key],
            ['value' => (string) $value]
        );

        // Clear cache so next get() fetches fresh value
        Cache::forget("setting_{$key}");
    }

    // ── Convenience methods for commonly used settings ────────────────────────

    public static function commissionRate(): float
    {
        return static::get('commission_rate', 5.0);
    }

    public static function commissionBlockThreshold(): int
    {
        return static::get('commission_block_threshold', 3);
    }

    public static function commissionDueDays(): int
    {
        return static::get('commission_due_days', 14);
    }

    public static function bookingFeeRate(): float
    {
        return static::get('booking_fee_rate', 7.0);
    }

    public static function blueBadgePrice(): int
    {
        return static::get('blue_badge_price', 300000);
    }
}
