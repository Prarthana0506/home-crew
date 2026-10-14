/**
 * Admin Credential Setup Script
 * Run: npx tsx scripts/setup-admin.ts
 *
 * This script creates the admin user (or updates existing credentials) and
 * sets their profile role to 'admin' in the Supabase database.
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const SUPABASE_URL = 'https://eqvbkdeunpyrbodqfjbo.supabase.co';

// ── You MUST paste your SERVICE ROLE key here ─────────────────────────────────
// Find it at: https://supabase.com/dashboard/project/eqvbkdeunpyrbodqfjbo/settings/api
// Under "Project API keys" → "service_role" (secret) key
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const NEW_EMAIL    = 'prarthanasampathkumar@gmail.com';
const NEW_PASSWORD = '123456';

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
    console.error('   Get it from: https://supabase.com/dashboard/project/eqvbkdeunpyrbodqfjbo/settings/api');
    console.error('   Then run: $env:SUPABASE_SERVICE_ROLE_KEY="your_key_here"; npx tsx scripts/setup-admin.ts\n');
    process.exit(1);
  }

  // Use service role client (bypasses RLS, can manage auth.users)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('\n🔧 HomeCrew Admin Credential Setup');
  console.log('─'.repeat(50));

  // ── Step 1: List existing admin users ──────────────────────────────────────
  console.log('\n📋 Checking existing admin users...');
  const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Failed to list users:', listErr.message);
    process.exit(1);
  }

  const oldAdminEmails = ['admin@demo.homecrew', 'admin@urbanclap.com', 'admin@homecrew.in', NEW_EMAIL];
  const existingAdmin = existingUsers.users.find(u => oldAdminEmails.includes(u.email ?? ''));

  if (existingAdmin) {
    console.log(`✅ Found existing admin user: ${existingAdmin.email} (id: ${existingAdmin.id})`);

    // ── Step 2: Update email + password ──────────────────────────────────────
    console.log('\n🔄 Updating credentials...');
    const { data: updatedUser, error: updateErr } = await supabase.auth.admin.updateUserById(
      existingAdmin.id,
      {
        email:    NEW_EMAIL,
        password: NEW_PASSWORD,
        email_confirm: true,
      }
    );

    if (updateErr) {
      console.error('❌ Failed to update credentials:', updateErr.message);
      process.exit(1);
    }

    console.log(`✅ Email updated to: ${updatedUser.user.email}`);

    // ── Step 3: Ensure profile role = 'admin' ────────────────────────────────
    await ensureAdminProfile(supabase, existingAdmin.id);

  } else {
    // ── Create new admin user ─────────────────────────────────────────────────
    console.log('\n➕ No existing admin found. Creating new admin user...');
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email:    NEW_EMAIL,
      password: NEW_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Prarthana Admin', role: 'admin' },
    });

    if (createErr) {
      console.error('❌ Failed to create admin user:', createErr.message);
      process.exit(1);
    }

    console.log(`✅ Created admin user: ${newUser.user.email} (id: ${newUser.user.id})`);

    await ensureAdminProfile(supabase, newUser.user.id);
  }

  // ── Step 4: Verify ────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying credentials by signing in...');
  const anonClient = createClient(SUPABASE_URL, 'sb_publishable_IQ2c99UrfIf1Dnq-bUstjg_8Fen3SLt');
  const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
    email:    NEW_EMAIL,
    password: NEW_PASSWORD,
  });

  if (signInErr) {
    console.error('❌ Sign-in verification failed:', signInErr.message);
    process.exit(1);
  }

  const { data: prof } = await anonClient.from('profiles').select('role').eq('id', session.user.id).single();
  console.log(`✅ Sign-in SUCCESS! User role = "${prof?.role}"`);

  if (prof?.role !== 'admin') {
    console.warn('⚠️  Profile role is not "admin" — fixing...');
    await ensureAdminProfile(supabase, session.user.id);
  }

  await anonClient.auth.signOut();

  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Admin setup complete!');
  console.log(`   Email    : ${NEW_EMAIL}`);
  console.log(`   Password : ${NEW_PASSWORD}`);
  console.log(`   App URL  : http://localhost:3002`);
  console.log('═'.repeat(50) + '\n');
}

async function ensureAdminProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  // Check if profile exists
  const { data: prof } = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();

  if (!prof) {
    // Create profile
    const { error } = await supabase.from('profiles').insert({
      id:                  userId,
      role:                'admin',
      name:                'Prarthana Admin',
      language:            'en',
      phone_demo_verified: false,
      status:              'active',
    });
    if (error) console.warn('⚠️  Could not create profile:', error.message);
    else console.log('✅ Profile created with role = admin');
  } else if (prof.role !== 'admin') {
    // Update role
    const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
    if (error) console.warn('⚠️  Could not update profile role:', error.message);
    else console.log(`✅ Profile role updated: ${prof.role} → admin`);
  } else {
    console.log('✅ Profile role already = admin');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
