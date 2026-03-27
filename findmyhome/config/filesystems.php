<?php

return [
    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root'   => storage_path('app'),
            'throw'  => false,
        ],

        'public' => [
            'driver'     => 'local',
            'root'       => storage_path('app/public'),
            'url'        => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw'      => false,
        ],

        // Cloudinary is handled via the cloudinary-laravel package
        // using CLOUDINARY_URL env variable directly
        // Photos and KYC docs are uploaded via the API from the frontend
        // using signed/unsigned Cloudinary upload presets
    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
