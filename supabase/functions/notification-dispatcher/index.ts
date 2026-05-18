import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const CALLMEBOT_API_KEY = Deno.env.get('CALLMEBOT_API_KEY') || '';
const CALLMEBOT_RECIPIENTS = parseRecipients(Deno.env.get('CALLMEBOT_RECIPIENTS') || '');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  await queueArrivalAlerts(supabase);
  const { data: jobs, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(25);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const job of jobs ?? []) {
    try {
      await sendJob(job);
      await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', job.id);
      results.push({ id: job.id, status: 'sent' });
    } catch (err) {
      await supabase.from('notifications').update({ status: 'failed', error: String(err?.message || err) }).eq('id', job.id);
      results.push({ id: job.id, status: 'failed' });
    }
  }

  return json({ processed: results.length, results });
});

async function queueArrivalAlerts(supabase: ReturnType<typeof createClient>) {
  const from = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_reference, arrival_datetime, pickup_datetime, clients(full_name, phone), vehicles(registration)')
    .in('status', ['confirmed','active'])
    .gte('arrival_datetime', from)
    .lte('arrival_datetime', to);

  for (const booking of bookings ?? []) {
    const payload = { reference: booking.booking_reference, client: booking.clients?.full_name, client_phone: booking.clients?.phone, vehicle: booking.vehicles?.registration, arrival: booking.arrival_datetime };
    const scheduled_for = new Date().toISOString();
    const telegramRecipient = Deno.env.get('TELEGRAM_OPERATIONS_CHAT_ID');
    const jobs = [];

    if (telegramRecipient) {
      jobs.push({
        booking_id: booking.id,
        channel: 'telegram',
        recipient: telegramRecipient,
        template_key: 'arrival_24h',
        payload,
        scheduled_for,
      });
    }

    for (const recipient of CALLMEBOT_RECIPIENTS) {
      jobs.push({
        booking_id: booking.id,
        channel: 'callmebot',
        recipient,
        template_key: 'arrival_24h',
        payload,
        scheduled_for,
      });
    }

    if (jobs.length) {
      await supabase.from('notifications').upsert(jobs, { onConflict: 'booking_id,channel,template_key,recipient' });
    }
  }
}

async function sendJob(job: any) {
  const message = renderMessage(job.template_key, job.payload);
  if (job.channel === 'telegram') {
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: job.recipient, text: message }),
    });
    if (!res.ok) throw new Error(await res.text());
    return;
  }
  if (job.channel === 'callmebot') {
    if (!CALLMEBOT_API_KEY) throw new Error('CALLMEBOT_API_KEY not configured');
    const res = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(job.recipient)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(CALLMEBOT_API_KEY)}`);
    if (!res.ok) throw new Error(await res.text());
    return;
  }
  if (job.channel === 'email') {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') || 'Fhdan Fleet <noreply@fhdan.co.za>', to: job.recipient, subject: 'Fhdan Fleet Notification', text: message }),
    });
    if (!res.ok) throw new Error(await res.text());
    return;
  }
  throw new Error(`Unsupported channel ${job.channel}`);
}

function parseRecipients(value: string) {
  return [...new Set(value
    .split(/[\n,;]+/)
    .map((recipient) => recipient.trim())
    .filter(Boolean))];
}

function renderMessage(key: string, payload: Record<string, unknown>) {
  if (key === 'arrival_24h') return `Arrival alert: ${payload.client} (${payload.client_phone}) arrives at ${payload.arrival}. Booking ${payload.reference}, vehicle ${payload.vehicle}.`;
  if (key === 'unpaid_deposit') return `Finance alert: unpaid deposit for booking ${payload.reference}.`;
  if (key === 'late_return') return `Fleet alert: late return for booking ${payload.reference}.`;
  if (key === 'high_value_booking') return `Sales alert: high-value booking ${payload.reference}.`;
  return JSON.stringify(payload);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
