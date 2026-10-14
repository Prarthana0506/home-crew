import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Verify super admin inside Postgres and function
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Super admin required' }), { status: 403 })
    }

    const { action } = await req.json()
    if (!['enable', 'disable', 'refresh'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
    }

    if (action === 'disable') {
      // Remove demo rows where is_demo is true
      await adminClient.from('reviews').delete().eq('is_demo', true)
      await adminClient.from('coin_ledger').delete().eq('is_demo', true)
      await adminClient.from('bookings').delete().eq('is_demo', true)
      await adminClient.from('providers').delete().eq('is_demo', true)
      
      // Delete demo auth users using admin API
      const { data: demoUsers } = await adminClient
        .from('profiles')
        .select('id')
        .eq('is_demo', true)

      if (demoUsers) {
        for (const u of demoUsers) {
          await adminClient.auth.admin.deleteUser(u.id)
        }
      }
      await adminClient.from('profiles').delete().eq('is_demo', true)

      // Update settings
      await adminClient
        .from('app_settings')
        .update({ value: { enabled: false, last_seeded_at: null }, updated_at: new Date().toISOString() })
        .eq('key', 'sample_activity')

    } else if (action === 'enable' || action === 'refresh') {
      if (action === 'refresh') {
        // Clean existing demo data first to regenerate relative dates
        await adminClient.from('reviews').delete().eq('is_demo', true)
        await adminClient.from('coin_ledger').delete().eq('is_demo', true)
        await adminClient.from('bookings').delete().eq('is_demo', true)
        await adminClient.from('providers').delete().eq('is_demo', true)
        await adminClient.from('profiles').delete().eq('is_demo', true)
      }

      // Seed demo profiles, providers, bookings, reviews adhering to system rules
      const demoUserId = crypto.randomUUID()
      await adminClient.auth.admin.createUser({
        id: demoUserId,
        email: 'Aarav.kumar@demo.urbanclap.test',
        password: 'SharedDemoPassword123!',
        email_confirm: true
      })

      await adminClient.from('profiles').insert({
        id: demoUserId,
        name: 'Aarav Kumar',
        phone: '+919876543210',
        is_demo: true,
        coin_balance: 20
      })

      await adminClient.from('coin_ledger').insert({
        user_id: demoUserId,
        amount: 20,
        reason: 'completion_bonus',
        is_demo: true
      })

      // Update settings
      await adminClient
        .from('app_settings')
        .update({ value: { enabled: true, last_seeded_at: new Date().toISOString() }, updated_at: new Date().toISOString() })
        .eq('key', 'sample_activity')
    }

    // Write audit log row
    await adminClient.from('audit_log').insert({
      action: `sample_activity_${action}`,
      performed_by: user.id,
      details: { timestamp: new Date().toISOString() }
    })

    return new Response(JSON.stringify({ success: true, action }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})