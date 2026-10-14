# HomeCrew — Demo Reset Guide

This guide explains how to reset the database and load a full interactive demo story ready for viva presentation.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Supabase CLI | ≥ 1.180 (`npm i -g supabase`) |
| psql | ≥ 14 (optional, for direct SQL) |

---

## Option A — Full Reset via Supabase CLI (Local)

This drops the entire local database, re-runs all migrations, applies the base seed, and then applies the demo story.

```bash
# 1. Start the local Supabase stack (if not already running)
npx supabase start

# 2. Hard reset — drops DB, re-runs all migrations + supabase/seed.sql
npx supabase db reset

# 3. Apply the demo story on top
psql "$(npx supabase status | grep 'DB URL' | awk '{print $NF}')" \
     -f supabase/demo_seed.sql
```

After this, the local Studio at http://localhost:54323 shows all 5 demo scenarios.

---

## Option B — Remote Supabase Project (Production / Staging)

> **Warning:** This will truncate all non-settings rows. Use only on a dedicated demo project.

```bash
# Set your project DB URL (from Dashboard → Settings → Database → Connection string → URI)
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Apply base seed (areas, categories, settings)
psql $DATABASE_URL -f supabase/seed.sql

# Apply demo story
psql $DATABASE_URL -f supabase/demo_seed.sql
```

---

## Demo Accounts

After running the seed, create the following auth users in **Supabase Dashboard → Authentication → Users → Add User** (or via the service-role client). Use these exact UUIDs and emails.

| Role | Email | Password | UUID |
|------|-------|----------|------|
| Customer | priya@demo.homecrew | Demo@1234 | `dd000000-…-0001` |
| Customer | arun@demo.homecrew  | Demo@1234 | `dd000000-…-0002` |
| Provider | rajan@demo.homecrew  | Demo@1234 | `dd000000-…-0011` |
| Provider | kumaran@demo.homecrew| Demo@1234 | `dd000000-…-0012` |
| Provider | mani@demo.homecrew   | Demo@1234 | `dd000000-…-0013` |
| Provider | senthil@demo.homecrew| Demo@1234 | `dd000000-…-0014` |
| Provider | vinoth@demo.homecrew | Demo@1234 | `dd000000-…-0015` |
| Admin    | prarthanasampathkumar@gmail.com | 123456 | *(any)* |

> Set the admin user's `role = 'admin'` in `public.profiles` after creation.

---

## Demo Story — 5 Scenario Cards

### Scenario 1 — Pending Ordinary Job
- **Customer:** Priya Krishnan (`priya@demo.homecrew`)
- **Title:** "Kitchen Tap Leakage Fix" — Plumbing · RS Puram
- **State:** `pending` — no bids received yet
- **Demo click path:**
  1. Log in as Priya → **Services** tab → see the card with `PENDING` badge
  2. Open request → "No bids yet" empty state visible

### Scenario 2 — Emergency: Interest Window
- **Customer:** Arun Selvam (`arun@demo.homecrew`)
- **Title:** "Power Outage — MCB Keeps Tripping" — Electrical · Gandhipuram
- **State:** `interest_window` — 2 / 10 providers interested
- **Demo click path:**
  1. Log in as Kumaran or Mani → **Emergency Bidding** tab → see the interest card
  2. Click "Register Interest" → counter increments
  3. Log in as Admin → **Emergency** tab → force-start bidding

### Scenario 3 — Bidding Arena (3 active bids)
- **Customer:** Priya Krishnan
- **Title:** "Burst Pipe — Bathroom Flooded" — Plumbing · RS Puram
- **State:** `bidding_open` — closes in ~40 min (relative to seed time)
- **Bids:** Rajan 18c · Kumaran 20c · Mani 15c
- **Demo click path:**
  1. Log in as Priya → open request → see 3 bids ranked by coins
  2. Click "Accept this Bid" on Rajan → booking created

### Scenario 4 — Completed Job, Review Window Open
- **Customer:** Priya Krishnan
- **Provider:** Kumaran Pillai
- **Title:** "Full House Electrical Inspection" — Electrical · RS Puram
- **State:** `completed` — both parties marked done ~35 min ago, review opens now
- **Demo click path:**
  1. Log in as Priya → **History** tab → completed card
  2. Click "Leave Review" → stars + feedback → submit
  3. Log in as Kumaran → same → submit → both reviews revealed

### Scenario 5 — No-Show History Item
- **Customer:** Arun Selvam
- **Provider:** Vinoth Anand (bid-banned for 1 more day)
- **Title:** "Shower Head Replacement" — Plumbing · Gandhipuram
- **State:** `disputed` — no-show claimed, dispute `investigating`
- **Demo click path:**
  1. Log in as Arun → **History** → see disputed card
  2. Log in as Admin → **Disputes** tab → open dispute → write resolution → "Resolve"
  3. Provider Vinoth: bid-banned until tomorrow — try to bid → see "You are bid-banned" error

---

## Resetting Without Dropping (partial re-seed)

If you only want to re-inject the demo story without re-running migrations:

```sql
-- In Supabase SQL Editor — delete demo rows only
DELETE FROM public.service_requests WHERE id LIKE 'req00000%';
DELETE FROM public.bookings          WHERE id LIKE 'bk000000%';
DELETE FROM public.bids              WHERE request_id LIKE 'req00000%';
DELETE FROM public.disputes          WHERE request_id LIKE 'req00000%';
DELETE FROM public.coin_ledger       WHERE provider_profile_id LIKE 'pp000000%';
DELETE FROM public.provider_profiles WHERE id LIKE 'pp000000%';
DELETE FROM public.profiles          WHERE id LIKE 'dd000000%';
```

Then re-run `supabase/demo_seed.sql`.

---

## Environment Variables for Demo

```bash
# .env.local (copy from .env.example)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<from: npx supabase status>
```
