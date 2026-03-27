<?php

return [
    'paths'                    => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'          => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins'          => array_filter([
        env('FRONTEND_URL'),
        'http://localhost:3000',
        'http://localhost:8081',   // Expo dev
        'http://localhost:19006',  // Expo web
        'https://expo.dev',
    ]),
    'allowed_origins_patterns' => [
        '#^https://.*\.vercel\.app$#',
        '#^https://.*\.railway\.app$#',
        '#^exp://.*$#',            // Expo Go deep links
    ],
    'allowed_headers'          => ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    'exposed_headers'          => ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    'max_age'                  => 3600,
    'supports_credentials'     => true,
];
