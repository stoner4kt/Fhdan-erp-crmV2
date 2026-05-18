# Fhdan Fleet Hub — Production Setup Guide

This guide deploys the MVP as a production-ready Cloudflare Pages application backed by Supabase Auth, PostgreSQL, RLS, Storage, Supabase Edge Functions, and an optional Cloudflare Worker cron for secure notifications.

## 1. Accounts and credentials to collect

| Credential | Where to get it | Where to set it |
| --- | --- | --- |
| Supabase Project URL | Supabase Dashboard → Project Settings → API → Project URL | `js/config.js`, Cloudflare Pages variables, Supabase Edge Function secrets |
| Supabase anon/public key | Supabase Dashboard → Project Settings → API → anon public | `js/config.js`, Cloudflare Pages variable `SUPABASE_ANON_KEY` |
| Supabase service role key | Supabase Dashboard → Project Settings → API → service_role | Cloudflare Pages variable `SUPABASE_SERVICE_ROLE_KEY`, Supabase Edge Function secret, Cloudflare Worker secret |
| Telegram bot token | Telegram → message `@BotFather` → `/newbot` | Supabase Edge Function secret `TELEGRAM_BOT_TOKEN` |
| Telegram group chat ID | Add the bot to the group, send a message, then open `https://api.telegram.org/bot<token>/getUpdates` | Supabase Edge Function secret `TELEGRAM_OPERATIONS_CHAT_ID` |
| CallMeBot API key | Follow CallMeBot WhatsApp activation instructions at CallMeBot | Supabase Edge Function secret `CALLMEBOT_API_KEY` |
| CallMeBot recipients | WhatsApp numbers activated with CallMeBot, separated by commas, semicolons, or new lines | Supabase Edge Function secret `CALLMEBOT_RECIPIENTS` |
| Resend API key | Resend Dashboard → API Keys | Supabase Edge Function secret `RESEND_API_KEY` |
| Email sender | Resend Dashboard → Domains, verify your domain | Supabase Edge Function secret `EMAIL_FROM` |
| Cloudflare Account ID/API token | Cloudflare Dashboard → My Profile → API Tokens | Local `wrangler` deployment only |

> Never put the Supabase service-role key, Telegram token, CallMeBot key, or Resend key in browser files. Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` belong in `js/config.js`.

## 2. Create and harden Supabase

1. Create a Supabase project in the closest region to your users, preferably `af-south-1` for South Africa.
2. Open Supabase → SQL Editor → New Query.
3. Paste and run the full contents of `supabase/schema.sql`.
4. Confirm that RLS is enabled on all operational tables. The schema creates profiles, clients, vehicles, drivers, bookings, invoices, payments, encrypted document metadata, maintenance windows, incidents, notifications, and immutable audit logs.
5. Create private Storage buckets:
   - `document-vault` for uploaded ID/passport/license documents.
   - `generated-documents` for generated invoice/voucher HTML or PDF artifacts.
6. Keep buckets private. Use server-side functions for privileged reads/writes when adding full binary upload support.

## 3. Configure local browser credentials

Open `js/config.js` and set:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

The app uses Supabase Auth from the browser and relies on RLS policies to restrict records by role.

## 4. Staff users and role routing

1. Create the first system administrator in Supabase Authentication → Users.
2. Run SQL to assign the role:

```sql
UPDATE public.profiles
SET role = 'system_admin', full_name = 'System Administrator', is_active = true
WHERE email = 'admin@yourdomain.co.za';
```

3. After Cloudflare Pages Functions are deployed, admins can create users from Settings. That screen calls `/api/staff-users`, which uses the service-role key server-side and then writes the correct profile role.
4. Staff are redirected after login by role:
   - `system_admin` and `manager` → `/dashboard`
   - `finance_officer` → `/finance`
   - `sales_agent` → `/bookings`
   - `fleet_coordinator` → `/fleet`
   - `driver` → `/driver-trips`

## 5. Deploy Supabase Edge Functions

Install the Supabase CLI, log in, then deploy:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy notification-dispatcher
supabase functions deploy generate-booking-documents
```

