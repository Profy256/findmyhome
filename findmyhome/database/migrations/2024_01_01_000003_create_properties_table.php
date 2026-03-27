<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('seller_id');
            $table->string('title');
            $table->text('description');
            $table->bigInteger('price'); // in UGX
            $table->string('location');
            $table->string('district')->nullable();

            // ── Property types ────────────────────────────────────────────────
            // land        — plot of land for sale
            // apartment   — apartment for sale or rent (moderate KYC)
            // house_rent  — house available for long-term rent (light KYC)
            // short_stay  — "AirBnB" as known in Uganda — daily/weekly stays (light KYC)
            // lodge       — guest house / lodge for short stays (light KYC)
            // house_sale  — house for outright purchase
            // commercial  — commercial property
            $table->enum('property_type', [
                'land',
                'apartment',
                'rental',
                'house',
                'airbnb',
                'lodge',
                'commercial',
            ]);

            $table->enum('listing_type', ['sale', 'rent', 'short_stay']);

            $table->integer('bedrooms')->nullable();
            $table->integer('bathrooms')->nullable();
            $table->string('size')->nullable();
            $table->json('photos')->nullable();
            $table->json('amenities')->nullable(); // for short_stay and lodge

            // Short stay specific
            $table->integer('max_guests')->nullable();        // for short_stay / lodge
            $table->decimal('price_per_night', 12, 2)->nullable(); // alternative to 'price' for short stay

            $table->enum('status', ['draft', 'active', 'frozen', 'sold', 'rented'])->default('draft');
            $table->boolean('featured')->default(false);
            $table->timestamp('featured_until')->nullable();

            // ── Land title fields — individual sellers MUST upload, companies exempt ──
            $table->string('land_title_url')->nullable();
            $table->string('land_title_cloudinary_id')->nullable();
            $table->decimal('land_title_lat', 10, 7)->nullable();
            $table->decimal('land_title_lng', 10, 7)->nullable();
            $table->boolean('land_title_verified')->default(false);

            $table->timestamps();
            $table->softDeletes();

            $table->foreign('seller_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['status', 'listing_type']);
            $table->index(['property_type', 'status']);
            $table->index('district');
            $table->index('price');
            $table->index('featured');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
