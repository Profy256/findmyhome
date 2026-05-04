# Find My Home — Local Development Setup Guide

Run the full stack locally: **Go API + Next.js Web + Next.js Admin + React Native Mobile**

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Go** | 1.23+ | https://go.dev/dl/ |
| **Node.js** | 18+ | https://nodejs.org |
| **PostgreSQL** | 15+ | https://postgresql.org/download |
| **Git** | Latest | https://git-scm.com |

> **Windows:** Install PostgreSQL via the official installer. Go and Node have simple `.msi` installers.  
> **Mac:** `brew install go node postgresql@15`  
> **Ubuntu/Debian:** `sudo apt install golang-go nodejs npm postgresql-15`

---

## Part 1 — Backend (Go / Gin API)

### Step 1 — Create the PostgreSQL database
```bash
# Using psql
psql -U postgres -c "CREATE DATABASE findmyhome;"

# Or in pgAdmin / DBeaver: create a database named "findmyhome"
```

### Step 2 — Run your schema migrations
Apply your SQL schema to the newly created database:
```bash
psql -U postgres -d findmyhome -f schema.sql
```
> If you don't have a schema file yet, use your DB client to inspect the existing Neon/production database and export the DDL.

### Step 3 — Set environment variables

The Go API reads config from environment variables. For local development, the simplest approach is to export them in your terminal:

**Linux / Mac:**
```bash
export DATABASE_URL="postgres://postgres:your_password@localhost:5432/findmyhome?sslmode=disable"
export FRONTEND_URL="http://localhost:3000"
export PUBLIC_API_URL="http://localhost:8000"
# Optional — Pesapal (leave blank locally, payments will be skipped)
export PESAPAL_CONSUMER_KEY=""
export PESAPAL_CONSUMER_SECRET=""
export PESAPAL_ENV="sandbox"
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL = "postgres://postgres:your_password@localhost:5432/findmyhome?sslmode=disable"
$env:FRONTEND_URL = "http://localhost:3000"
$env:PUBLIC_API_URL = "http://localhost:8000"
```

**Or create a `.env` file and use a tool like `godotenv`** — but plain env exports work fine for local dev.

### Step 4 — Start the API server
```bash
cd findmyhome-go
go run ./cmd/server
```

You should see:
```
2026/05/04 08:00:00 INFO listening addr=:8000
```

Test it:
```bash
curl http://localhost:8000/api/health
# → {"service":"Find My Home API","status":"ok","version":"1.0.0"}
```

### Step 5 — (Optional) Build a binary
```bash
cd findmyhome-go
go build -o findmyhome-api ./cmd/server
./findmyhome-api
```

> **Note:** There is no queue worker or scheduler to run. Unlike the old Laravel backend, the Go API has no background processes — everything is handled synchronously per request.

---

## Part 2 — Web Frontend (Next.js)

### Step 1 — Install dependencies
```bash
cd findmyhome-web
npm install
```

### Step 2 — Create environment file
```bash
cp .env.local.example .env.local
```

### Step 3 — Edit `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```
> Cloudinary is optional locally — photo upload won't work but all other features will.

### Step 4 — Start the dev server
```bash
npm run dev
```
Web app: **http://localhost:3000**

---

## Part 2B — Admin Panel (Next.js)

### Step 1 — Install dependencies
```bash
cd findmyhome-admin
npm install
```

### Step 2 — Ensure `.env.local` exists
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Step 3 — Start the dev server
```bash
npm run dev -- --port 3001
```
Admin panel: **http://localhost:3001**

---

## Part 3 — Mobile App (React Native / Expo)

### Step 1 — Install dependencies
```bash
cd findmyhome-mobile
npm install
```

### Step 2 — Create environment file
```bash
cp .env.example .env
```

### Step 3 — Edit `.env`
```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000/api/v1
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```

> ⚠️ **Use your machine's local IP address, NOT `localhost`.**  
> Your phone and computer must be on the same Wi-Fi network.  
>
> Find your IP:
> - **Mac:** `ipconfig getifaddr en0`
> - **Windows:** `ipconfig` → IPv4 Address (e.g. `192.168.1.5`)
> - **Linux:** `hostname -I`
>
> Example: `EXPO_PUBLIC_API_URL=http://192.168.1.5:8000/api/v1`

### Step 4 — Start Expo
```bash
npx expo start
```

