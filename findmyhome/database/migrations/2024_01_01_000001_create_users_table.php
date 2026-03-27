<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->unique();
            $table->string('password');
            $table->enum('role', ['buyer', 'seller', 'company', 'admin'])->default('buyer');
            $table->enum('kyc_status', ['none', 'pending', 'verified', 'rejected', 'blocked'])->default('none');

            // Badge & visibility
            $table->boolean('blue_badge')->default(false);
            $table->timestamp('blue_badge_expires_at')->nullable();

            // Notifications
            $table->string('fcm_token')->nullable();

            // Company-specific fields (null for individuals)
            $table->string('company_name')->nullable();
            $table->string('registration_number')->nullable(); // URSB certificate number

            // ── Seller categories (multi-select on registration) ──────────────
            // Stores JSON array e.g. ["land","apartment","short_stay"]
            // Valid values: land | apartment | house_rent | short_stay | lodge
            // KYC strictness is determined by the strictest category selected.
            // Land = strictest (95%), Apartment = moderate (90%), others = light (80%)
            $table->json('seller_categories')->nullable();

            // Privileges — companies get these on verification, individuals earn them
            $table->boolean('booking_enabled')->default(false);  // online booking access
            $table->integer('free_featured_slots')->default(0);  // free featured listing credits
            $table->decimal('commission_rate_override', 5, 2)->nullable(); // null = use platform default

            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index('role');
            $table->index('kyc_status');
            $table->index('blue_badge');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
