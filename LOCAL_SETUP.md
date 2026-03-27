# Find My Home — Local Development Setup Guide

Run the full stack locally: Laravel API + Next.js Web + React Native Mobile

---

## What You Need to Install First

| Tool | Version | Download |
|------|---------|----------|
| PHP | 8.2+ | https://php.net/downloads |
| Composer | Latest | https://getcomposer.org |
| Node.js | 18+ | https://nodejs.org |
| PostgreSQL | 15+ | https://postgresql.org/download |
| Git | Latest | https://git-scm.com |

> **Windows users:** Install PHP via XAMPP (https://apachefriends.org) or Laragon (https://laragon.org — recommended, easiest).
> **Mac users:** Install PHP via Homebrew: `brew install php composer`
> **Ubuntu/Linux:** `sudo apt install php8.2 php8.2-pgsql php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-bcmath composer`

---

## Part 1 — Backend (Laravel API)

### Step 1 — Install PHP dependencies
```bash
cd findmyhome
composer install
```

### Step 2 — Create your environment file
```bash
cp .env.example .env
```

### Step 3 — Open `.env` and fill in these values
```env
APP_NAME="Find My Home"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database — your local PostgreSQL
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=findmyhome
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password

# Leave these as-is for local development
QUEUE_CONNECTION=database
CACHE_DRIVER=database
MAIL_MAILER=log          # emails print to storage/logs/laravel.log instead of sending
SESSION_DRIVER=database

# These are optional locally — features will gracefully skip if not set
CLOUDINARY_URL=
AT_USERNAME=
AT_API_KEY=
GOOGLE_VISION_API_KEY=
PESAPAL_CONSUMER_KEY=
RESEND_KEY=
```

> **Tip:** For local development, you don't need Cloudinary, Africa's Talking, or Resend.
> Photos won't upload, emails will go to the log file, SMS won't send.
> Everything else (listings, leads, KYC flow, commissions, admin) works fully.

### Step 4 — Create the PostgreSQL database
```bash
# Option A: Using psql command line
psql -U postgres -c "CREATE DATABASE findmyhome;"

# Option B: Using pgAdmin (GUI)
# Right-click Databases → Create → Database → name it "findmyhome"

# Option C: Using TablePlus, DBeaver, or any DB client
# Just create a new database named "findmyhome"
```

### Step 5 — Generate your application key
```bash
php artisan key:generate
```
This writes `APP_KEY=base64:xxxx...` into your `.env` file automatically.

### Step 6 — Run database migrations
```bash
php artisan migrate
```
This creates all 12 tables in your database.

### Step 7 — Seed test data
```bash
php artisan db:seed
```
This creates test accounts and sample properties. You'll see:
```
✅ Database seeded.

Test accounts:
  Admin:             admin@findmyhome.ug        / Admin@2024!
  Company:           info@primeestates.ug       / Seller@2024!
  Land Seller:       grace.namukasa@gmail.com   / Seller@2024!
  Short Stay Host:   kevin.ochieng@gmail.com    / Seller@2024!
  Buyer:             peter.ochieng@gmail.com    / Buyer@2024!
```

### Step 8 — Start the Laravel server
```bash
php artisan serve
```
API is now running at: **http://localhost:8000**

Test it:
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"ok","service":"Find My Home API","version":"1.0.0"}
```

### Step 9 — Start the queue worker (separate terminal)
Open a new terminal window and run:
```bash
cd findmyhome
php artisan queue:work --queue=kyc,default
```
This processes background jobs (KYC AI analysis, duplicate detection, notifications).
Keep this running while testing.

---

## Part 2 — Frontend (Next.js Web)

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
> The `NEXT_PUBLIC_API_URL` points to your Laravel server running on port 8000.
> Cloudinary is optional locally — photo upload won't work but everything else will.

### Step 4 — Start the development server
```bash
npm run dev
```
Web app is now running at: **http://localhost:3000**

---

## Part 3 — Mobile App (React Native / Expo)

### Step 1 — Install Expo CLI
```bash
npm install -g expo-cli
```

### Step 2 — Install dependencies
```bash
cd findmyhome-mobile
npm install
```

### Step 3 — Create environment file
```bash
cp .env.example .env
```

### Step 4 — Edit `.env`
```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000/api/v1
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```

> ⚠️ **Important:** Use your computer's local IP address, NOT `localhost`.
> Your phone and computer must be on the same WiFi network.
>
> Find your local IP:
> - **Mac:** `ipconfig getifaddr en0`
> - **Windows:** `ipconfig` → look for IPv4 Address (e.g. 192.168.1.5)
> - **Linux:** `hostname -I`
>
> Example: `EXPO_PUBLIC_API_URL=http://192.168.1.5:8000/api/v1`

### Step 5 — Start Expo
```bash
npx expo start
```

You'll see a QR code in the terminal.

### Step 6 — Run on your phone
1. Install **Expo Go** on your phone:
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
   - iPhone: https://apps.apple.com/app/expo-go/id982107779