### Step 5 — Run on your phone
1. Install **Expo Go**: [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) | [iOS](https://apps.apple.com/app/expo-go/id982107779)
2. Scan the QR code shown in the terminal

### Alternatives
```bash
npx expo start --android   # Android emulator (requires Android Studio)
npx expo start --ios       # iOS simulator (Mac only, requires Xcode)
```

---

## Running Everything Together

Open **4 terminal windows** (no queue worker needed):

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `findmyhome-go/` | `go run ./cmd/server` |
| 2 | `findmyhome-web/` | `npm run dev` |
| 3 | `findmyhome-admin/` | `npm run dev -- --port 3001` |
| 4 | `findmyhome-mobile/` | `npx expo start` |

| Service | URL |
|---------|-----|
| API Health | http://localhost:8000/api/health |
| API v1 base | http://localhost:8000/api/v1 |
| Web App | http://localhost:3000 |
| Admin Panel | http://localhost:3001 |
| Mobile | Scan QR code in Expo Go |

---

## Option B — Run Everything with Docker

If you'd rather not install Go or PostgreSQL locally, Docker Compose handles everything:

```bash
# From the monorepo root
cp .env.example .env
# Edit .env — set DB_PASSWORD at minimum

docker compose up --build
```

Services start on the same ports as above. Logs are streamed to the terminal.

To stop:
```bash
docker compose down
# To also delete the database volume:
docker compose down -v
```

---

## Testing the Full Flow Locally

### Test 1 — Health check
```bash
curl http://localhost:8000/api/health
```

### Test 2 — Register a buyer
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Buyer",
    "email": "buyer@test.com",
    "phone": "+256700000001",
    "password": "password123",
    "role": "buyer",
    "terms_agreed": true
  }' | jq .
```

### Test 3 — Login and get token
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@test.com","password":"password123"}' | jq .token
```

### Test 4 — Browse properties
```bash
curl http://localhost:8000/api/v1/properties | jq .
```

### Test 5 — Admin panel
1. Open http://localhost:3001
2. Login as `admin@findmyhome.ug` / `Admin@2024!`
3. Go to **KYC** → approve a pending document
4. Go to **Settings** → adjust commission rate

### Test 6 — Create a land listing (authenticated)
```bash
TOKEN="<paste token from Test 3>"
curl -s -X POST http://localhost:8000/api/v1/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "1 Acre in Wakiso",
    "description": "Flat, clean land with title",
    "price": 45000000,
    "location": "Wakiso",
    "property_type": "land",
    "photos": ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
    "land_title_url": "https://res.cloudinary.com/demo/image/upload/sample.pdf"
  }' | jq .
```

---

## Common Problems & Fixes

### `connect: connection refused` (Go API)
- Make sure PostgreSQL is running
- Check `DATABASE_URL` — password, port, and database name
- Try: `psql postgres://postgres:password@localhost:5432/findmyhome` to test the connection directly

### Go API exits immediately with DB error
```
database connect db: failed to connect to "localhost:5432"...
```
- PostgreSQL isn't running. Start it:
  - **Windows:** Open Services → start `postgresql-x64-15`
  - **Mac:** `brew services start postgresql@15`
  - **Linux:** `sudo systemctl start postgresql`

### `go: command not found`
Install Go from https://go.dev/dl/ and make sure `$GOPATH/bin` is in your `PATH`.

### `npm: command not found`
Install Node.js from https://nodejs.org

### Mobile can't reach API
- Use your machine's LAN IP, not `localhost`
- Make sure the Go server is listening on `0.0.0.0` — it does by default on `ADDR=:8000`
- Check your firewall allows port 8000

### Port 8000 already in use
```bash
# Linux/Mac
ADDR=:8080 go run ./cmd/server

# Windows PowerShell
$env:ADDR=":8080"; go run ./cmd/server
```
Then update `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1` in the frontend `.env.local`.

### CORS errors in browser
Make sure `FRONTEND_URL` is set to exactly the origin the browser is using (e.g. `http://localhost:3000`). The Go API uses this value for CORS headers.

---

## Useful Commands

```bash
# Run all Go tests
cd findmyhome-go && go test ./...

# Check the Go binary size
cd findmyhome-go && go build -ldflags="-s -w" -o api ./cmd/server && ls -lh api

# List all API routes (from router.go)
grep -E '(GET|POST|PUT|PATCH|DELETE)' findmyhome-go/internal/api/router.go

# Connect to local DB
psql postgres://postgres:password@localhost:5432/findmyhome

# Inspect personal_access_tokens table (auth tokens)
psql postgres://... -c "SELECT id, tokenable_id, name, created_at FROM personal_access_tokens ORDER BY created_at DESC LIMIT 5;"

# Check properties
psql postgres://... -c "SELECT id, title, status, seller_id FROM properties LIMIT 10;"

# Reset DB (drop + recreate + migrate)
psql -U postgres -c "DROP DATABASE findmyhome;"
psql -U postgres -c "CREATE DATABASE findmyhome;"
psql -U postgres -d findmyhome -f schema.sql
```

---

## Local URLs Summary

| Service | URL |
|---------|-----|
| API Health | http://localhost:8000/api/health |
| API v1 Base | http://localhost:8000/api/v1 |
| Web App | http://localhost:3000 |
| Admin Panel | http://localhost:3001 |
| Mobile | Scan QR in Expo Go |

---

## Ready to Deploy?

Follow [`DEPLOY.md`](DEPLOY.md) to push to **Render + Neon + Vercel**.

Key differences between local and production:
1. `GIN_MODE=release` (already default in the Dockerfile)
2. `DATABASE_URL` must include `?sslmode=require` for Neon
3. `FRONTEND_URL` = your actual Vercel domain
4. Set real Pesapal keys and `PESAPAL_ENV=production` when accepting live payments
