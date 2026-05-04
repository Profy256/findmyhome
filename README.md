# Find My Home — Platform Documentation

Welcome to **Find My Home** — a production-ready real-estate marketplace for Uganda.

> Deployment guides: [Render + Neon + Vercel](DEPLOY.md) · [Docker (local)](README.docker.md)

---

## 🏗️ Architecture Overview

Find My Home is a full-stack platform with four main components:

| Component | Tech | Hosts on |
|---|---|---|
| **Backend API** | Go 1.23 + Gin | Render (Web Service) |
| **Web Frontend** | Next.js 14 | Vercel |
| **Admin Panel** | Next.js 14 | Vercel |
| **Mobile App** | React Native / Expo | Expo EAS |
| **Database** | PostgreSQL | Neon (serverless Postgres) |

### Infrastructure Diagram
```mermaid
graph TD;
    Web["Next.js Web (Vercel)"]    --> API["Go/Gin API (Render)"];
    Admin["Next.js Admin (Vercel)"] --> API;
    Mobile["React Native (Expo)"]   --> API;
    API --> DB[("Neon PostgreSQL")];
    API --> Cloudinary["Cloudinary: Photos & KYC"];
    API --> Pesapal["Pesapal: Payments"];
```

---

## ✨ Key Features

### User Roles
| Role | Capabilities |
|---|---|
| **Buyer** | Browse listings, send enquiries, WhatsApp contact, book short stays |
| **Individual Seller** | List properties after KYC. Land listings require a title document |
| **Company** | Registered agencies. Get a verified Blue Badge on KYC approval |
| **Admin** | Full platform control — KYC approvals, user management, commissions |

### Core Workflows

#### KYC (Know Your Customer)
Sellers must upload an identity document (national ID for individuals, business certificate for companies). The admin reviews and approves/rejects through the Admin Panel. On approval:
- `kyc_status` is set to `verified`
- Companies receive a **Blue Badge** with an expiry date

#### Property Listings
- **Land** — requires land title upload (`land_title_url`) + coordinates
- **Apartment / House / Rental** — no title required; KYC verification sufficient
- **Airbnb / Lodge (Short Stay)** — `listing_type = short_stay`; booking system enabled
- All listings require at least one photo (Cloudinary URL)

#### Bookings & Payments (Short Stay)
1. Buyer books dates → booking created with `status = pending, payment_status = unpaid`
2. Pesapal hosted payment page URL returned to client
3. Pesapal IPN callback hits `POST /api/payments/ipn` → booking confirmed automatically
4. A platform fee (configurable, default 7%) is charged on each booking

#### Commissions
The platform tracks property leads (enquiries + WhatsApp contacts). An admin-configurable commission is due within N days of a confirmed sale/rental. Sellers with overdue commissions past the threshold are blocked from listing.

#### Leads
- **Platform enquiry**: `POST /api/v1/properties/:id/enquire` — stored in `leads` table
- **WhatsApp click**: `POST /api/v1/properties/:id/whatsapp` — tracked for analytics

---

## 🔒 Security

### 1. Authentication
- **Token-based auth** using Laravel Sanctum-compatible `personal_access_tokens` table
- `Authorization: Bearer <id|secret>` header on all protected routes
- SHA-256 token hash stored in DB; plain token never persisted

### 2. Cloudinary Upload Security
Two strictly separate upload presets:

| Preset | Mode | Use |
|---|---|---|
| `findmyhome_photos` | **Unsigned** | Property photos — public URLs |
| `findmyhome_kyc` | **Signed / Private** | KYC docs — never publicly accessible |

> ⚠️ Never change the KYC preset to unsigned. National IDs and passports must remain private.

### 3. Payment Security (Pesapal)
- IPN webhook verified via Pesapal's own API before any booking is confirmed
- No card/mobile-money details stored on Find My Home servers

### 4. CORS
The Go API reads `FRONTEND_URL` at startup. All `https://` origins are allowed so Vercel preview deployments work out of the box; `http://localhost` is also allowed for local dev.

### 5. Role-Based Access Control
| Middleware | Guards |
|---|---|
| `bearerAuth()` | All `/api/v1` authed routes |
| `verifiedSeller()` | Property write routes — requires `kyc_status = verified` |
| `sellerActive()` | Blocks sellers with overdue commissions |
| `adminOnly()` | All `/api/v1/admin/*` routes |

---

## 📁 Repository Structure

```
findmyhome/                   ← monorepo root
├── findmyhome-go/            ← Go/Gin backend API
│   ├── cmd/server/main.go    ← entry point
│   ├── internal/
│   │   ├── api/              ← HTTP handlers + router + middleware
│   │   ├── auth/             ← Sanctum-compatible token auth
│   │   ├── config/           ← env-based config
│   │   ├── db/               ← pgx connection pool
│   │   ├── model/            ← domain structs
│   │   ├── repo/             ← shared DB query helpers
│   │   ├── response/         ← paginator helper
│   │   └── seller/           ← category / KYC business rules
│   └── Dockerfile
├── findmyhome-web/           ← Next.js web frontend
├── findmyhome-admin/         ← Next.js admin panel
├── findmyhome-mobile/        ← React Native / Expo mobile app
├── docker-compose.yml        ← Local full-stack setup
└── .env.example              ← Environment variable reference
```

---

## 🧑‍💻 Development

### Prerequisites
- Go 1.23+
- Node 18+
- PostgreSQL 15 (or Docker)

### Quick Start (Docker)
```bash
cp .env.example .env
# Edit .env — set DB_PASSWORD at minimum
docker compose up --build
```

Services:
| URL | Service |
|---|---|
| `http://localhost:8000/api/health` | Go API |
| `http://localhost:3000` | Web frontend |
| `http://localhost:3001` | Admin panel |

### Run the Go API Locally (without Docker)
```bash
cd findmyhome-go
DATABASE_URL="postgres://postgres:password@localhost:5432/findmyhome?sslmode=disable" \
FRONTEND_URL="http://localhost:3000" \
go run ./cmd/server
```

### Build the Binary
```bash
cd findmyhome-go
go build -o findmyhome-api ./cmd/server
./findmyhome-api
```

---

## 🗄️ Database Schema Key Tables

| Table | Purpose |
|---|---|
| `users` | All roles: buyer, seller, company, admin |
| `personal_access_tokens` | Bearer auth tokens (Sanctum-compatible) |
| `properties` | Listings with type, price, photos, coords |
| `leads` | Enquiry & WhatsApp lead tracking |
| `kyc_documents` | Uploaded KYC files awaiting review |
| `bookings` | Short-stay booking requests + payment status |
| `commissions` | Earned platform commissions per lead conversion |
| `ratings` | Buyer-to-seller star ratings |
| `notifications` | In-app notification feed |
| `password_reset_tokens` | 24 h password reset links |
| `settings` | Admin-editable key/value config (rates, thresholds) |

---

## 🌍 API Base URL
```
https://<your-render-service>.onrender.com/api/v1/
```
Health check: `GET /api/health` → `{ "status": "ok", "service": "Find My Home API" }`
