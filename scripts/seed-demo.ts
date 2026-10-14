
/**
 * HomeCrew / UrbanClap demo seeder
 *
 * Run:
 *   npm run seed:demo
 *   npm run seed:demo -- --skip-verify
 *
 * Required .env.seed:
 *   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
 *   DATABASE_URL=postgresql://...
 *   DEMO_SHARED_PASSWORD=...
 *
 * Requires psql on PATH.
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const ENV_PATH = path.join(ROOT, '.env.seed');
const SQL_PATH = path.join(ROOT, 'supabase', 'seed-demo.sql');
const DEMO_MARKER = 'homecrew-v1';

type Role = 'customer' | 'provider';

type DemoUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const DEMO_USERS: DemoUser[] = [
  {
    id: 'dd000000-0000-0000-0000-000000000001',
    email: 'priya@demo.homecrew.in',
    name: 'Priya Krishnan',
    role: 'customer',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000002',
    email: 'arun@demo.homecrew.in',
    name: 'Arun Selvam',
    role: 'customer',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000003',
    email: 'meena@demo.homecrew.in',
    name: 'Meena Rajan',
    role: 'customer',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000004',
    email: 'senthilc@demo.homecrew.in',
    name: 'Senthil Murugan',
    role: 'customer',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000005',
    email: 'kavitha@demo.homecrew.in',
    name: 'Kavitha Anand',
    role: 'customer',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000006',
    email: 'deepa@demo.homecrew.in',
    name: 'Deepa Natarajan',
    role: 'customer',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000011',
    email: 'rajan@demo.homecrew.in',
    name: 'Rajan Kumar',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000012',
    email: 'kumaran@demo.homecrew.in',
    name: 'Kumaran Pillai',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000013',
    email: 'mani@demo.homecrew.in',
    name: 'Mani Natarajan',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000014',
    email: 'senthilp@demo.homecrew.in',
    name: 'Senthil Prabhu',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000015',
    email: 'vinoth@demo.homecrew.in',
    name: 'Vinoth Anand',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000016',
    email: 'arjun@demo.homecrew.in',
    name: 'Arjun Subramaniam',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000017',
    email: 'karthik@demo.homecrew.in',
    name: 'Karthik Raj',
    role: 'provider',
  },
  {
    id: 'dd000000-0000-0000-0000-000000000018',
    email: 'balaji@demo.homecrew.in',
    name: 'Balaji Mohan',
    role: 'provider',
  },
];

function loadEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function required(
  env: Record<string, string>,
  key: string,
): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing ${key} in .env.seed`);
  }

  return value;
}

function deterministicUuid(value: string): string {
  const hex = createHash('sha256')
    .update(`homecrew-demo-v1:${value}`)
    .digest('hex')
    .slice(0, 32)
    .split('');

  // Format as a UUID with version/variant bits.
  hex[12] = '5';
  hex[16] = 'a';

  const result = hex.join('');

  return [
    result.slice(0, 8),
    result.slice(8, 12),
    result.slice(12, 16),
    result.slice(16, 20),
    result.slice(20, 32),
  ].join('-');
}

function isValidUuid(value: string): boolean {
  // Postgres accepts canonical UUIDs whose version/variant bits are not always
  // in the RFC 4122 subset used by the base seed. The real seed uses hex-only
  // UUIDs such as e0000000-... and f0000000-... whose version bits are zero,
  // so we intentionally validate only the canonical 8-4-4-4-12 hex shape.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function runSql(
  databaseUrl: string,
  sql: string,
): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: 'homecrew-demo-seed',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Database execution failed: ${message}`);
  } finally {
    await client.end();
  }
}

async function ensureRealtimeChatSchema(databaseUrl: string): Promise<void> {
  const migrationPath = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20261012000011_realtime_chat.sql',
  );

  const migrationSql = await readFile(migrationPath, 'utf8');
  await runSql(databaseUrl, migrationSql);
}

async function ensureDemoSchema(databaseUrl: string): Promise<void> {
  const tableExistsSql = `
    SELECT to_regclass('public.chat_messages') IS NOT NULL AS has_chat_messages;
  `;
  const check = await new Client({
    connectionString: databaseUrl,
    application_name: 'homecrew-demo-seed-check',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await check.connect();
    const result = await check.query(tableExistsSql);
    const hasChatMessages = !!result.rows[0]?.has_chat_messages;

    if (!hasChatMessages) {
      await ensureRealtimeChatSchema(databaseUrl);
    }
  } finally {
    await check.end();
  }

  const bootstrapSql = `
    ALTER TABLE IF EXISTS public.organizations
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.profiles
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.provider_profiles
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.service_requests
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.bookings
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS provider_marked_complete_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS customer_marked_complete_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS review_opens_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS noshow_claimed_at TIMESTAMPTZ;

    ALTER TABLE IF EXISTS public.bids
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.bid_interests
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.reviews
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.coin_ledger
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.chat_messages
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.disputes
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.messages
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS public.notifications
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  `;

  await runSql(databaseUrl, bootstrapSql);
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  // Paginate rather than assuming every user is on page one.
  for (let page = 1; ; page++) {
    const { data, error } =
      await supabase.auth.admin.listUsers({
        page,
        perPage: 200,
      });

    if (error) throw error;

    const found = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (found) return found;

    if (data.users.length < 200) return null;
  }
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createClient>,
  user: DemoUser,
  password: string,
): Promise<string> {
  const existing = await findAuthUserByEmail(
    supabase,
    user.email,
  );

  if (existing) {
    const metadata = existing.user_metadata ?? {};

    // Never take over an unrelated account merely because its
    // email happens to match a demo email.
    if (
      metadata.demo_seed !== DEMO_MARKER &&
      metadata.is_demo !== true
    ) {
      throw new Error(
        `Refusing to modify an Auth account not marked as demo: ${user.email}`,
      );
    }

    const { error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        user_metadata: {
          ...metadata,
          name: user.name,
          role: user.role,
          is_demo: true,
          demo_seed: DEMO_MARKER,
        },
      },
    );

    if (error) throw error;

    console.log(`Existing demo account verified: ${user.email}`);
    return existing.id;
  }

  const { data, error } =
    await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: user.role,
        is_demo: true,
        demo_seed: DEMO_MARKER,
      },
    });

  if (error) throw error;
  if (!data.user) {
    throw new Error(`No Auth user returned for ${user.email}`);
  }

  console.log(`Created demo account: ${user.email}`);
  return data.user.id;
}

function prepareSql(
  originalSql: string,
  userIdMap: Map<string, string>,
): string {
  // Replace only the fixed demo-auth user IDs with the live auth.user IDs.
  // We intentionally do NOT rewrite area/category IDs or other schema record IDs
  // because those are valid and must remain pointing at the real seed schema data.
  let sql = originalSql;

  sql = sql.replace(
    /v_now\s+TIMESTAMPTZ\s*:=\s*'[^']+'::timestamptz;/i,
    "v_now TIMESTAMPTZ := '2026-10-13 09:00:00+05:30'::timestamptz;",
  );

  for (const [oldId, newId] of [...userIdMap.entries()].sort((a, b) => b[0].length - a[0].length)) {
    sql = sql.replaceAll(`'${oldId}'`, `'${newId}'`);
  }

  // The demo seed ships with placeholder UUIDs such as "req00000-..." and
  // "pp000000-...". Those look like UUIDs but are not valid Postgres UUIDs
  // because they contain non-hex characters in the version/mask positions.
  // Convert any remaining invalid UUID-like literals to deterministic, valid UUIDs
  // so the SQL can be inserted into the live database without breaking PK/FK
  // relationships. Real area/category IDs from supabase/seed.sql are already valid
  // and are left untouched.
  const invalidUuidLike = new Set<string>();
  const invalidUuidRegex = /'([A-Za-z0-9]+-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})'/g;

  for (const match of sql.matchAll(invalidUuidRegex)) {
    const value = match[1];
    if (!isValidUuid(value)) {
      invalidUuidLike.add(value);
    }
  }

  for (const value of [...invalidUuidLike].sort((a, b) => b.length - a.length)) {
    sql = sql.replaceAll(`'${value}'`, `'${deterministicUuid(value)}'`);
  }

  return sql;
}

function buildForceCleanupSql(): string {
  return `
BEGIN;

DELETE FROM public.chat_messages
WHERE is_demo = TRUE;

DELETE FROM public.disputes
WHERE is_demo = TRUE;

DELETE FROM public.reviews
WHERE is_demo = TRUE;

DELETE FROM public.bid_interests
WHERE is_demo = TRUE;

DELETE FROM public.bids
WHERE is_demo = TRUE;

DELETE FROM public.bookings
WHERE is_demo = TRUE;

DELETE FROM public.coin_ledger
WHERE is_demo = TRUE;

DELETE FROM public.service_requests
WHERE is_demo = TRUE;

DELETE FROM public.provider_profiles
WHERE is_demo = TRUE;

DELETE FROM public.organizations
WHERE is_demo = TRUE;

DELETE FROM public.profiles
WHERE is_demo = TRUE;

COMMIT;
`;
}

function buildRefreshSql(): string {
  return `
BEGIN;

UPDATE public.service_requests
SET
  created_at = created_at + INTERVAL '30 days',
  preferred_start = preferred_start + INTERVAL '30 days',
  interest_expires_at = CASE WHEN interest_expires_at IS NOT NULL THEN interest_expires_at + INTERVAL '30 days' ELSE NULL END,
  bidding_closes_at = CASE WHEN bidding_closes_at IS NOT NULL THEN bidding_closes_at + INTERVAL '30 days' ELSE NULL END,
  updated_at = NOW()
WHERE is_demo = TRUE;

UPDATE public.bookings
SET
  created_at = created_at + INTERVAL '30 days',
  provider_marked_complete_at = CASE WHEN provider_marked_complete_at IS NOT NULL THEN provider_marked_complete_at + INTERVAL '30 days' ELSE NULL END,
  customer_marked_complete_at = CASE WHEN customer_marked_complete_at IS NOT NULL THEN customer_marked_complete_at + INTERVAL '30 days' ELSE NULL END,
  review_opens_at = CASE WHEN review_opens_at IS NOT NULL THEN review_opens_at + INTERVAL '30 days' ELSE NULL END,
  noshow_claimed_at = CASE WHEN noshow_claimed_at IS NOT NULL THEN noshow_claimed_at + INTERVAL '30 days' ELSE NULL END,
  time_range = tstzrange(
    lower(time_range) + INTERVAL '30 days',
    upper(time_range) + INTERVAL '30 days',
    '[)'
  )
WHERE is_demo = TRUE;

UPDATE public.bids
SET created_at = created_at + INTERVAL '30 days'
WHERE is_demo = TRUE;

UPDATE public.bid_interests
SET created_at = created_at + INTERVAL '30 days'
WHERE is_demo = TRUE;

UPDATE public.reviews
SET created_at = created_at + INTERVAL '30 days'
WHERE is_demo = TRUE;

UPDATE public.messages
SET created_at = created_at + INTERVAL '30 days'
WHERE is_demo = TRUE;

UPDATE public.disputes
SET created_at = created_at + INTERVAL '30 days'
WHERE is_demo = TRUE;

  UPDATE public.chat_messages
SET created_at = created_at + INTERVAL '30 days'
WHERE is_demo = TRUE;

COMMIT;
`;
}

async function deleteDemoAuthUsers(
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  for (const user of DEMO_USERS) {
    const existing = await findAuthUserByEmail(supabase, user.email);

    if (!existing) continue;

    const metadata = existing.user_metadata ?? {};
    if (metadata.demo_seed !== DEMO_MARKER && metadata.is_demo !== true) {
      continue;
    }

    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) {
      throw new Error(`Failed to delete demo Auth user ${user.email}: ${error.message}`);
    }

    console.log(`Deleted demo auth user: ${user.email}`);
  }
}

async function demoDataExists(databaseUrl: string): Promise<boolean> {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: 'homecrew-demo-seed-check',
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE is_demo = TRUE
        UNION ALL
        SELECT 1 FROM public.service_requests WHERE is_demo = TRUE
        UNION ALL
        SELECT 1 FROM public.provider_profiles WHERE is_demo = TRUE
      ) AS present;
    `);
    return Boolean(result.rows[0]?.present);
  } finally {
    await client.end();
  }
}

async function runSeedValidation(databaseUrl: string): Promise<void> {
  const checks = [
    `SELECT COUNT(*)::int AS v FROM public.profiles WHERE is_demo = TRUE;`,
    `SELECT COUNT(*)::int AS v FROM public.provider_profiles WHERE is_demo = TRUE;`,
    `SELECT COUNT(*)::int AS v FROM public.service_requests WHERE is_demo = TRUE;`,
    `SELECT COUNT(*)::int AS v FROM public.reviews WHERE is_demo = TRUE;`,
    `SELECT COUNT(*)::int AS v FROM public.coin_ledger WHERE is_demo = TRUE AND amount < 0;`,
  ];

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: 'homecrew-demo-validation',
  });

  try {
    await client.connect();

    for (const sql of checks) {
      const result = await client.query(sql);
      const value = Number(result.rows[0]?.v ?? 0);
      const pass = value >= 0;
      console.log(`${pass ? 'PASS' : 'FAIL'} :: ${sql.replace(/\s+/g, ' ').trim()}`);
    }

    const categoryCoverage = await client.query(`
      SELECT sc.slug, COUNT(sr.id)::int AS service_count
      FROM public.service_categories sc
      LEFT JOIN public.service_requests sr
        ON sr.category_id = sc.id AND sr.is_demo = TRUE
      GROUP BY sc.id, sc.slug
      ORDER BY sc.slug;
    `);

    const emptyCategories = categoryCoverage.rows.filter((row) => Number(row.service_count ?? 0) <= 0);

    if (emptyCategories.length > 0) {
      throw new Error(
        `Demo seed is missing category coverage: ${emptyCategories.map((row) => row.slug).join(', ')}`,
      );
    }

    console.log(
      `PASS :: Demo seed covers ${categoryCoverage.rowCount ?? 0} categories with at least one demo request each.`,
    );
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  const envContent = await readFile(ENV_PATH, 'utf8').catch(() => {
    throw new Error(
      'Missing .env.seed. Copy .env.seed.example and configure it locally.',
    );
  });

  const env = loadEnvFile(envContent);

  const supabaseUrl = required(env, 'SUPABASE_URL');
  const serviceRoleKey = required(
    env,
    'SUPABASE_SERVICE_ROLE_KEY',
  );
  const databaseUrl = required(env, 'DATABASE_URL');
  const password = required(env, 'DEMO_SHARED_PASSWORD');

  if (!/^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl)) {
    throw new Error('SUPABASE_URL must be your HTTPS Supabase project URL.');
  }

  // The service role key is a JWT — it starts with eyJ.
  // The publishable/anon key starts with sb_publishable or similar.
  // Go to: Supabase Dashboard → Project Settings → API → service_role (secret)
  if (!serviceRoleKey.startsWith('eyJ')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY looks like the anon/publishable key, not the service role key.\n' +
      '  The service role key starts with "eyJ" (it is a JWT).\n' +
      '  Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)\n' +
      '  NEVER add this key to Vite env vars or commit it to Git.'
    );
  }

  if (password.length < 10) {
    throw new Error('DEMO_SHARED_PASSWORD must be at least 10 characters.');
  }

  const sql = await readFile(SQL_PATH, 'utf8').catch(() => {
    throw new Error(
      `seed-demo.sql not found at ${SQL_PATH}\n` +
      '  Run this script from the project root, or ensure supabase/seed-demo.sql exists.'
    );
  });

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  if (args.has('--help') || args.has('-h')) {
    console.log('Usage: npm run seed:demo [--force] [--refresh]');
    console.log('  --force    delete only demo-marked profile/request/bid/review data and demo Auth users');
    console.log('  --refresh  shift demo timestamps forward by 30 days while preserving relationships');
    return;
  }

  if (args.has('--force')) {
    console.log('Removing demo-only Auth users and seeded data...');
    await deleteDemoAuthUsers(supabase);

    const cleanupSql = buildForceCleanupSql();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'homecrew-demo-force-'));
    const tempSql = path.join(tempDir, 'cleanup-demo.sql');

    try {
      await writeFile(tempSql, cleanupSql, { encoding: 'utf8', mode: 0o600 });
      await ensureDemoSchema(databaseUrl);
      await runSql(databaseUrl, cleanupSql);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    console.log('Demo cleanup complete. Re-run npm run seed:demo to reapply the dataset.');
    return;
  }

  if (await demoDataExists(databaseUrl)) {
    console.log('Demo data already exists. Use --force to delete it before reseeding.');
    return;
  }

  if (args.has('--refresh')) {
    const refreshSql = buildRefreshSql();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'homecrew-demo-refresh-'));
    const tempSql = path.join(tempDir, 'refresh-demo.sql');

    try {
      await writeFile(tempSql, refreshSql, { encoding: 'utf8', mode: 0o600 });
      await ensureDemoSchema(databaseUrl);
      await runSql(databaseUrl, refreshSql);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    console.log('Demo timestamps refreshed by 30 days.');
    return;
  }

  console.log('HomeCrew demo seeder');
  console.log(`Creating/verifying ${DEMO_USERS.length} demo Auth users.`);

  const userIdMap = new Map<string, string>();

  for (const user of DEMO_USERS) {
    const actualId = await ensureAuthUser(
      supabase,
      user,
      password,
    );

    userIdMap.set(user.id, actualId);
  }

  const transformedSql = prepareSql(sql, userIdMap);
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), 'homecrew-demo-'),
  );

  const tempSql = path.join(tempDir, 'seed-demo.sql');

  try {
    await writeFile(tempSql, transformedSql, {
      encoding: 'utf8',
      mode: 0o600,
    });

    console.log('Ensuring demo database contract...');
    await ensureDemoSchema(databaseUrl);
    console.log('Applying demo SQL through the PostgreSQL client...');
    await runSql(databaseUrl, transformedSql);

    console.log('Demo SQL execution completed.');
    console.log('Running SQL validation checks...');
    await runSeedValidation(databaseUrl);
    console.log(
      'Review the SQL seed and database results before enabling Sample Activity.',
    );
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error(`Demo seed failed: ${message}`);
  process.exitCode = 1;
});
