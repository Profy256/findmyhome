# Find My Home — Production Deployment Guide

Stack: **Go/Gin API → Render** · **PostgreSQL → Neon** · **Frontends → Vercel**

---

## Overview

```
Vercel (Web + Admin)   ──► Render (Go API) ──► Neon (PostgreSQL)
Expo (Mobile)          ──►        │
                                  └──► Cloudinary · Pesapal
```

---

## Step 0 — Push Code to GitHub

You need **separate GitHub repos** for each deployable unit (or one monorepo — both work).

```bash
# From the monorepo root
cd findmyhome-go
git init
git add .
git commit -m "feat: Go/Gin backend"
git remote add origin https://github.com/YOUR_USERNAME/findmyhome-api.git
git push -u origin main

cd ../findmyhome-web
git init && git add . && git commit -m "feat: web frontend"
git remote add origin https://github.com/YOUR_USERNAME/findmyhome-web.git
git push -u origin main

cd ../findmyhome-admin
git init && git add . && git commit -m "feat: admin panel"
git remote add origin https://github.com/YOUR_USERNAME/findmyhome-admin.git
git push -u origin main
```

---

## Step 1 — Database on Neon

1. Go to [https://neon.tech](https://neon.tech) → **New Project**
2. Name it `findmyhome`, region: closest to your users (e.g. `eu-west-1`)
3. Copy the **Connection string** — it looks like:
   ```
   postgres://username:password@ep-xxx.eu-west-1.aws.neon.tech/findmyhome?sslmode=require
   ```
4. Run your schema migrations against it (using `psql` or any migration tool):
   ```bash
   psql "postgres://..." -f schema.sql
   ```
5. *(Optional)* Seed admin & demo accounts if you have a seed script.

> 💡 Neon's free tier gives 0.5 GB storage + auto-suspend after 5 min idle. Upgrade to Pro for always-on.

---

## Step 2 — Backend API on Render

### 2.1 Create the Web Service

1. Go to [https://render.com](https://render.com) → **New → Web Service**
2. Connect your `findmyhome-api` GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `findmyhome-api` |
| **Region** | Closest to your Neon DB region |
| **Branch** | `main` |
| **Root Directory** | *(leave blank — Dockerfile is in repo root)* |
| **Runtime** | **Docker** |
| **Instance Type** | Free (or Starter for always-on) |

Render will auto-detect the `Dockerfile` and build the Go binary inside it.

### 2.2 Environment Variables (Render Dashboard → Environment)

```env
GIN_MODE=release
ADDR=:8000

# From Neon Step 1 — must include ?sslmode=require
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/findmyhome?sslmode=require

# Your Vercel web frontend URL (set after Step 3)
FRONTEND_URL=https://your-app.vercel.app

# The Render service's own public URL
PUBLIC_API_URL=https://findmyhome-api.onrender.com

# Pesapal — leave blank until payment testing
PESAPAL_CONSUMER_KEY=your_key
PESAPAL_CONSUMER_SECRET=your_secret
PESAPAL_ENV=sandbox
```

> ⚠️ `DATABASE_URL` **must** have `sslmode=require` for Neon — plain `disable` will be rejected.

### 2.3 Health Check

After first deploy (takes ~3 min on free tier):
```
GET https://findmyhome-api.onrender.com/api/health
→ { "status": "ok", "service": "Find My Home API", "version": "1.0.0" }
```

---

## Step 3 — Frontends on Vercel

### 3.1 Web Frontend

1. [https://vercel.com](https://vercel.com) → **Add New Project** → Import `findmyhome-web`
2. Framework Preset: **Next.js** (auto-detected)
3. Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://findmyhome-api.onrender.com/api/v1
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```

4. Deploy → copy the Vercel URL (e.g. `https://findmyhome.vercel.app`)
5. **Go back to Render** → update `FRONTEND_URL` to this URL → Redeploy

### 3.2 Admin Panel

1. Vercel → **Add New Project** → Import `findmyhome-admin`
2. Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://findmyhome-api.onrender.com/api/v1
```

---

## Step 4 — Cloudinary (Media & KYC Security)

### Create TWO upload presets

**Dashboard → Settings → Upload → Add upload preset**

| | Preset 1 (Photos) | Preset 2 (KYC Documents) |
|---|---|---|
| **Name** | `findmyhome_photos` | `findmyhome_kyc` |
| **Signing mode** | **Unsigned** | **Signed** |
| **Folder** | `findmyhome/properties` | `findmyhome/kyc` |
| **Access mode** | Public | **Private** |
| **Max file size** | 10 MB | 5 MB |
| **Allowed formats** | jpg, png, webp | jpg, png, pdf |

> ⚠️ KYC documents contain National IDs and passports. They **must** use signed upload + private access. Never change this to unsigned.

---

## Step 5 — Pesapal Payments

1. Register at [https://pesapal.com](https://pesapal.com) and complete business KYC
2. Set `PESAPAL_ENV=sandbox` first and test with sandbox credentials
3. The IPN (payment callback) URL is automatically:
   ```
   https://findmyhome-api.onrender.com/api/payments/ipn
   ```
   Register this exact URL in your Pesapal dashboard → IPN settings
4. Once sandbox testing passes, switch to `PESAPAL_ENV=production` and live credentials

---

## Step 6 — Custom Domain (Optional)

### API
- Render Dashboard → Your Service → **Settings → Custom Domains**
- Add `api.findmyhome.ug` → update your DNS CNAME

### Frontends
- Vercel Dashboard → Project → **Settings → Domains**
- Add `findmyhome.ug` and `admin.findmyhome.ug`

After adding custom domains, update:
- `FRONTEND_URL` on Render → your production domain
- `PUBLIC_API_URL` on Render → your API custom domain

---

## Step 7 — Neon Database Backups

Neon automatically maintains **7 days of point-in-time restore** on all plans.

To take a manual snapshot:
```bash
pg_dump "postgres://..." --no-acl --no-owner -F c -f backup-$(date +%Y%m%d).dump
```

---

## Step 8 — Pre-Launch Checklist

- [ ] `GET /api/health` returns `{ "status": "ok" }`
- [ ] Register a buyer account via web frontend
- [ ] Register an individual seller (category: Land)
- [ ] Upload KYC document via mobile/web
- [ ] Admin approves KYC → seller `kyc_status = verified`
- [ ] Create a Land listing — verify land title is required
- [ ] Create a Short Stay listing — verify booking is available
- [ ] Send a WhatsApp lead — verify it appears in admin leads
- [ ] Send a platform enquiry — verify it appears in admin leads
- [ ] Book a short-stay property → verify Pesapal URL returned
- [ ] Test Pesapal IPN with sandbox payment → booking confirmed
- [ ] Register a company account → upload business certificate
- [ ] Admin approves company KYC → verify Blue Badge appears
- [ ] Change commission rate in Admin Settings
- [ ] Test password forgot/reset flow
- [ ] Verify CORS — web frontend can call API without errors
- [ ] Check Render logs for any startup errors

---

## Environment Variables Reference

### Go API (Render)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full Neon postgres DSN with `sslmode=require` |
| `GIN_MODE` | ✅ | Set to `release` in production |
| `ADDR` | — | Listen address, default `:8000` |
| `FRONTEND_URL` | ✅ | Your Vercel web URL (for CORS) |
| `PUBLIC_API_URL` | ✅ | Your Render URL (for Pesapal callbacks) |
| `PESAPAL_CONSUMER_KEY` | — | Pesapal API key |
| `PESAPAL_CONSUMER_SECRET` | — | Pesapal API secret |
| `PESAPAL_ENV` | — | `sandbox` or `production` |

### Web / Admin (Vercel)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://your-api.onrender.com/api/v1` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ✅ | Your Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | ✅ | `findmyhome_photos` |

---

## Test Accounts (seed your DB with these)

| Role | Email | Password |
|---|---|---|
| Admin | admin@findmyhome.ug | Admin@2024! |
| Company | info@primeestates.ug | Seller@2024! |
| Land Seller | grace.namukasa@gmail.com | Seller@2024! |
| Short Stay Host | kevin.ochieng@gmail.com | Seller@2024! |
| Buyer | peter.ochieng@gmail.com | Buyer@2024! |
