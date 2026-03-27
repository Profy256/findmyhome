<?php
return [
    'default'  => env('LOG_CHANNEL', 'stack'),
    'channels' => [
        'stack'       => ['driver' => 'stack', 'channels' => ['daily'], 'ignore_exceptions' => false],
        'daily'       => ['driver' => 'daily',  'path' => storage_path('logs/laravel.log'), 'level' => 'debug', 'days' => 14],
        'stderr'      => ['driver' => 'monolog', 'level' => 'debug', 'handler' => Monolog\Handler\StreamHandler::class, 'formatter' => Monolog\Formatter\LineFormatter::class, 'with' => ['stream' => 'php://stderr']],
        // Separate channel for admin audit trail
        'admin_audit' => ['driver' => 'daily',  'path' => storage_path('logs/admin_audit.log'), 'level' => 'info', 'days' => 90],
    ],
];
