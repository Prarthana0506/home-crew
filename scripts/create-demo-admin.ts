/**
 * Creates (or updates) the demo admin used by the admin console's
 * no-login demo mode.
 *
 * Run: npm run setup:demo-admin
 *
 * Required in .env.seed:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   DEMO_ADMIN_PASSWORD=...   (choose a NEW password: it ends up in the
 *                              admin app's browser bundle)
 * Optional in .env.seed:
 *   DEMO_ADMIN_EMAIL=admin@demo.urbanclap.test
 *   SUPABASE_ANON_KEY=...     (only used to verify the sign-in)
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadEnv(file: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const text = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function main() {
  const env = await loadEnv(path.join(ROOT, '.env.seed'));
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const email = env.DEMO_ADMIN_EMAIL || 'admin@demo.urbanclap.test';
  const password = env.DEMO_ADMIN_PASSWORD;

  if (!url || !serviceKey || !password) {
    fail('.env.seed needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_ADMIN_PASSWORD.');
  }
  if (password.length < 8) {
    fail('DEMO_ADMIN_PASSWORD must be at least 8 characters.');
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create the auth user, or reset the password if it already exists
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) fail(`Could not list users: ${listErr.message}`);

  const existing = list.users.find(
    (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
  );

  let userId: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) fail(`Could not update demo admin: ${error.message}`);
    userId = existing.id;
    console.log(`Updated existing demo admin: ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Admin' },
    });
    if (error || !data.user) fail(`Could not create demo admin: ${error?.message}`);
    userId = data.user.id;
    console.log(`Created demo admin: ${email}`);
  }

  // 2. Make sure the profile exists with role = admin.
  //    is_demo stays FALSE on purpose: if this account were a demo account,
  //    switching the demo toggle OFF would lock the admin out of the console.
  const { error: profErr } = await admin.from('profiles').upsert(
    {
      id: userId,
      role: 'admin',
      name: 'Demo Admin',
      language: 'en',
      status: 'active',
      is_demo: false,
    },
    { onConflict: 'id' },
  );
  if (profErr) fail(`Could not set admin profile: ${profErr.message}`);
  console.log('Profile set: role = admin, is_demo = false');

  // 3. Optional: verify by signing in the same way the app does
  if (env.SUPABASE_ANON_KEY) {
    const anon = createClient(url, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.user) fail(`Sign-in check failed: ${error?.message}`);
    const { data: prof } = await anon
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    console.log(`Sign-in check OK. Role seen by the app: ${prof?.role ?? 'unknown'}`);
    await anon.auth.signOut();
  } else {
    console.log('Skipped sign-in check (no SUPABASE_ANON_KEY in .env.seed).');
  }

  console.log(`Done. Put the same email and password into apps/admin/.env.`);
}

main().catch((err) => fail(String(err?.message ?? err)));