# Find My Home — Docker Documentation

This project is now containerized using Docker and Docker Compose. This ensures a consistent development environment and simplifies production deployment.

## Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2+

## Getting Started

### 1. Environment Files
Ensure you have the following files prepared:
- `findmyhome/.env` (Backend)
- `findmyhome-web/.env.local` (Web)
- `findmyhome-admin/.env.local` (Admin)

The `docker-compose.yml` uses these files for configuration. Note that `DB_HOST` should be set to `db` and `REDIS_HOST` to `redis` when running inside Docker.

### 2. Launch the Stack
Run the following command from the project root:
```bash
docker compose up --build -d
```

This will start:
- **Web App**: http://localhost:3000
- **Admin Panel**: http://localhost:3001
- **API**: http://localhost:8000
- **Database**: PostgreSQL on port 5432
- **Redis**: Port 6379
- **Worker**: Background queue processor
- **Scheduler**: Task scheduler

### 3. Initialize the Database
On the first run, you need to run migrations and seed data:
```bash
docker compose exec api php artisan migrate:fresh --seed
```

### 4. Common Commands

#### View Logs
```bash
docker compose logs -f
```

#### Stop the Stack
```bash
docker compose down
```

#### Run Artisan Commands
```bash
docker compose exec api php artisan [command]
```

## Production Notes
- The Dockerfiles are multi-stage and optimized for production.
- For production, ensure `APP_ENV=production` and `APP_DEBUG=false`.
- The `web` service uses the `standalone` output mode of Next.js for minimal image size.
