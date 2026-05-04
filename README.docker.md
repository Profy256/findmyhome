# Find My Home — Docker Setup

Run the full stack locally with a single command using Docker Compose.

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Mac) or Docker Engine + Compose v2 (Linux)

---

## Quick Start

### 1. Create your environment file
```bash
cp .env.example .env
```
Open `.env` and set at minimum:
```env
DB_PASSWORD=your_strong_password
```

### 2. Launch the stack
```bash
docker compose up --build
```

This starts:
| Service | URL | Container |
|---------|-----|-----------|
| **Go API** | http://localhost:8000 | `findmyhome-api` |
| **Web App** | http://localhost:3000 | `findmyhome-web` |
| **Admin Panel** | http://localhost:3001 | `findmyhome-admin` |
| **PostgreSQL** | `localhost:5432` | `findmyhome-db` |

Health check: `curl http://localhost:8000/api/health`

### 3. Initialize the database
On first run, apply your schema:
```bash
docker compose exec db psql -U postgres -d findmyhome -f /schema.sql
# Or connect and paste SQL manually:
docker compose exec db psql -U postgres findmyhome
```

---

## Common Commands

```bash
# Start in background
docker compose up -d --build

# View all logs
docker compose logs -f

# View API logs only
docker compose logs -f api

# Stop everything (keep DB data)
docker compose down

# Stop and wipe the database volume
docker compose down -v

# Rebuild only the API after code changes
docker compose up --build api

# Open a shell in the API container (distroless — no shell available)
# Use DB container instead for debugging:
docker compose exec db psql -U postgres findmyhome

# Check running containers
docker compose ps
```

---

## Production Notes

- The Go API Dockerfile uses a **multi-stage build**: Go 1.23 alpine builder → distroless static runtime.
- The resulting image is ~20 MB with no shell or OS packages.
- For production, deploy to Render (not Docker Compose). See [`DEPLOY.md`](DEPLOY.md).
- Set `GIN_MODE=release` in production (already the default in `docker-compose.yml`).
