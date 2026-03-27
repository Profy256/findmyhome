<?php

namespace Database\Seeders;

use App\Models\{User, Property, Lead, Rating, Setting, KycDocument};
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Admin ─────────────────────────────────────────────────────────────
        User::create([
            'name'       => 'Find My Home Admin',
            'email'      => 'admin@findmyhome.ug',
            'phone'      => '+256700000000',
            'password'   => Hash::make('Admin@2024!'),
            'role'       => 'admin',
            'kyc_status' => 'verified',
        ]);

        // ── Verified Company — all categories ─────────────────────────────────
        $company = User::create([
            'name'                    => 'James Ssali',
            'company_name'            => 'Prime Estates Uganda',
            'email'                   => 'info@primeestates.ug',
            'phone'                   => '+256772100001',
            'password'                => Hash::make('Seller@2024!'),
            'role'                    => 'company',
            'kyc_status'              => 'verified',
            'registration_number'     => 'URSB/2019/001234',
            'seller_categories'       => json_encode(['land', 'apartment', 'house_rent', 'short_stay', 'lodge']),
            'blue_badge'              => true,
            'blue_badge_expires_at'   => now()->addDays(30),
            'booking_enabled'         => true,
            'free_featured_slots'     => 2,
            'commission_rate_override'=> 3.0,
        ]);

        // ── Individual land seller — strictest level ───────────────────────────
        $landSeller = User::create([
            'name'              => 'Grace Namukasa',
            'email'             => 'grace.namukasa@gmail.com',
            'phone'             => '+256701200002',
            'password'          => Hash::make('Seller@2024!'),
            'role'              => 'seller',
            'kyc_status'        => 'verified',
            'seller_categories' => json_encode(['land']),
        ]);

        // ── Short stay host — lightest level ──────────────────────────────────
        $shortStayHost = User::create([
            'name'              => 'Kevin Ochieng',
            'email'             => 'kevin.ochieng@gmail.com',
            'phone'             => '+256782400003',
            'password'          => Hash::make('Seller@2024!'),
            'role'              => 'seller',
            'kyc_status'        => 'verified',
            'seller_categories' => json_encode(['short_stay', 'lodge']),
            'booking_enabled'   => true,
        ]);

        // ── Multi-category seller — land + house rent ─────────────────────────
        // KYC assessed at land level (95%) because land is strictest
        $multiSeller = User::create([
            'name'              => 'Sarah Atim',
            'email'             => 'sarah.atim@gmail.com',
            'phone'             => '+256703500004',
            'password'          => Hash::make('Seller@2024!'),
            'role'              => 'seller',
            'kyc_status'        => 'verified',
            'seller_categories' => json_encode(['land', 'house_rent']),
        ]);

        // ── Pending seller — apartment ────────────────────────────────────────
        $pending = User::create([
            'name'              => 'David Mukasa',
            'email'             => 'david.mukasa@gmail.com',
            'phone'             => '+256782300005',
            'password'          => Hash::make('Seller@2024!'),
            'role'              => 'seller',
            'kyc_status'        => 'pending',
            'seller_categories' => json_encode(['apartment']),
        ]);

        KycDocument::create([
            'user_id'              => $pending->id,
            'document_type'        => 'national_id',
            'file_url'             => 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            'cloudinary_public_id' => 'kyc/sample_id',
            'status'               => 'pending',
            'ai_confidence_score'  => 72, // Below 90 (apartment threshold) — flagged for review
            'review_note'          => 'AI confidence 72%. Apartment threshold is 90%. Manual review required.',
        ]);

        // ── Buyers ────────────────────────────────────────────────────────────
        $buyers = [];
        foreach ([
            ['Peter Ochieng',  'peter.ochieng@gmail.com',   '+256754400006'],
            ['Fatuma Nakato',  'fatuma.nakato@gmail.com',   '+256702700007'],
            ['Ivan Tumwine',   'ivan.tumwine@gmail.com',    '+256786800008'],
        ] as [$name, $email, $phone]) {
            $buyers[] = User::create([
                'name' => $name, 'email' => $email, 'phone' => $phone,
                'password' => Hash::make('Buyer@2024!'), 'role' => 'buyer',
            ]);
        }

        // ── Properties ────────────────────────────────────────────────────────

        // Company — house for sale
        $p1 = Property::create([
            'seller_id' => $company->id, 'title' => '3 Bedroom House — Kira Road',
            'description' => 'Beautiful family home in Kira. Open-plan living, modern kitchen, master en-suite, private garden.',
            'price' => 180000000, 'location' => 'Kira Road, Kira', 'district' => 'Wakiso',
            'property_type' => 'house_sale', 'listing_type' => 'sale',
            'bedrooms' => 3, 'bathrooms' => 2, 'size' => '200 sqm',
            'status' => 'active', 'featured' => true,
            'photos' => json_encode(['https://res.cloudinary.com/demo/image/upload/sample.jpg']),
        ]);

        // Company — apartment for sale
        $p2 = Property::create([
            'seller_id' => $company->id, 'title' => '2 Bedroom Apartment — Kololo',
            'description' => 'Modern apartment in prime Kololo. Fully tiled, fitted kitchen, secure parking.',
            'price' => 85000000, 'location' => 'Kololo Hill, Kampala', 'district' => 'Kampala',
            'property_type' => 'apartment', 'listing_type' => 'sale',
            'bedrooms' => 2, 'bathrooms' => 1, 'size' => '95 sqm',
            'status' => 'active', 'featured' => false,
            'photos' => json_encode(['https://res.cloudinary.com/demo/image/upload/sample.jpg']),
        ]);

        // Company — short stay (AirBnB)
        $p3 = Property::create([
            'seller_id' => $company->id, 'title' => 'Luxury 2BR Short Stay — Ntinda',
            'description' => 'Fully furnished apartment for daily/weekly stays. DSTV, WiFi, hot water, parking. Perfect for business travelers.',
            'price' => 150000, 'location' => 'Ntinda View, Kampala', 'district' => 'Kampala',
            'property_type' => 'short_stay', 'listing_type' => 'short_stay',
            'bedrooms' => 2, 'bathrooms' => 1, 'max_guests' => 4,
            'amenities' => json_encode(['WiFi', 'DSTV', 'Hot Water', 'Parking', 'Kitchen', 'Security']),
            'status' => 'active', 'featured' => true,
            'photos' => json_encode(['https://res.cloudinary.com/demo/image/upload/sample.jpg']),
        ]);

        // Short stay host — lodge
        $p4 = Property::create([
            'seller_id' => $shortStayHost->id, 'title' => 'Sunset Lodge — Entebbe',
            'description' => 'Serene lodge near Entebbe airport. Garden, pool access, breakfast available. Daily rates from 250,000 UGX.',
            'price' => 250000, 'location' => 'Garuga, Entebbe', 'district' => 'Wakiso',
            'property_type' => 'lodge', 'listing_type' => 'short_stay',
            'bedrooms' => 1, 'bathrooms' => 1, 'max_guests' => 2,
            'amenities' => json_encode(['Breakfast', 'Garden', 'Pool Access', 'Airport Transfer', 'WiFi']),
            'status' => 'active', 'featured' => false,
            'photos' => json_encode(['https://res.cloudinary.com/demo/image/upload/sample.jpg']),
        ]);

        // Individual land seller — with land title (required)
        $p5 = Property::create([
            'seller_id' => $landSeller->id, 'title' => 'Half Acre Land Plot — Entebbe Road',
            'description' => 'Flat surveyed plot. Clean freehold title. Electricity nearby. Easy road access.',
            'price' => 45000000, 'location' => 'Entebbe Road, Km 18', 'district' => 'Wakiso',
            'property_type' => 'land', 'listing_type' => 'sale',
            'size' => '50 decimals', 'status' => 'active',
            'land_title_url' => 'https://res.cloudinary.com/demo/image/upload/sample.pdf',
            'land_title_lat' => 0.3127, 'land_title_lng' => 32.4951, 'land_title_verified' => true,
            'photos' => json_encode(['https://res.cloudinary.com/demo/image/upload/sample.jpg']),
        ]);

        // Multi-category seller — house for rent
        $p6 = Property::create([
            'seller_id' => $multiSeller->id, 'title' => '3 Bedroom House for Rent — Najjera',
            'description' => 'Spacious house in quiet Najjera. Compound, garage, borehole. Available immediately.',
            'price' => 1500000, 'location' => 'Najjera, Kira', 'district' => 'Wakiso',
            'property_type' => 'house_rent', 'listing_type' => 'rent',
            'bedrooms' => 3, 'bathrooms' => 2, 'size' => '180 sqm',
            'status' => 'active', 'featured' => false,
            'photos' => json_encode(['https://res.cloudinary.com/demo/image/upload/sample.jpg']),
        ]);

        // ── Leads ─────────────────────────────────────────────────────────────
        foreach ([
            [$buyers[0], $company,       $p1, 'whatsapp'],
            [$buyers[1], $company,       $p3, 'platform'],
            [$buyers[2], $company,       $p2, 'whatsapp'],
            [$buyers[0], $landSeller,    $p5, 'whatsapp'],
            [$buyers[1], $shortStayHost, $p4, 'platform'],
        ] as [$buyer, $seller, $property, $method]) {
            Lead::create([
                'buyer_id' => $buyer->id, 'seller_id' => $seller->id,
                'property_id' => $property->id, 'contact_method' => $method,
                'seller_notified' => true, 'notified_at' => now()->subHours(rand(1, 48)),
            ]);
        }

        // ── Ratings ───────────────────────────────────────────────────────────
        Rating::create([
            'buyer_id' => $buyers[0]->id, 'seller_id' => $company->id,
            'property_id' => $p1->id, 'stars' => 5,
            'review' => 'Excellent seller. James was professional and responsive. Property matched the photos exactly.',
        ]);
        Rating::create([
            'buyer_id' => $buyers[1]->id, 'seller_id' => $company->id,
            'property_id' => $p3->id, 'stars' => 5,
            'review' => 'The short stay apartment was perfect. Clean, exactly as described. Will book again.',
        ]);
        Rating::create([
            'buyer_id' => $buyers[2]->id, 'seller_id' => $company->id,
            'property_id' => $p2->id, 'stars' => 4,
            'review' => 'Good experience. Apartment was clean and well maintained.',
        ]);
        Rating::create([
            'buyer_id' => $buyers[0]->id, 'seller_id' => $landSeller->id,
            'property_id' => $p5->id, 'stars' => 5,
            'review' => 'Grace was very honest. The land title was genuine and GPS coordinates were exactly right.',
        ]);
        Rating::create([
            'buyer_id' => $buyers[1]->id, 'seller_id' => $shortStayHost->id,
            'property_id' => $p4->id, 'stars' => 4,
            'review' => 'Lovely lodge near the lake. Kevin was helpful. Great value for the price.',
        ]);

        $this->command->info('');
        $this->command->info('✅ Find My Home database seeded.');
        $this->command->info('');
        $this->command->info('Test accounts:');
        $this->command->info('  Admin:             admin@findmyhome.ug        / Admin@2024!');
        $this->command->info('  Company (all cats):info@primeestates.ug       / Seller@2024!');
        $this->command->info('  Land seller:       grace.namukasa@gmail.com   / Seller@2024!');
        $this->command->info('  Short stay host:   kevin.ochieng@gmail.com    / Seller@2024!');
        $this->command->info('  Multi-cat seller:  sarah.atim@gmail.com       / Seller@2024!');
        $this->command->info('  Buyer:             peter.ochieng@gmail.com    / Buyer@2024!');
        $this->command->info('');
        $this->command->info('KYC thresholds by category:');
        $this->command->info('  Land         → 95%  (strictest)');
        $this->command->info('  Apartment    → 90%  (moderate)');
        $this->command->info('  House Rent   → 80%  (light)');
        $this->command->info('  Short Stay   → 80%  (light)');
        $this->command->info('  Lodge        → 80%  (light)');
    }
}
