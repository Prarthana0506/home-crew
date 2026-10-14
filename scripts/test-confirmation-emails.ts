import fs from 'fs';
import path from 'path';

// Load .env if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      process.env[k] = v;
    }
  }
}

async function runTests() {
  const { isValidEmail, sendConfirmationEmail, getBookingEmailDetails, supabase } = await import('../packages/lib/src');
  console.log('--- Testing Email Validation & Confirmation Flow ---');

  // Test 1: Client regex validator isValidEmail
  console.log('\n[1] Testing client-side isValidEmail:');
  const invalidEmails = ['', '   ', 'bad-email', 'invalid@', '@domain.com', 'user@domain', 'user@.com', 'user@domain.c'];
  for (const email of invalidEmails) {
    const valid = isValidEmail(email);
    console.log(`  "${email}" => valid: ${valid} (Expected: false)`);
    if (valid) throw new Error(`Expected "${email}" to be invalid!`);
  }

  const validEmails = ['test@example.com', 'john.doe@company.org', 'provider+pro@service.co.in'];
  for (const email of validEmails) {
    const valid = isValidEmail(email);
    console.log(`  "${email}" => valid: ${valid} (Expected: true)`);
    if (!valid) throw new Error(`Expected "${email}" to be valid!`);
  }
  console.log('  ✓ Client validation tests passed.');

  // Test 2: Database RPC validate_and_send_email with invalid email
  console.log('\n[2] Testing RPC validate_and_send_email with invalid email:');
  const invalidRes = await sendConfirmationEmail({
    email: 'not-a-valid-email',
    recipientName: 'Test Invalid',
    recipientRole: 'customer',
    emailType: 'request_confirmation',
    subject: 'Test Invalid Subject',
    bodyText: 'Test Invalid Body',
    bodyHtml: '<p>Test Invalid Body</p>',
  });
  console.log('  Result:', invalidRes);
  if (invalidRes.success !== false) {
    throw new Error('Expected RPC to reject invalid email!');
  }
  if (!invalidRes.message.includes('Not valid mail') && !invalidRes.message.includes('valid mail')) {
    throw new Error('Expected message to prompt for valid mail!');
  }
  console.log('  ✓ RPC correctly rejected invalid email with warning message.');

  // Test 3: Database RPC validate_and_send_email with valid email
  console.log('\n[3] Testing RPC validate_and_send_email with valid email:');
  const validRes = await sendConfirmationEmail({
    email: 'customer.test@example.com',
    recipientName: 'Test Customer',
    recipientRole: 'customer',
    emailType: 'request_confirmation',
    subject: '[HomeCrew] Request Confirmation: AC Deep Cleaning',
    bodyText: 'Your service request has been confirmed.',
    bodyHtml: '<p>Your service request has been confirmed.</p>',
  });
  console.log('  Result:', validRes);
  if (validRes.success !== true) {
    throw new Error(`Expected RPC to accept valid email, got: ${JSON.stringify(validRes)}`);
  }
  console.log('  ✓ RPC successfully recorded valid email in sent_emails!');

  // Test 4: Query sent_emails to verify persistence
  console.log('\n[4] Verifying sent_emails row:');
  const { data: sentRows, error: sentErr } = await supabase
    .from('sent_emails')
    .select('*')
    .eq('recipient_email', 'customer.test@example.com')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sentErr) throw sentErr;
  console.log('  Found sent_email record:', sentRows?.[0]?.subject, '| status:', sentRows?.[0]?.status);
  if (!sentRows || sentRows.length === 0) {
    throw new Error('No sent_emails row found!');
  }
  console.log('  ✓ sent_emails persistence confirmed.');

  console.log('\n========================================');
  console.log('All confirmation mail tests passed successfully!');
  console.log('========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
