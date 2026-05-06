# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

FindMyHome is a real estate marketplace monorepo for Uganda. It consists of four sub-projects that share a single Go/PostgreSQL backend:

| Directory | Stack | Purpose |
|---|---|---|
| `findmyhome-go/` | Go 1.23+, Gin, pgx/v5 | REST API backend, deployed on Render |
| `findmyhome-web/` | Next.js 14 App Router, Zustand, React Query | Buyer/seller web app, deployed on Vercel |
| `findmyhome-admin/` | Next.js 14 App Router, Zustand, React Query | Admin panel, deployed on Vercel |
| `findmyhome-mobile/` | React Native 0.74, Expo 51, Expo Router | Mobile app, built via EAS |

---

## Development Commands

### Backend (Go)
```bash
cd findmyhome-go
go run ./cmd/server          # Start dev server on :8000
go build -o findmyhome-api ./cmd/server   # Build binary
go test ./...                # Run all tests
go test ./internal/api/...   # Run tests in a specific package
```

### Web frontend
```bash
cd findmyhome-web
npm run dev                  # Dev server on localhost:3000
npm run build                # Production build
npm run lint                 # ESLint via next lint
```

### Admin panel
```bash
cd findmyhome-admin
npm run dev -- --port 3001   # Dev server on localhost:3001
npm run build
npm run lint
```

### Mobile
```bash
cd findmyhome-mobile
npx expo start               # Dev with QR code for Expo Go
npx expo start --android     # Android emulator
npm run build:android        # EAS production APK
```

### Full stack (Docker)
```bash
cp .env.example .env
docker compose up --build    # Starts db:5432, api:8000, web:3000, admin:3001
```

---

## Environment Setup

Copy `.env.example` to `.env` for Docker Compose. For individual services, use `.env.local` (web/admin) or export vars directly.

Key variables for local dev:
- `DATABASE_URL` — PostgreSQL connection string
- `FRONTEND_URL` — CORS allowlist (e.g., `http://localhost:3000`)
- `NEXT_PUBLIC_API_URL` — Points web/admin to the Go API (default: `http://localhost:8000/api/v1`)
- `EXPO_PUBLIC_API_URL` — Must use machine IP, not `localhost` (e.g., `http://192.168.1.5:8000/api/v1`)

---

## Architecture

### Authentication
Token format is Laravel Sanctum-compatible: `id|secret` (e.g., `123|abc...xyz`). The token ID and SHA-256 hash of the secret are stored in the `personal_access_tokens` table — the plain secret is never persisted.

**Flow:**
1. Login/register returns `{ token, user }`.
2. Web/admin store it in Zustand + `localStorage` (keys: `fmh_token`, `fmh_user`).
3. Axios request interceptor attaches `Authorization: Bearer <token>` on every request.
4. Axios response interceptor catches 401 → calls `clearAuth()` → redirects to `/auth/login`.
5. Go middleware (`bearerAuth()`) splits the token, fetches the hash from DB, and stores the resolved user in the Gin context.

### Role-Based Access Control
Roles: `buyer`, `seller`, `company`, `admin`.

Middleware chain in `findmyhome-go/internal/api/`:
- `bearerAuth()` — validates token, sets user in context
- `verifiedSeller()` — requires `kyc_status = verified`
- `sellerActive()` — blocks sellers with overdue commissions
- `adminOnly()` — restricts to `role = admin`

Sellers must complete KYC before listing. Sellers with unpaid commissions past the configured threshold are auto-blocked.

### API Structure
All routes under `/api/v1`. The Go router in `internal/api/router.go` is the authoritative route list.

The web and admin frontends call the API through typed namespaces in `src/lib/api.ts`:
- `authApi`, `propertiesApi`, `kycApi`, `ratingsApi`, `bookingsApi`, `notificationsApi`, `adminApi`

### Go Backend Layout
```
findmyhome-go/internal/
├── api/       Gin handlers, router, middleware
├── auth/      Token validation logic
├── config/    Env-based config struct (no config files)
├── db/        pgxpool connection
├── model/     Domain structs
├── repo/      Shared DB helpers
├── response/  Pagination struct
└── seller/    KYC category rules, business validations
```

### Frontend State
Both web and admin use **Zustand** for auth state with `persist` middleware. The store (`src/lib/store.ts`) exposes `setAuth()`, `clearAuth()`, `isAuthenticated()`, `isAdmin()`, `isSeller()`, `isVerified()`.

Data fetching uses **TanStack Query v5**. Forms use **React Hook Form + Zod**.

### Image & Document Storage
Two Cloudinary upload presets:
- `findmyhome_photos` (unsigned) — public property photos
- `findmyhome_kyc` (signed/private) — KYC documents; backend generates signed upload URLs with time limits; these URLs are never exposed publicly

### Payment Flow
Bookings use Pesapal hosted payments. The backend creates a booking with `payment_status=unpaid`, returns a Pesapal payment URL, and confirms the booking via an IPN webhook at `POST /api/payments/ipn`. A 7% platform commission is auto-deducted.

---

## External Integrations
- **Cloudinary** — property photos + private KYC docs
- **Pesapal** — booking payments (supports `sandbox`/`production` via `PESAPAL_ENV`)
- **Resend** — transactional email
- **Africa's Talking** — SMS notifications
- **Google Vision** — KYC AI auto-verification
