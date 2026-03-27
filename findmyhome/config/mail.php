<?php
return [
    'default'  => env('MAIL_MAILER', 'resend'),
    'mailers'  => [
        'resend' => [
            'transport' => 'resend',
        ],
        'log' => [
            'transport' => 'log',
            'channel'   => env('MAIL_LOG_CHANNEL'),
        ],
    ],
    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'hello@findmyhome.ug'),
        'name'    => env('MAIL_FROM_NAME', 'Find My Home'),
    ],
];
