# Find My Home — Mobile Deployment Guide

Stack: **React Native 0.74 · Expo 51 · Expo Router · EAS Build / Submit**

- Android package: `ug.findmyhome.app`
- iOS bundle ID: `ug.findmyhome.app`
- EAS profiles defined in `findmyhome-mobile/eas.json`: `development`, `preview`, `production`

---

## Overview

```
findmyhome-mobile/
  ├── eas.json          EAS build profiles
  ├── app.json          Expo config (bundle IDs, permissions, plugins)
  ├── .env              Local dev variables (gitignored)
  └── .env.example      Template — copy to .env and fill in values
```

```
Local dev  ──► npx expo start  ──► Expo Go (QR scan)
Preview    ──► eas build (APK)  ──► install on device directly
Production ──► eas build (AAB/IPA) ──► eas submit ──► Play Store / App Store
```

---

## Step 1 — Local Development

### 1.1 Install & Configure

```bash
cd findmyhome-mobile
npm install
```

Copy the env template and fill in your LAN IP:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Find your LAN IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1

EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```

> Use your machine's **LAN IP**, not `localhost` — the Android emulator or physical phone is a separate device and cannot reach `localhost` on your PC.

### 1.2 Start the Dev Server

```bash
# Opens QR code — scan with Expo Go app (iOS or Android)
npx expo start

# Target specific platform
npx expo start --android   # Android emulator (requires Android Studio)
npx expo start --ios       # iOS simulator (Mac only, requires Xcode)
```

---

## Step 2 — Set Up EAS

EAS (Expo Application Services) handles cloud builds, code signing, and store submissions. You do this **once**.

### 2.1 Install EAS CLI

```bash
npm install -g eas-cli
```

### 2.2 Create an Expo Account

Sign up free at [https://expo.dev](https://expo.dev) if you don't have an account.

### 2.3 Log In and Link the Project

```bash
eas login                  # enter your Expo credentials

cd findmyhome-mobile
eas init                   # links this project to your Expo account
```

`eas init` writes your `expo.extra.eas.projectId` into `app.json`. Commit that change.

### 2.4 Set Production Environment Variable

EAS bakes env vars into the release build at build time. Set the production API URL as an EAS secret so it's never exposed in source code:

```bash
eas secret:create \
  --scope project \
  --name EXPO_PUBLIC_API_URL \
  --value "https://findmyhome-api.onrender.com/api/v1"

eas secret:create \
  --scope project \
  --name EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME \
  --value "your_cloud_name"

eas secret:create \
  --scope project \
  --name EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET \
  --value "findmyhome_photos"
```

Verify secrets are saved:
```bash
eas secret:list
```

---

## Step 3 — Development Build (Optional)

A development build replaces Expo Go with a full native app that supports all custom native modules:

```bash
eas build --platform android --profile development
# or
eas build --platform ios --profile development
```

Install the resulting APK/IPA on your device, then `npx expo start` connects to it.

---

## Step 4 — Preview Build (Test on Real Device)

Before touching the stores, install a preview build on a physical phone to verify everything works end-to-end.

```bash
# Android — builds a signed APK (no store needed)
eas build --platform android --profile preview
```

EAS sends you a download link by email (~10–15 min). Install the APK directly on your Android phone:
- Enable **Install unknown apps** in Android Settings → Security
- Open the link, download, and install

Test the full flow: register → browse properties → KYC upload → booking.

---

## Step 5 — Publish to Google Play Store

### 5.1 Prerequisites

- **Google Play Developer account** — one-time $25 fee at [https://play.google.com/console](https://play.google.com/console)
- In Play Console: **Create app** → set category (Shopping / Real Estate) → fill in store listing

Store listing required:
- Short description (80 chars)
- Full description (4000 chars)
- At least 2 screenshots per device type (phone required)
- Feature graphic (1024×500 px)
- Icon (512×512 px)
- Privacy policy URL (mandatory)

### 5.2 Build the AAB

```bash
eas build --platform android --profile production
```

This produces a signed `.aab` (Android App Bundle). EAS creates and manages the keystore automatically on first build.

> ⚠️ **Back up your keystore immediately after first build — you can never replace it.**
> ```bash
> eas credentials        # download and save your Android keystore offline
> ```
> Without this keystore you cannot publish updates to the same Play Store listing.

### 5.3 Set Up Play Store API Access (first time only)

EAS Submit needs a Google Play service account to upload on your behalf:

1. Play Console → **Setup → API access**
2. Click **Link to a Google Cloud project** (creates one automatically)
3. Under **Service accounts** → **Create new service account**
4. In Google Cloud IAM → grant it the **Release Manager** role
5. Create a JSON key for the service account → download it
6. Back in Play Console → grant the service account access to your app

### 5.4 Submit to Play Store

```bash
eas submit --platform android --profile production
```

When prompted, provide the path to the service account JSON key. EAS saves it for future submissions.

After upload:
- Play Console → **Production → Releases** → review the build
- Click **Review release → Start rollout to Production**

> First-time review: 3–7 days. Subsequent updates: a few hours.

---

## Step 6 — Publish to Apple App Store

### 6.1 Prerequisites

- **Apple Developer account** — $99/year at [https://developer.apple.com](https://developer.apple.com)
- Enroll in the **Apple Developer Program** (not just the free account)
- In App Store Connect ([https://appstoreconnect.apple.com](https://appstoreconnect.apple.com)):
  - **My Apps → +** → New App
  - Bundle ID: `ug.findmyhome.app` (must match `app.json`)
  - SKU: `findmyhome-ug`
  - Fill in store listing

Store listing required:
- App name and subtitle
- Description and keywords
- Screenshots: **6.7" iPhone** (required) + iPad if supporting tablet
- App icon (1024×1024 px)
- Privacy policy URL (mandatory)
- Support URL

### 6.2 Build the IPA

EAS handles certificates and provisioning profiles automatically (`credentialsSource: remote` in `eas.json`):

```bash
eas build --platform ios --profile production
```

On first run EAS will:
1. Ask for your Apple ID and password
2. Create a **Distribution Certificate** and **Provisioning Profile** in your Apple Developer account
3. Store credentials securely on Expo's servers (you can re-download any time with `eas credentials`)

### 6.3 Set Up App Store Connect API Key (first time only)

Required for `eas submit`:

1. App Store Connect → **Users and Access → Keys**
2. Click **+** → Name it `EAS Submit` → Role: **App Manager**
3. Download the `.p8` file (**one download only — save it**)
4. Note the **Key ID** and your **Issuer ID** (shown on the Keys page)

### 6.4 Submit to App Store

```bash
eas submit --platform ios --profile production
```

Provide the `.p8` file path, Key ID, and Issuer ID when prompted. EAS saves these for future submissions.

After upload:
- App Store Connect → **TestFlight** → test internally first
- Once satisfied → **App Store → Submit for Review**

> First review: 1–3 business days. Make sure your privacy policy URL is live before submitting.

---

## Step 7 — Over-the-Air (OTA) Updates

For JavaScript or asset-only changes (no new native modules, no permission changes), push an update directly to users without going through stores:

```bash
eas update --branch production --message "Fix property search filter"
```

Users receive the update silently on next app launch. No store review, no wait.

> OTA updates do **not** work for:
> - New or changed native permissions
> - New native modules / Expo plugins
> - `app.json` config changes (bundle ID, splash, icon)
> - Version number bumps
>
> Those require a full `eas build` + store submission.

---

## Environment Variables Reference

| Variable | Local `.env` | EAS secret | Description |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ LAN IP for dev | ✅ Render URL for prod | API base URL including `/api/v1` |
| `EXPO_PUBLIC_WEB_URL` | ✅ | ✅ | Web app URL — reservations & invoices open here in browser |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | ✅ | ✅ | Cloudinary cloud name |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | ✅ | ✅ | `findmyhome_photos` (unsigned preset) |

Local `.env` (development):
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1
EXPO_PUBLIC_WEB_URL=https://findmyhomeuganda.com
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=findmyhome_photos
```

