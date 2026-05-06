# Find My Home — Scalability & SEO Report

> **Scope:** Go backend (Render) · Neon PostgreSQL · Next.js 16 frontend (Vercel)
> **Target:** 20,000 initial users, growing over time

---

## 1. Architecture Overview

```
Browser / Mobile App
        │
        ▼
  Vercel (Next.js 16)          ← Frontend / SSR
        │
        ▼  REST API (HTTPS)
  Render (Go + Gin)            ← Backend API
        │
        ▼
  Neon PostgreSQL (Pooler)     ← Database
        │
  Cloudinary                   ← Images & KYC docs
  Resend                       ← Email
  Africa's Talking             ← SMS
  Google Vision / Firebase     ← KYC AI
  Pesapal                      ← Payments
```

---

## 2. Scalability Report

### 2.1 Backend — Go on Render

**Rating: ✅ Good foundation, ⚠️ hosting tier is a risk**

Go (Gin) is one of the most performant web frameworks available. A single Go instance
can realistically serve **5,000–15,000 concurrent requests** depending on DB query time.
For 20,000 users who don't all visit at the same second, this is more than enough.

| Concern | Status | Details |
|---|---|---|
| Language efficiency | ✅ Excellent | Go goroutines handle concurrency natively |
| Gin framework overhead | ✅ Minimal | ~microsecond routing overhead |
| Render **Free tier** | ❌ Critical risk | Spins down after 15 min idle → **cold start of 30–60 sec** |
| Render **Starter tier ($7/mo)** | ✅ Required | Always-on, 512MB RAM, sufficient for 20k users |
| Rate limiting | ❌ Missing | No rate limiter in `router.go` — DDoS/spam risk |
| CORS policy | ⚠️ Too open | `strings.HasPrefix(origin, "https://")` allows **any** HTTPS origin |

> **⚠️ CAUTION:** Upgrade Render to Starter ($7/mo) before launch. The free tier's cold start will destroy user experience — someone visits your site after 15 min of silence and waits 60 seconds for the first API call to return.

> **⚠️ WARNING:** Add rate limiting. Without it, a single bad actor can spam `/auth/register` or `/properties` and exhaust your Neon connection pool.

---

### 2.2 Database — Neon PostgreSQL

**Rating: ✅ Correct setup, ⚠️ pool not tuned for Neon**

You are correctly using the **Neon pooler endpoint** (`-pooler` in the hostname),
which routes through PgBouncer in **transaction mode**. This is the right choice.

**Critical issue — `pool.go` has no Neon-specific tuning:**

```go
// Current pool.go — uses pgx defaults (up to 100 connections!)
pool, err := pgxpool.NewWithConfig(ctx, pcfg)
```

pgx defaults allow up to **100 connections per pool instance**. Neon's free tier cap is
**10 connections total**. This will cause `ERROR: too many connections` under light load.

**Recommended `pool.go` settings for Neon:**

```go
pcfg.MaxConns = 5                              // Stay well under Neon's limit
pcfg.MinConns = 1
pcfg.MaxConnLifetime = 30 * time.Minute
pcfg.MaxConnIdleTime = 5 * time.Minute        // Neon kills idle after ~5 min
pcfg.ConnConfig.DefaultQueryExecMode =
    pgx.QueryExecModeSimpleProtocol            // Required for PgBouncer transaction mode
```

| Neon Tier | Max Connections | Storage | Suitable for |
|---|---|---|---|
| Free | 10 | 512 MB | Dev / testing only |
| Launch ($19/mo) | 100 | 10 GB | ✅ 20,000 users |
| Scale ($69/mo) | Unlimited | 50 GB | 100,000+ users |

> **⚠️ IMPORTANT:** Upgrade Neon to **Launch tier ($19/mo)** before going live. The free tier's 10-connection limit will cause random errors under real traffic.

---

### 2.3 Frontend — Next.js 16 on Vercel

**Rating: ✅ Excellent for scale**

Vercel's free tier handles **100 GB bandwidth / month** and scales automatically.
For 20,000 users, Vercel will not be your bottleneck at all.

| Feature | Status |
|---|---|
| Vercel auto-scaling | ✅ Handled automatically |
| Next.js SSR/SSG | ✅ Framework supports both |
| Image optimization | ✅ Cloudinary + `next/image` with `remotePatterns` configured |
| Google Fonts (Cormorant + Jost) | ✅ Loaded via `next/font` — zero layout shift |
| Bundle size | ⚠️ Check — Radix UI + TanStack Query + Zustand can bloat JS |
| Static property pages | ❌ Not using `generateStaticParams` — all property pages are SSR |