2. Open Expo Go → Scan the QR code
3. The app loads on your phone

### Alternative — Run on Android emulator
```bash
# Start Android emulator first (from Android Studio)
npx expo start --android
```

### Alternative — Run on iOS simulator (Mac only)
```bash
npx expo start --ios
```

---

## Running Everything Together

Open **4 terminal windows**:

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `findmyhome/` | `php artisan serve` |
| 2 | `findmyhome/` | `php artisan queue:work --queue=kyc,default` |
| 3 | `findmyhome-web/` | `npm run dev` |
| 4 | `findmyhome-mobile/` | `npx expo start` |

Then open:
- **Web:** http://localhost:3000
- **API:** http://localhost:8000
- **Mobile:** Scan QR code in Expo Go

---

## Testing the Full Flow Locally

### Test 1 — Buyer browses and contacts a seller
1. Open http://localhost:3000
2. Browse properties (seeded data is already there)
3. Click a property → property detail page
4. Click "Enquire" — lead is recorded
5. Click "Chat on WhatsApp" — lead is recorded, WhatsApp opens

### Test 2 — Register as a seller and get verified
1. Click "List Your Property" → register as seller
2. Select category: **Short Stay** (lightest KYC)
3. Go to Dashboard → KYC
4. Upload any clear photo of any document (Google Vision is optional locally)
5. If `GOOGLE_VISION_API_KEY` is not set, document goes to "Pending" automatically
6. Log in as admin → http://localhost:3000/admin
   - Email: admin@findmyhome.ug / Password: Admin@2024!
7. Go to Admin → KYC → Approve the document manually

### Test 3 — Create a land listing
1. Log in as the verified land seller (grace.namukasa@gmail.com)
2. Dashboard → New Listing
3. Select type: Land
4. Notice the land title field is **required** (individual seller rule)
5. Fill in all fields including a title URL
6. Submit → listing is created

### Test 4 — Admin panel
1. Log in as admin@findmyhome.ug
2. Visit http://localhost:3000/admin
3. Try: blocking a user, freezing a listing, changing commission rate in Settings

### Test 5 — Commission enforcement
1. Go to your database and manually set a commission `due_date` to yesterday
2. Run: `php artisan commissions:enforce`
3. Check the log: `tail -f storage/logs/laravel.log`
4. You'll see the commission reminder being processed

---

## Checking Emails Locally

Since `MAIL_MAILER=log` in local `.env`, all emails go to the log file instead of sending.

To read emails:
```bash
tail -f findmyhome/storage/logs/laravel.log
```
Or open the file in any text editor. Every email is printed in full.

---

## Common Problems & Fixes

### "php: command not found"
Install PHP. See the top of this guide for your OS.

### "SQLSTATE: could not connect to server"
- Make sure PostgreSQL is running
- Check `DB_PASSWORD` in `.env` matches your PostgreSQL password
- Check `DB_DATABASE=findmyhome` database exists

### "composer: command not found"
Install Composer from https://getcomposer.org

### "npm: command not found"
Install Node.js from https://nodejs.org

### Mobile app can't connect to API
- Make sure you used your computer's IP address, not `localhost`
- Both devices must be on the same WiFi
- Make sure `php artisan serve` is running
- Try: `php artisan serve --host=0.0.0.0 --port=8000`

### "Class not found" error
```bash
composer dump-autoload
```

### Database migration errors
```bash
# Reset everything and start fresh
php artisan migrate:fresh --seed
```

### Port 8000 already in use
```bash
php artisan serve --port=8001
# Then update NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
```

### Queue jobs not running
Make sure Terminal 2 (`php artisan queue:work`) is still running.
If a job fails, check: `php artisan queue:failed`

---

## Useful Commands

```bash
# See all registered API routes
php artisan route:list

# Clear all caches
php artisan optimize:clear

# Reset database and re-seed
php artisan migrate:fresh --seed

# Check failed queue jobs
php artisan queue:failed

# Retry all failed jobs
php artisan queue:retry all

# Run commission enforcement manually
php artisan commissions:enforce

# Open Laravel Tinker (PHP REPL for testing)
php artisan tinker

# Inside Tinker — find a user
App\Models\User::where('email', 'admin@findmyhome.ug')->first()

# Inside Tinker — check commission settings
App\Models\Setting::commissionRate()
App\Models\Setting::commissionBlockThreshold()
```

---

## Local URLs Summary

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |
| API Health | http://localhost:8000/api/health |
| API v1 Base | http://localhost:8000/api/v1 |
| Mobile (Expo) | QR code in terminal |

---

## Ready to Deploy?

Once everything works locally, follow `DEPLOY.md` to push to Railway + Vercel.

The only difference between local and production:
1. Set `APP_ENV=production` and `APP_DEBUG=false`
2. Set real API keys (Cloudinary, Africa's Talking, Resend, Pesapal, Google Vision)
3. Set `PESAPAL_ENV=live` when ready to accept real payments
4. Enable Railway PostgreSQL backups