EAS secrets (production builds):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
  --value "https://findmyhome-api.onrender.com/api/v1"
eas secret:create --scope project --name EXPO_PUBLIC_WEB_URL \
  --value "https://findmyhomeuganda.com"
eas secret:create --scope project --name EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME \
  --value "your_cloud_name"
eas secret:create --scope project --name EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET \
  --value "findmyhome_photos"
```

---

## Pre-Launch Checklist

### Code
- [ ] Bundle ID updated to `com.findmyhomeuganda.app` in `app.json`
- [ ] All assets in place (`icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`, `notification-icon.png`)
- [ ] `EXPO_PUBLIC_WEB_URL` set to `https://findmyhomeuganda.com`

### Accounts (you create these)
- [ ] Expo account created at [expo.dev](https://expo.dev)
- [ ] `eas login` and `eas init` run inside `findmyhome-mobile/`
- [ ] Google Play Developer account created ($25 one-time) — [play.google.com/console](https://play.google.com/console)
- [ ] Apple Developer account created ($99/year) — [developer.apple.com](https://developer.apple.com) *(iOS only)*

### Backend (must be live before app works)
- [ ] PostgreSQL database deployed on Neon
- [ ] Go API deployed on Render and `/api/health` returns `ok`
- [ ] Web frontend deployed on Vercel
- [ ] Cloudinary presets `findmyhome_photos` (unsigned) and `findmyhome_kyc` (signed) created

### EAS Secrets
- [ ] `EXPO_PUBLIC_API_URL` EAS secret set to production Render URL
- [ ] `EXPO_PUBLIC_WEB_URL` EAS secret set to `https://findmyhomeuganda.com`
- [ ] `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` set

### Build & Test
- [ ] Preview APK built: `eas build --platform android --profile preview`
- [ ] Preview APK installed on a real Android phone and tested end-to-end
- [ ] Login, register, browse properties, KYC upload all verified on device
- [ ] "Continue on Website" opens `findmyhomeuganda.com` correctly in browser
- [ ] "Settle on Website" in Invoices opens correctly in browser
- [ ] Push notifications working (trigger from admin panel)

### Store Submission
- [ ] Keystore backed up offline — `eas credentials`
- [ ] Google Play service account JSON key saved securely
- [ ] App Store Connect API `.p8` key saved securely
- [ ] Play Store listing complete (description, screenshots, privacy policy URL)
- [ ] App Store listing complete (description, screenshots, privacy policy URL)
- [ ] Production AAB built and submitted → `eas build --platform android --profile production`
- [ ] Production IPA built and submitted → `eas build --platform ios --profile production`
- [ ] Play Store review approved
- [ ] App Store review approved
- [ ] OTA update tested: `eas update --branch production --message "test"`