> **💡 TIP:** For property listing pages (`/properties/[id]`), use `generateStaticParams` to pre-render popular listings at build time. This makes those pages load in **< 100ms** from Vercel's CDN edge and gives a massive SEO boost.

---

### 2.4 Load Capacity Estimate

| Users | Peak concurrent | Current stack handles? | Action needed |
|---|---|---|---|
| 20,000 | ~500 | ✅ Yes (with paid tiers) | Upgrade Render + Neon |
| 50,000 | ~1,500 | ✅ Yes | Tune DB pool, add Redis cache |
| 100,000 | ~4,000 | ⚠️ Needs Redis + query optimization | Add Redis, add DB indexes |
| 500,000 | ~20,000 | ❌ Needs horizontal scaling | Multiple Render instances + read replicas |

---

## 3. SEO Report

### 3.1 Current SEO Setup

**Rating: ✅ Good start, several gaps**

Your `layout.tsx` has the basics:

```tsx
export const metadata: Metadata = {
  title: 'Find My Home — Uganda Real Estate',
  description: "Uganda's most trusted real estate marketplace...",
  keywords: 'property Uganda, houses for sale Kampala, land Uganda, apartments Kampala',
  openGraph: {
    title: 'Find My Home Uganda',
    description: 'Search verified properties across Uganda',
    type: 'website',
  },
}
```

| SEO Factor | Status | Notes |
|---|---|---|
| Title tag | ✅ Set | Good — includes location "Uganda" |
| Meta description | ✅ Set | Good length and content |
| Keywords meta | ⚠️ Minor | Google ignores `<meta keywords>` — focus on content instead |
| OpenGraph tags | ⚠️ Incomplete | Missing `og:image`, `og:url` — WhatsApp/Twitter shares will have no preview image |
| Twitter Card | ❌ Missing | No `twitter:card` meta tags |
| Canonical URL | ❌ Missing | Without it, Google may index duplicate pages |
| Structured Data (JSON-LD) | ❌ Missing | **Biggest SEO gap** — see below |
| `robots.txt` | ❌ Not confirmed | Needs verification |
| `sitemap.xml` | ❌ Missing | Google can't efficiently discover all your property pages |
| Per-page metadata | ❌ Missing | Each `/properties/[id]` needs its own unique title/description |

---

### 3.2 Loading Time & Core Web Vitals (SEO Impact)

Google uses **Core Web Vitals** as a ranking signal. These are the metrics that matter:

| Metric | What it measures | Your risk |
|---|---|---|
| **LCP** (Largest Contentful Paint) | How fast the main content loads | ⚠️ Medium — Cloudinary images need `priority` prop |
| **INP** (Interaction to Next Paint) | How fast the page responds to clicks | ✅ Low — React 18 is optimized |
| **CLS** (Cumulative Layout Shift) | Does content jump around while loading | ✅ Low — `next/font` prevents font-swap shift |
| **TTFB** (Time to First Byte) | Server response time | ⚠️ HIGH risk if Render free tier cold-starts |

**Specific loading time issues found:**

1. **Render cold start (biggest risk)** — If on free tier, first API call after idle = 30–60 sec. Your page's LCP will be catastrophically bad.

2. **Property listing images** — Make sure hero images use `<Image priority />` from `next/image`. Without `priority`, Next.js lazy-loads the main property photo, hurting LCP score.

3. **No HTTP caching headers** on the Go API — responses for public routes like `GET /api/v1/properties` should have `Cache-Control: public, max-age=60`. This lets Vercel's CDN cache the property list at the edge, reducing API calls dramatically.

4. **JavaScript bundle** — You have Radix UI + TanStack Query + Zustand + Lucide. Run `next build && npx @next/bundle-analyzer` to check if any package is oversized.

---

### 3.3 Critical SEO Fixes (Do These Before Launch)

#### Fix 1 — Add OpenGraph image & URL to layout.tsx

```tsx
export const metadata: Metadata = {
  title: 'Find My Home — Uganda Real Estate',
  description: "Uganda's most trusted real estate marketplace. Verified sellers, genuine listings, zero scams.",
  openGraph: {
    title: 'Find My Home Uganda',
    description: 'Search verified properties across Uganda',
    type: 'website',
    url: 'https://your-app.vercel.app',
    images: [{ url: 'https://your-app.vercel.app/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find My Home Uganda',
    description: 'Search verified properties across Uganda',
    images: ['https://your-app.vercel.app/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://your-app.vercel.app',
  },
}
```

