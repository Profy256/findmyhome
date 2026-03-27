<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── RATINGS ───────────────────────────────────────────────────────────
        // Only buyers can rate sellers. One rating per buyer per seller.
        // Reviews are public — other buyers can read them before contacting a seller.
        Schema::create('ratings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('buyer_id');
            $table->uuid('seller_id');
            $table->uuid('property_id')->nullable(); // which property the interaction was about
            $table->tinyInteger('stars');             // 1–5
            $table->text('review')->nullable();       // optional written review
            $table->boolean('is_visible')->default(true); // admin can hide
            $table->timestamps();

            $table->foreign('buyer_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('seller_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('property_id')->references('id')->on('properties')->onDelete('set null');

            // One review per buyer per seller
            $table->unique(['buyer_id', 'seller_id']);

            $table->index(['seller_id', 'is_visible']);
            $table->index('buyer_id');
        });

        // ── BOOKINGS ──────────────────────────────────────────────────────────
        Schema::create('bookings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('buyer_id');
            $table->uuid('property_id');
            $table->date('checkin_date');
            $table->date('checkout_date');
            $table->integer('guests')->default(1);
            $table->bigInteger('total_price');
            $table->bigInteger('platform_fee');
            $table->enum('status', [
                'pending', 'confirmed', 'rejected', 'completed', 'cancelled'
            ])->default('pending');
            $table->string('pesapal_order_id')->nullable();
            $table->string('pesapal_tracking_id')->nullable();
            $table->enum('payment_status', ['unpaid', 'paid', 'refunded'])->default('unpaid');
            $table->timestamps();

            $table->foreign('buyer_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('property_id')->references('id')->on('properties')->onDelete('cascade');
            $table->index(['property_id', 'status']);
            $table->index('buyer_id');
        });

        // ── TRANSACTIONS ──────────────────────────────────────────────────────
        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('buyer_id');
            $table->uuid('seller_id');
            $table->uuid('property_id');
            $table->bigInteger('agreed_price');
            $table->boolean('buyer_confirmed')->default(false);
            $table->boolean('seller_confirmed')->default(false);
            $table->timestamp('buyer_confirmed_at')->nullable();
            $table->timestamp('seller_confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('buyer_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('seller_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('property_id')->references('id')->on('properties')->onDelete('cascade');
            $table->index(['seller_id', 'completed_at']);
        });

        // ── COMMISSIONS ───────────────────────────────────────────────────────
        Schema::create('commissions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('seller_id');
            $table->uuid('transaction_id');
            $table->bigInteger('property_price');
            $table->bigInteger('commission_amount');
            $table->enum('status', ['pending', 'reminded', 'overdue', 'paid'])->default('pending');
            $table->integer('reminder_count')->default(0);
            $table->timestamp('last_reminded_at')->nullable();
            $table->date('due_date');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->foreign('seller_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('transaction_id')->references('id')->on('transactions')->onDelete('cascade');
            $table->index(['seller_id', 'status']);
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commissions');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('ratings');
    }
};
