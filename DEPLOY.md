# Find My Home — Production Deployment Guide

---

## BEFORE YOU START — Critical Steps

### Step 0 — Generate APP_KEY locally
```bash
cd findmyhome
composer install
php artisan key:generate --show
# Copy the output: base64:xxxx...
# Paste it as APP_KEY in Railway environment variables
```
**Never run `php artisan key:generate` on the live server after users exist.
It invalidates all sessions and logs everyone out.**

---

## Step 1 — Deploy Backend on Railway

### 1.1 Create GitHub Repositories
```bash
# Backend
cd findmyhome
git init
git add .
git commit -m "Find My Home backend v1.0"
git remote add origin https://github.com/YOUR_USERNAME/findmyhome-api.git
git push -u origin main

# Frontend
cd findmyhome-web
git init && git add . && git commit -m "Find My Home web v1.0"
git remote add origin https://github.com/YOUR_USERNAME/findmyhome-web.git
git push -u origin main

# Mobile
cd findmyhome-mobile
git init && git add . && git commit -m "Find My Home mobile v1.0"
git remote add origin https://github.com/YOUR_USERNAME/findmyhome-mobile.git
git push -u origin main
```

### 1.2 Set Up Railway
1. Go to https://railway.app → New Project
2. **Service 1:** New Service → GitHub → `findmyhome-api` → name it `api`
3. **Service 2:** New Service → Database → PostgreSQL → name it `db`
4. **Service 3:** New Service → GitHub → same `findmyhome-api` → name it `worker`
   - Override start command: `php artisan queue:work --queue=kyc,default --sleep=3 --tries=2 --memory=256`
5. **Service 4:** New Service → GitHub → same `findmyhome-api` → name it `scheduler`
   - Override start command: `php artisan schedule:work`

### 1.3 Environment Variables for Railway API service
```env
APP_NAME=Find My Home
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:YOUR_GENERATED_KEY_HERE          ← from Step 0
APP_URL=https://YOUR-API.railway.app

# Railway auto-populates this from the PostgreSQL service:
DATABASE_URL=${{db.DATABASE_URL}}

CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUDNAME
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

AT_USERNAME=your_africastalking_username
AT_API_KEY=your_africastalking_key
AT_SENDER_ID=FindMyHome

RESEND_KEY=re_your_resend_key
MAIL_FROM_ADDRESS=hello@findmyhome.ug
MAIL_FROM_NAME=Find My Home

GOOGLE_VISION_API_KEY=your_google_vision_key

PESAPAL_CONSUMER_KEY=your_key
PESAPAL_CONSUMER_SECRET=your_secret
PESAPAL_ENV=sandbox                              ← change to 'live' when ready
PESAPAL_IPN_URL=https://YOUR-API.railway.app/api/payments/ipn

FIREBASE_PROJECT_ID=your_firebase_project_id

FRONTEND_URL=https://your-app.vercel.app
QUEUE_CONNECTION=database
CACHE_DRIVER=database
SESSION_DRIVER=database
MAIL_MAILER=resend
```

### 1.4 After First Deploy
```bash
# In Railway shell for the API service:
php artisan db:seed --force
```

### 1.5 Verify
`GET https://YOUR-API.railway.app/api/health` → `{"status":"ok"}`

---

## Step 2 — Deploy Frontend on Vercel

1. Go to https://vercel.com → Import → `findmyhome-web`
2. Add environment variables:
```env
NEXT_PUBLIC_API_URL=https://YOUR-API.railway.app/api/v1
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```

---

## Step 3 — Cloudinary Setup (IMPORTANT — Security)

### 3.1 Create TWO upload presets
In Cloudinary dashboard → Settings → Upload → Add upload preset:

**Preset 1 — Property Photos (unsigned, safe)**
- Name: `findmyhome_photos`
- Signing mode: **Unsigned**
- Folder: `findmyhome/properties`
- Max file size: 10MB
- Allowed formats: jpg, png, webp

**Preset 2 — KYC Documents (SIGNED — security critical)**
- Name: `findmyhome_kyc`
- Signing mode: **Signed**
- Folder: `findmyhome/kyc`
- Access mode: **Private** (documents NOT publicly accessible)
- Max file size: 5MB
- Allowed formats: jpg, png, pdf

> ⚠️ KYC documents contain National IDs and passports.
> They MUST use signed upload and private access mode.
> Never use unsigned upload for KYC documents.

Update mobile KYC screen to use signed upload preset for documents.

---

## Step 4 — Firebase Push Notifications

1. Go to https://console.firebase.google.com
2. Create project → Add Android app (package: `ug.findmyhome.app`)
3. Download `google-services.json` → place in `findmyhome-mobile/` root
4. Add iOS app (bundle: `ug.findmyhome.app`) → download `GoogleService-Info.plist`
5. Add `FIREBASE_PROJECT_ID` to Railway env vars

---

## Step 5 — Africa's Talking SMS

1. Register at https://africastalking.com
2. Go live (off sandbox) before launch
3. Top up SMS credits — Uganda MTN/Airtel delivery confirmed

---

## Step 6 — Pesapal Payments

1. Register at https://pesapal.com
2. Complete KYC on Pesapal (business verification)
3. Switch `PESAPAL_ENV` from `sandbox` to `live`
4. Set `PESAPAL_IPN_URL` to your live Railway URL
5. Test a real UGX 1,000 payment before launch

---

## Step 7 — Railway Database Backups

In Railway dashboard → PostgreSQL service → Settings → Backups:
- Enable daily automated backups
- Set retention: 7 days minimum

---

## Step 8 — Pre-Launch Checklist

- [ ] `GET /api/health` returns OK
- [ ] Register buyer account
- [ ] Register individual seller — category: Land
- [ ] Upload KYC document — AI analysis completes
- [ ] Create land listing — title document required
- [ ] Register short stay seller — light KYC
- [ ] Create short stay listing — no title required
- [ ] Test WhatsApp lead tracking
- [ ] Test platform enquiry lead
- [ ] Login as admin → approve KYC manually
- [ ] Change commission rate in Settings
- [ ] Test password reset email
- [ ] Test SMS notification (Africa's Talking)
- [ ] Test Pesapal payment (sandbox)
- [ ] Verify duplicate detection fires on similar listing
- [ ] Check commission enforcement runs (advance date in DB to test)
- [ ] Verify company account gets blue badge on KYC approval
- [ ] Test mobile app on Android device
- [ ] Test mobile app on iOS device

---

## API Base URL
All endpoints: `https://YOUR-API.railway.app/api/v1/`

## Test Accounts (from seeder)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@findmyhome.ug | Admin@2024! |
| Company | info@primeestates.ug | Seller@2024! |
| Land Seller | grace.namukasa@gmail.com | Seller@2024! |
| Short Stay Host | kevin.ochieng@gmail.com | Seller@2024! |
| Buyer | peter.ochieng@gmail.com | Buyer@2024! |

---

## Architecture
```
Vercel (Next.js)     ──────► Railway API (Laravel) ──────► PostgreSQL
Expo (React Native)  ──────►        │
                                    ├──► Railway Worker (Queue jobs)
                                    ├──► Railway Scheduler (Daily tasks)
                                    ├──► Cloudinary (Photos + KYC docs)
                                    ├──► Africa's Talking (SMS)
                                    ├──► Resend (Email)
                                    ├──► Firebase FCM (Push)
                                    ├──► Google Vision (KYC AI)
                                    └──► Pesapal (Payments)
```
