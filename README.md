# HomeCrew — Home Services Platform (Coimbatore)

A full-stack progressive web app connecting customers with verified home-service providers across Coimbatore. Built as a monorepo with three apps sharing a common component and library layer.

> **Legal Notice:** The Privacy Policy (`packages/ui/src/LegalPages.tsx`) and Terms and Conditions in this repository are draft texts for review purposes only. They **must be reviewed and approved by a qualified lawyer admitted to practice in India** before this platform is used commercially or made available to the public.

---

## Architecture

```
/
├── apps/
│   ├── customer/      — Customer PWA (teal theme)  → Vercel: homecrew-customer
│   ├── provider/      — Provider PWA (orange theme) → Vercel: homecrew-provider
│   └── admin/         — Admin Console (navy theme)  → Vercel: homecrew-admin
├── packages/
│   ├── lib/           — Supabase client, services, types, i18n (EN + Tamil)
│   └── ui/            — Shared React component library (flat design)
└── supabase/
    ├── migrations/    — All DB schema migrations
    ├── functions/     — Edge functions (push-notifications)
    ├── seed.sql       — Base seed (areas, categories, settings)
    └── demo_seed.sql  — Full 5-scenario demo story
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Vanilla CSS |
| Backend | Supabase (Postgres + PostGIS, Auth, Realtime, Storage) |
| Push | Firebase Cloud Messaging (FCM) + VAPID |
| Hosting | Vercel (3 separate projects) |
| CI | GitHub Actions (keep-alive ping) |

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start local Supabase
npx supabase start

# 4. Run migrations + base seed
npx supabase db reset

# 5. Load demo story
psql "$(npx supabase status | grep 'DB URL' | awk '{print $NF}')" -f supabase/demo_seed.sql

# 6. Run apps (in separate terminals)
npm run dev:customer   # → http://localhost:5173
npm run dev:provider   # → http://localhost:5174
npm run dev:admin      # → http://localhost:5175
```

---

## Demo Guide

See [`supabase/DEMO_GUIDE.md`](supabase/DEMO_GUIDE.md) for:
- 5 annotated demo scenarios with click paths
- Auth user table with UUIDs
- Partial re-seed instructions

---

## Deployment

See the [deployment guide](https://github.com) (also available as an artifact in this project) covering:
- Three Vercel project setup
- Environment variables
- Google OAuth redirect URLs
- Supabase URL allowlist
- FCM / VAPID key configuration

---

## Key Business Rules

| Rule | Value |
|---|---|
| Ordinary booking hours | 08:00–19:00 |
| Ordinary advance booking | 2–30 days |
| Emergency radius | 13 km (expands to 20, then 30) |
| Emergency surcharge | +30% |
| Emergency platform fee | ₹50 (admin-configurable; future posts only) |
| Min coins to bid | 35 |
| Min reviews to bid | 3 |
| Min rating to bid | 3.5 ★ |
| Calendar gap between jobs | 8 hours |
| Withdrawal penalty | 50% of bid coins + −0.1 rating + 3-day ban |
| No-show penalty | Same as withdrawal |
| Completion base coins | 20 + up to 5 star bonus |
| Review blind window | 7 days |
| Chat retention | Read-only after 7 days; deleted after 90 days |
| Auto-complete (provider done) | 48 hours |
| Auto-complete (customer done) | 24 hours |

---

## Scripts

```bash
npm run dev:customer        # Customer dev server
npm run dev:provider        # Provider dev server
npm run dev:admin           # Admin dev server
npm run build               # Build all apps
npx tsc --noEmit            # Type check
npx oxlint .                # Lint
npm run lint:rules          # Custom business rule checks
```
