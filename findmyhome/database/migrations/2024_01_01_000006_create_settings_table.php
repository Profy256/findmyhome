<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value');
            $table->string('type')->default('string'); // string, integer, float, boolean
            $table->string('label');                   // human-readable label for admin UI
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // ── Seed default platform settings ───────────────────────────────
        DB::table('settings')->insert([
            [
                'key'         => 'commission_rate',
                'value'       => '5',
                'type'        => 'float',
                'label'       => 'Commission Rate — Individual Sellers (%)',
                'description' => 'Percentage charged on confirmed sales by individual sellers.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'commission_rate_company',
                'value'       => '3',
                'type'        => 'float',
                'label'       => 'Commission Rate — Registered Companies (%)',
                'description' => 'Reduced commission rate for verified registered companies.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'company_free_badge_days',
                'value'       => '30',
                'type'        => 'integer',
                'label'       => 'Company Free Blue Badge Days',
                'description' => 'How many days of free Blue Badge a company gets on verification.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'company_free_featured_slots',
                'value'       => '2',
                'type'        => 'integer',
                'label'       => 'Company Free Featured Listing Slots',
                'description' => 'Number of free featured listing credits given to a company on verification.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'commission_block_threshold',
                'value'       => '3',
                'type'        => 'integer',
                'label'       => 'Block After N Unpaid Commissions',
                'description' => 'How many unpaid commissions a seller can have before their account is blocked.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'commission_due_days',
                'value'       => '14',
                'type'        => 'integer',
                'label'       => 'Commission Due Days',
                'description' => 'Number of days after a confirmed sale before commission payment is due.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'commission_reminder_1_days',
                'value'       => '0',
                'type'        => 'integer',
                'label'       => 'First Reminder (days after due date)',
                'description' => 'Days after due date to send the first payment reminder.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'commission_reminder_2_days',
                'value'       => '7',
                'type'        => 'integer',
                'label'       => 'Second Reminder (days after due date)',
                'description' => 'Days after due date to send the second (urgent) payment reminder.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'commission_reminder_3_days',
                'value'       => '14',
                'type'        => 'integer',
                'label'       => 'Third Reminder / Final Warning (days after due date)',
                'description' => 'Days after due date to send the final warning.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'booking_fee_rate',
                'value'       => '7',
                'type'        => 'float',
                'label'       => 'Booking Service Fee (%)',
                'description' => 'Percentage charged on each online rental booking.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'key'         => 'blue_badge_price',
                'value'       => '300000',
                'type'        => 'integer',
                'label'       => 'Blue Badge Annual Price (UGX)',
                'description' => 'Annual cost of the Blue Badge subscription in Uganda Shillings.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