Set secrets:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
supabase secrets set TELEGRAM_OPERATIONS_CHAT_ID=YOUR_TELEGRAM_GROUP_CHAT_ID
supabase secrets set CALLMEBOT_API_KEY=YOUR_CALLMEBOT_KEY
supabase secrets set CALLMEBOT_RECIPIENTS='+27821234567,+27827654321'
supabase secrets set RESEND_API_KEY=YOUR_RESEND_KEY
supabase secrets set EMAIL_FROM='Fhdan Fleet <noreply@yourdomain.co.za>'
```

Use `notification-dispatcher` for Telegram, CallMeBot, and email alerts. Use `generate-booking-documents` to create server-side invoice/voucher artifacts in the `generated-documents` bucket.

## 6. Deploy Cloudflare Pages

1. Push this repository to GitHub/GitLab.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Select the repo.
4. Build settings:
   - Framework preset: None
   - Build command: leave blank
   - Build output directory: `/`
   - The root `wrangler.toml` contains only `pages_build_output_dir = "."` so Cloudflare Pages validation succeeds. Worker cron settings live in `workers/wrangler.toml` and are deployed separately.
5. Add Pages environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Deploy.
7. In Supabase Authentication → URL Configuration, set Site URL and Redirect URLs to your Pages URL and custom domain.

The Cloudflare Pages Function `functions/api/staff-users.js` uses these variables to create staff users securely without exposing privileged keys to the browser.

## 7. Deploy the Cloudflare notification Worker

The Worker in `workers/notification-cron.js` calls the Supabase `notification-dispatcher` Edge Function every 15 minutes via `workers/wrangler.toml`. This scheduled Worker is separate from the Pages deployment: Pages hosts the static app and `/functions/api/*`, while this Worker provides cron triggers that Pages Functions do not run on their own. Keep Worker-only keys such as `main` and `[triggers]` out of the root `wrangler.toml`, because Cloudflare Pages validation rejects them when `pages_build_output_dir` is present.

```bash
npm install -g wrangler
wrangler login
cd workers
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler deploy
```

The cron expression is in `workers/wrangler.toml`:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

## 8. Notification setup

1. Create a Telegram bot with `@BotFather`.
2. Add it to your agency operations group.
3. Send any message in the group.
4. Visit `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates` and copy the group `chat.id`.
5. Put the chat ID into `TELEGRAM_OPERATIONS_CHAT_ID`.
6. For CallMeBot, activate every target WhatsApp number, set `CALLMEBOT_API_KEY`, and set `CALLMEBOT_RECIPIENTS` to the activated phone numbers separated by commas, semicolons, or new lines.
7. For email, verify your sending domain in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`.

The dispatcher supports high-value booking, unpaid deposit, late return, and 24-hour arrival alert templates. Arrival alerts are queued from bookings with `arrival_datetime` approximately 24 hours away.

## 9. Production checklist

- Run `supabase/schema.sql` successfully.
- Create `document-vault` and `generated-documents` private buckets.
- Configure `js/config.js` with anon credentials.
- Configure Cloudflare Pages environment variables.
- Deploy Supabase Edge Functions and set secrets, including `CALLMEBOT_RECIPIENTS` for multiple WhatsApp recipients.
- Deploy Cloudflare Worker cron and set secrets.
- Add Cloudflare Pages URL/custom domain to Supabase Auth URL Configuration.
- Create the first `system_admin`, then add remaining staff through Settings.
- Test login for every role and confirm the role-specific landing page.
- Test double-booking prevention by attempting overlapping bookings for the same vehicle.
- Test 360° client history from Clients as an admin/manager.
- Test voucher printing from Bookings.
- Test `/api/staff-users` from Settings in production.
