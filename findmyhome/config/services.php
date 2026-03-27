<?php

return [

    // ── Resend (Email) ────────────────────────────────────────────────────────
    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    // ── Africa's Talking (SMS) ────────────────────────────────────────────────
    'africastalking' => [
        'username'  => env('AT_USERNAME'),
        'api_key'   => env('AT_API_KEY'),
        'sender_id' => env('AT_SENDER_ID', 'FindMyHome'),
    ],

    // ── Google Vision (KYC AI analysis) ──────────────────────────────────────
    'google_vision' => [
        'api_key' => env('GOOGLE_VISION_API_KEY'),
    ],

    // ── Cloudinary (file storage) ─────────────────────────────────────────────
    'cloudinary' => [
        'url'        => env('CLOUDINARY_URL'),
        'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
        'api_key'    => env('CLOUDINARY_API_KEY'),
        'api_secret' => env('CLOUDINARY_API_SECRET'),
    ],

    // ── Pesapal (Payments) ────────────────────────────────────────────────────
    'pesapal' => [
        'consumer_key'    => env('PESAPAL_CONSUMER_KEY'),
        'consumer_secret' => env('PESAPAL_CONSUMER_SECRET'),
        'env'             => env('PESAPAL_ENV', 'sandbox'),
        'ipn_url'         => env('PESAPAL_IPN_URL'),
    ],

    // ── Firebase (Push Notifications) ─────────────────────────────────────────
    'firebase' => [
        'credentials'  => env('FIREBASE_CREDENTIALS'),
        'project_id'   => env('FIREBASE_PROJECT_ID'),
    ],

];
