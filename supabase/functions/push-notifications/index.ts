// Supabase Edge Function: push-notifications
// Sends free Web Push / FCM notifications to user's registered device_tokens.
// Handles English and Tamil templates, quiet hours logic, and in-app notifications inbox logging.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushRequestPayload {
  user_id?: string;
  user?: string;
  template: string;
  data?: Record<string, unknown>;
  is_emergency?: boolean;
}

interface WebhookRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
  read: boolean;
  priority?: string;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    let template: string = 'general';
    let title: string = 'HomeCrew Alert';
    let bodyText: string = 'You have a new update.';
    let dataPayload: Record<string, unknown> = {};
    let notificationId: string | null = null;
    let priority: string = 'normal';

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await req.json();

      // Database Webhook shape: { type: 'INSERT', table: 'notifications', record: {...} }
      if (body.record) {
        const record = body.record as WebhookRecord;
        notificationId = record.id;
        userId = record.user_id;
        title = record.title;
        bodyText = record.body;
        template = record.type;
        dataPayload = record.data ?? {};
        priority = record.priority ?? 'normal';
      } else {
        // Direct invocation: { user, template, data, is_emergency }
        const direct = body as PushRequestPayload;
        userId = direct.user_id || direct.user || null;
        template = direct.template;
        dataPayload = direct.data ?? {};

        if (userId) {
          // Call DB RPC send_push to handle translation, quiet hours, and logging
          const { data: dbResult, error: dbErr } = await supabase.rpc('send_push', {
            p_user_id: userId,
            p_template: template,
            p_data: dataPayload,
            p_is_emergency: direct.is_emergency ?? (priority === 'emergency')
          });

          if (!dbErr && dbResult) {
            title = dbResult.title || title;
            bodyText = dbResult.body || bodyText;
            notificationId = dbResult.notification_id;
          }
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch registered device tokens for this user
    const { data: tokens, error: tokenErr } = await supabase
      .from('device_tokens')
      .select('token, platform')
      .eq('user_id', userId);

    if (tokenErr) {
      console.warn('push-notifications: failed to fetch device tokens:', tokenErr.message);
    }

    const results: Array<{ token: string; status: string; error?: string }> = [];

    // Construct FCM payload
    const fcmNotification = {
      title,
      body: bodyText,
      image: (dataPayload.image_url as string) || undefined,
      icon: '/favicon.svg'
    };

    const fcmData = {
      ...dataPayload,
      template,
      url: (dataPayload.url as string) || '/',
      click_action: (dataPayload.url as string) || '/',
      notification_id: notificationId || ''
    };

    if (tokens && tokens.length > 0 && fcmServerKey) {
      // Send to each FCM token
      for (const t of tokens) {
        try {
          const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `key=${fcmServerKey}`
            },
            body: JSON.stringify({
              to: t.token,
              priority: priority === 'emergency' || priority === 'high' ? 'high' : 'normal',
              notification: fcmNotification,
              data: fcmData
            })
          });

          const respJson = await fcmResponse.json();
          if (respJson.success === 1) {
            results.push({ token: t.token.substring(0, 30) + '...', status: 'sent' });
          } else {
            // Remove invalid/expired token if unregistered
            if (respJson.results?.[0]?.error === 'NotRegistered') {
              await supabase.from('device_tokens').delete().eq('token', t.token);
            }
            results.push({ token: t.token.substring(0, 30) + '...', status: 'error', error: respJson.results?.[0]?.error });
          }
        } catch (err: unknown) {
          const errStr = err instanceof Error ? err.message : String(err);
          results.push({ token: t.token.substring(0, 30) + '...', status: 'error', error: errStr });
        }
      }
    } else {
      // Fallback: Realtime delivers in-app to notifications inbox
      results.push({
        token: 'in_app_inbox',
        status: tokens && tokens.length > 0 ? 'logged_fcm_key_optional' : 'delivered_in_app'
      });
    }

    // Update notifications table status
    if (notificationId) {
      await supabase
        .from('notifications')
        .update({
          push_delivered: results.some(r => r.status === 'sent' || r.status === 'delivered_in_app')
        })
        .eq('id', notificationId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        template,
        title,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('push-notifications: unhandled error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});