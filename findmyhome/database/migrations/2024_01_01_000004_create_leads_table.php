<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('buyer_id');
            $table->uuid('seller_id');
            $table->uuid('property_id');
            $table->enum('contact_method', ['platform', 'whatsapp']);
            $table->boolean('seller_notified')->default(false);
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->foreign('buyer_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('seller_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('property_id')->references('id')->on('properties')->onDelete('cascade');
            $table->index(['seller_id', 'created_at']);
            $table->index(['buyer_id', 'property_id']);
            $table->index('contact_method');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
