<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kyc_documents', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('user_id');
            $table->enum('document_type', [
                'national_id',
                'passport',
                'drivers_licence',
                'business_registration'
            ]);
            $table->string('file_url');           // Cloudinary private URL
            $table->string('cloudinary_public_id'); // for deletion if needed
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->uuid('reviewed_by')->nullable();   // admin user id (null if auto-reviewed)
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();   // admin or AI note

            // AI analysis fields
            $table->integer('ai_confidence_score')->nullable(); // 0–100
            $table->json('ai_checks')->nullable();              // pass/fail per check
            $table->text('ai_extracted_text')->nullable();      // OCR text snippet
            $table->timestamp('ai_analysed_at')->nullable();
            $table->boolean('ai_auto_decided')->default(false); // true if AI made the final call

            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_documents');
    }
};
