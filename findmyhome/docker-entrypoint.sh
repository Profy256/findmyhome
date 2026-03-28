#!/bin/sh
set -e

# Run migrations if necessary
# php artisan migrate --force

# Link storage
php artisan storage:link --force

# Cache configuration, routes, and views for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

exec "$@"