#### Fix 2 — Per-page metadata for property listings

```tsx
// src/app/properties/[id]/page.tsx
export async function generateMetadata({ params }) {
  const property = await fetchProperty(params.id)
  return {
    title: `${property.title} — Find My Home`,
    description: `${property.bedrooms} bed, ${property.bathrooms} bath in ${property.location}. UGX ${property.price.toLocaleString()}.`,
    openGraph: {
      images: [property.photos[0]],
    },
    alternates: { canonical: `https://your-app.vercel.app/properties/${params.id}` },
  }
}
```

#### Fix 3 — Add JSON-LD structured data for property pages

This tells Google your page is a **real estate listing**, which can unlock **rich results**
(prices, locations shown directly in Google search):

```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  name: property.title,
  description: property.description,
  url: `https://your-app.vercel.app/properties/${property.id}`,
  image: property.photos,
  price: property.price,
  priceCurrency: 'UGX',
  address: {
    '@type': 'PostalAddress',
    addressLocality: property.location,
    addressCountry: 'UG',
  },
}
// Add to page: <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
```

#### Fix 4 — Add sitemap.xml

```tsx
// src/app/sitemap.ts  (Next.js auto-generates the /sitemap.xml route)
export default async function sitemap() {
  const properties = await fetchAllPropertyIds()
  return [
    { url: 'https://your-app.vercel.app', lastModified: new Date() },
    { url: 'https://your-app.vercel.app/search', lastModified: new Date() },
    ...properties.map(p => ({
      url: `https://your-app.vercel.app/properties/${p.id}`,
      lastModified: p.updatedAt,
    })),
  ]
}
```

#### Fix 5 — Add Cache-Control headers on the Go API

```go
// In property.go — propertiesIndex handler, before c.JSON()
c.Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
```

---

## 4. Action Plan

### Before Launch (Must Do)

| Priority | Action | Cost |
|---|---|---|
| 🔴 Critical | Upgrade Render to **Starter** ($7/mo) | $7/mo |
| 🔴 Critical | Upgrade Neon to **Launch** ($19/mo) | $19/mo |
| 🔴 Critical | Tune `pool.go` for Neon (max 5 conns, simple protocol) | Free — code change |
| 🔴 Critical | Add rate limiting to Go API | Free — code change |
| 🟠 High | Fix OpenGraph image + Twitter Card in `layout.tsx` | Free |
| 🟠 High | Add per-page `generateMetadata` for property pages | Free |
| 🟠 High | Add `sitemap.xml` via Next.js App Router | Free |
| 🟡 Medium | Add JSON-LD structured data to property pages | Free |
| 🟡 Medium | Add `Cache-Control` headers to public API routes | Free |
| 🟡 Medium | Tighten CORS — remove the open `https://` wildcard | Free |

### When You Hit 50,000+ Users

| Action | Why |
|---|---|
| Add **Redis** (Upstash free tier) | Cache hot property listings, reduce DB queries |
| Add **DB indexes** on `properties.location`, `properties.price`, `properties.status` | Slow search queries are the #1 DB killer at scale |
| Enable **Neon read replicas** | Separate read-heavy listing queries from write operations |
| Move to **Render Standard** ($25/mo) | More RAM, faster CPU for higher concurrency |

---

## 5. Summary Verdict

| Layer | Scalability | SEO | Verdict |
|---|---|---|---|
| Go API (Render) | ✅ Language is excellent | N/A | ⚠️ **Upgrade tier + add rate limiting** |
| Neon DB | ✅ Correct pooler URL | N/A | ⚠️ **Upgrade tier + tune pool.go** |
| Next.js (Vercel) | ✅ Auto-scales | ⚠️ Needs fixes | 🟠 **Add metadata, sitemap, JSON-LD** |
| Images (Cloudinary) | ✅ CDN-delivered | ✅ Fast | ✅ Ready |

**Bottom line:** Your tech stack is solid and well-chosen for 20,000+ users. The main risks
are not architectural — they are **hosting tier limits** (Render free cold-starts, Neon
connection cap) and **missing SEO metadata** (no sitemap, no per-page titles, no JSON-LD).
Fix those items above and you are ready to launch.

---

*Report generated: May 2026 · Based on actual codebase review*
