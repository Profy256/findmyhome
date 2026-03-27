<?php
return [
    'default' => env('CACHE_DRIVER', 'database'),
    'stores'  => [
        'database' => [
            'driver'     => 'database',
            'table'      => 'cache',
            'connection' => null,
            'lock_connection' => null,
        ],
        'array' => ['driver' => 'array', 'serialize' => false],
    ],
    'prefix'  => env('CACHE_PREFIX', 'fmh_cache'),
];
