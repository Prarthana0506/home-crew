# HomeCrew / UrbanClap — Demo Accounts

## 1. Purpose

This document describes the fictional customer and provider accounts used to demonstrate the HomeCrew application.

Demo accounts and their related activity are identified using `is_demo = true`. Demo data is controlled by the `demo_data_enabled` setting.

- **Sample Activity ON:** Demo accounts and eligible demo activity are visible.
- **Sample Activity OFF:** Demo activity is hidden but retained in the database.
- **Permanent deletion:** An authorized super-admin can permanently remove demo data using the protected admin action.

Demo credentials are for local development, testing, and authorized demonstrations only.

## 2. Demo Account Configuration

The seed script is responsible for creating actual Supabase Auth users and their corresponding application profiles.

| Account type | Target count | Purpose |
|---|---:|---|
| Customer | 6 | Create service requests, view bids, manage bookings, and exchange messages |
| Provider | 8 | View eligible requests, submit bids, manage bookings, and receive reviews |
| Admin | Existing account | Manage the dashboard and Sample Activity setting |

The target counts describe the intended seed data. They do not guarantee that seeding has completed successfully.

## 3. Login Credentials

The seed script configures one shared demo password for the generated customer and provider accounts.

**Shared demo password:** Set `DEMO_SHARED_PASSWORD` in the local seed environment, or use the password configuration explicitly supported by `scripts/seed-demo.ts`.

**Demo email addresses:** These generated accounts are created by the seed script and are the exact addresses to use for local sample sign-in.

- `priya@demo.homecrew.in`
- `arun@demo.homecrew.in`
- `meena@demo.homecrew.in`
- `senthilc@demo.homecrew.in`
- `kavitha@demo.homecrew.in`
- `deepa@demo.homecrew.in`
- `rajan@demo.homecrew.in`
- `kumaran@demo.homecrew.in`
- `mani@demo.homecrew.in`
- `senthilp@demo.homecrew.in`
- `vinoth@demo.homecrew.in`
- `arjun@demo.homecrew.in`
- `karthik@demo.homecrew.in`
- `balaji@demo.homecrew.in`

The demo password is intentionally shared across sample users. This document is for development and demonstration purposes only and must never be linked from any app UI or marketing surface.

Never put real user passwords, Supabase service-role keys, or other secrets in this document.

## 4. Required Local Environment

Create a `.env.seed` file in the project root:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
DEMO_SHARED_PASSWORD=YOUR_STRONG_DEMO_PASSWORD
```

Replace the placeholder values with the correct project configuration.

### Security requirements

- Keep `.env.seed` out of Git.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code, client bundles, public documentation, or Vercel frontend environment variables.
- Never commit the shared demo password if it is a real configured credential.
- Use only fictional names and test phone numbers for generated accounts.
- Do not use real customers' or providers' personal information as demo data.

## 5. Creating Demo Accounts

From the project root, run:

```bash
npm run seed:demo
```

The seed script should:

1. Connect to the configured Supabase project using the service-role key.
2. Create or reuse the designated demo Auth users.
3. Create the corresponding `profiles` and `provider_profiles` records.
4. Create provider records if required by the existing application.
5. Generate connected demo requests, bids, bookings, messages, reviews, notifications, and supported transaction records.
6. Mark every demo-owned record with `is_demo = true`.
7. Preserve existing real users and real application records.
8. Avoid duplicate records when run repeatedly.

The script should report success or failure for each major stage and must not print secret credentials.

## 6. Refreshing Demo Activity

Run:

```bash
npm run seed:refresh
```

The refresh operation should shift demo dates forward while preserving relationships and scenario consistency.

It must not delete or modify real customer/provider records. It should retain the demo ownership markers and valid foreign-key relationships.

## 7. Recreating Demo Data

To remove and recreate demo records, use the supported force option:

```bash
npm run seed:demo -- --force
```

Only use this operation after confirming that the seed script implements dependency-safe cleanup restricted to records marked as demo.

This operation must not delete real accounts or records.

## 8. Admin Sample Activity Control

The admin dashboard should use the database-backed setting:

```text
demo_data_enabled
```

The setting is managed through the protected RPC:

```text
public.set_demo_data_enabled(enabled boolean)
```

Only explicitly allowlisted super-admins may change the setting.

When Sample Activity is turned OFF:

- Demo records remain stored.
- Demo records must be excluded from dashboard counts, charts, search, queues, and relevant application queries.
- Demo users must not be able to sign in if the application's demo-account login restriction is implemented.
- Real users must not be allowed to modify demo-owned jobs or related activity.

When Sample Activity is turned ON, eligible demo records should become visible again.

## 9. Permanent Deletion

Permanent deletion is separate from turning Sample Activity OFF.

The deletion action must:

1. Be available only to an authorized super-admin.
2. Be disabled while Sample Activity is ON.
3. Require explicit typed confirmation.
4. Delete demo-owned records in dependency-safe order.
5. Delete only Auth users positively identified as demo accounts by the seed system.
6. Record an audit entry for the operation.
7. Leave all real customer/provider data untouched.
8. Confirm when no demo records remain.

Do not manually delete records from production tables to clear demo activity.

## 10. Demo Data Integrity

Demo records must follow the same business rules as normal application records.

- Use valid existing area and service-category IDs.
- Keep all foreign-key relationships consistent.
- Use valid booking statuses and service-request statuses.
- Avoid overlapping bookings and enforce required booking gaps.
- Schedule ordinary bookings within the application's permitted working hours.
- Create reviews only for completed demo bookings/jobs.
- Create coin balances through the supported ledger mechanism.
- Do not directly fabricate derived coin balances.
- Generate revenue only from supported completed/paid transactions.
- Keep real and demo metrics distinguishable.

## 11. Troubleshooting

### Demo accounts cannot sign in

- Confirm that the seed script completed successfully.
- Verify the account exists in Supabase Authentication.
- Confirm the related `profiles` row exists.
- Confirm the account has the expected role and status.
- Check the application's demo sign-in restriction and authentication logs.

### Demo activity is missing

- Confirm the `demo_data_enabled` setting is enabled.
- Confirm demo rows are correctly marked `is_demo = true`.
- Check that RLS policies, views, RPCs, and dashboard queries respect the visibility setting.
- Check browser and Supabase logs for query errors.

### Admin controls are unavailable

- Confirm the signed-in user has the expected admin profile.
- Confirm the intended super-admin has been explicitly added to `public.demo_super_admins`.
- Confirm the protected RPCs are present and executable by the authenticated role.

### Seed command fails

- Check the local `.env.seed` values.
- Confirm the required migrations have been applied in the correct order.
- Review the seed script's error output.
- Never work around a seed failure by deleting or modifying real records.

---

**Maintenance:** Update this document whenever the seed script, demo account naming convention, credential configuration, or admin controls change.
