<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiting\Limit;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // ── Rate limiting ──────────────────────────────────────────────────────
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('kyc', function (Request $request) {
            return Limit::perHour(5)->by($request->user()?->id ?: $request->ip());
        });

        // ── Security: Force HTTPS in production ───────────────────────────────
        if (config('app.env') === 'production') {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }

        // ── Security: Log slow queries (>1s) in production ───────────────────
        if (config('app.env') === 'production') {
            DB::listen(function ($query) {
                if ($query->time > 1000) {
                    Log::warning('Slow query detected', [
                        'sql'      => $query->sql,
                        'bindings' => $query->bindings,
                        'time_ms'  => $query->time,
                    ]);
                }
            });
        }
    }
}
