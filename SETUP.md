# Fhdan Fleet Hub — Setup Guide

> For the complete production Cloudflare Pages, Supabase Edge Functions, Worker cron, notification, credentials, and role-routing guide, see [`PRODUCTION_SETUP.md`](PRODUCTION_SETUP.md).

**Stack:** Vanilla HTML/CSS/JS · Supabase · Cloudflare Pages

---

## Quick Overview

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | HTML + CSS + JavaScript (no build step) |
| Auth     | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL      |
| Hosting  | Cloudflare Pages (free) |
| Domain   | Your own (optional)      |

---

## What you'll need

- A **Supabase account** (free tier is sufficient): https://supabase.com
- A **Cloudflare account** (free tier): https://cloudflare.com
- About **20–30 minutes** for first-time setup

---

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com and sign in or create a free account.
2. Click **New Project**, choose your organisation.
3. Fill in:
   - **Name:** `fhdan-fleet-hub` (or anything you like)
   - **Database Password:** Set a strong password and save it somewhere
   - **Region:** `af-south-1 (Cape Town)` — closest to South Africa
4. Click **Create new project** and wait ~1 minute for provisioning.

---

## Step 2 — Run the Database Schema

1. In your Supabase project, go to the **SQL Editor** (left sidebar).
2. Click **New Query**.
3. Open the file `supabase/schema.sql` from this ZIP.
4. Copy the **entire contents** and paste into the SQL Editor.
5. Click **Run** (or press Ctrl+Enter).
6. You should see: `Success. No rows returned.`

> **Important:** Run the schema BEFORE creating auth users. The schema includes a trigger that auto-creates a profile record when a user signs up. Users created before the schema exists won't have profiles.

---

## Step 3 — Create Demo Auth Users

1. In Supabase, go to **Authentication → Users**.
2. Click **Add User → Create new user** for each of the following:

| Email | Password | Role to assign |
|-------|----------|----------------|
| admin@fhdan.co.za | Admin2026! | system_admin |
| manager@fhdan.co.za | Manager2026! | manager |
| finance@fhdan.co.za | Finance2026! | finance_officer |
| sales@fhdan.co.za | Sales2026! | sales_agent |
| fleet@fhdan.co.za | Fleet2026! | fleet_coordinator |
| driver@fhdan.co.za | Driver2026! | driver |

3. After creating all 6 users, go back to **SQL Editor → New Query** and run:

```sql
UPDATE public.profiles SET role = 'system_admin', full_name = 'System Administrator' WHERE email = 'admin@fhdan.co.za';
UPDATE public.profiles SET role = 'manager', full_name = 'Sipho Nkosi' WHERE email = 'manager@fhdan.co.za';
UPDATE public.profiles SET role = 'finance_officer', full_name = 'Lerato Dlamini' WHERE email = 'finance@fhdan.co.za';
UPDATE public.profiles SET role = 'sales_agent', full_name = 'Thabo Molefe' WHERE email = 'sales@fhdan.co.za';
UPDATE public.profiles SET role = 'fleet_coordinator', full_name = 'Priya Govender' WHERE email = 'fleet@fhdan.co.za';
UPDATE public.profiles SET role = 'driver', full_name = 'Ahmed Hassan' WHERE email = 'driver@fhdan.co.za';
```

---

## Step 4 — Load Demo Data (Optional)

1. Open `supabase/seed.sql` from this ZIP.
2. Paste contents into **SQL Editor → New Query** and click **Run**.
3. This inserts: 5 clients, 6 vehicles, 4 drivers, 6 bookings, 4 invoices, 3 payments.

---

## Step 5 — Get Your Supabase API Credentials

1. In your Supabase project, go to **Project Settings → API**.
2. Copy these two values:

| Value | Where to find it |
|-------|-----------------|
| **Project URL** | Under "Project URL" — looks like `https://abcdefgh.supabase.co` |
| **Anon/Public Key** | Under "Project API keys → anon public" — starts with `eyJ...` |

3. Open `js/config.js` in this ZIP using any text editor (Notepad, VS Code, etc.).
4. Replace the placeholder values:

```javascript
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';  // ← your URL
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';              // ← your key
```

5. Save the file.

> **Security note:** The `anon` key is safe to use in the browser. Supabase Row Level Security (RLS) controls what data each user can access. Never use the `service_role` key in frontend code.

---

## Step 6 — Deploy to Cloudflare Pages

### Option A — Direct Upload (No Git required, recommended for first deploy)

1. Go to https://pages.cloudflare.com and sign in.
2. Click **Create a project → Direct Upload**.
3. Give your project a name (e.g. `fhdan-fleet-hub`).
4. Click **Create project**.
5. **Drag and drop** the contents of this ZIP folder directly into the upload area.
   - Drag the files and folders INSIDE the zip (index.html, css/, js/, etc.) — not the zip itself or the containing folder.
6. Click **Deploy site**.
7. Your site will be live at `https://fhdan-fleet-hub.pages.dev` in ~30 seconds.

### Option B — Deploy via GitHub (for ongoing updates)

1. Create a new GitHub repository and push all files in this ZIP to the root.
2. In Cloudflare Pages → **Create a project → Connect to Git**.
3. Select your repository.
4. Settings:
   - **Build command:** (leave blank)
   - **Build output directory:** `/`
5. Click **Save and Deploy**.

---

## Step 7 — Configure Supabase Auth Redirect URLs

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Cloudflare Pages URL:
   - e.g. `https://fhdan-fleet-hub.pages.dev`
3. Under **Redirect URLs**, add the same URL.
4. Click **Save**.

---

## Step 8 — Add a Custom Domain (Optional)

### Cloudflare Pages custom domain:
1. In Cloudflare Pages → your project → **Custom domains**.
2. Click **Set up a custom domain**.
3. Enter your domain (e.g. `fleet.fhdan.co.za`).
4. If your domain uses Cloudflare DNS, it configures automatically. Otherwise follow the DNS instructions.

### Update Supabase:
1. Go back to **Authentication → URL Configuration**.
2. Update **Site URL** and add your custom domain to **Redirect URLs**.

---

## Step 9 — Set Up Supabase Storage for Document Vault (Optional)

To enable actual file uploads in the Document Vault:

1. In Supabase, go to **Storage → New bucket**.
2. Name it: `document-vault` and create a second private bucket named `generated-documents`
3. Set to **Private**.
4. Add a policy: Allow authenticated users to upload to their own folder.
5. In `js/pages/vault.js`, implement the upload using:
   ```javascript
   const { data, error } = await supabase.storage
     .from('document-vault')
     .upload(`${entityType}/${entityId}/${fileName}`, file);
   ```

---

## Step 10 — Email Notifications (Optional)

For booking confirmations and payment receipts, use Supabase Edge Functions:

**Recommended: Resend (https://resend.com)**
- Free tier: 3,000 emails/month, 100/day
- Simple REST API, great deliverability

**Setup:**
1. Get your Resend API key from https://resend.com/api-keys
2. In Supabase → **Edge Functions**, create a new function triggered by database webhooks on the `bookings` table.
3. Call the Resend API from the Edge Function to send confirmation emails.

---

## Credentials Checklist

| Credential | Where to get it | Where it goes |
|-----------|----------------|---------------|
| Supabase Project URL | Project Settings → API | `js/config.js` |
| Supabase Anon Key | Project Settings → API → anon/public | `js/config.js` |
| Cloudflare Account | Sign up at cloudflare.com | Cloudflare Pages dashboard |
| Custom domain (optional) | Your domain registrar | Cloudflare Pages → Custom domains |
| Resend API Key (optional) | resend.com → API Keys | Supabase Edge Function env vars |

---

## Troubleshooting

**Login fails with "Invalid login credentials"**
→ Ensure the user was created in Supabase Authentication AND their profile was created. Check `profiles` table in Table Editor.

**Page loads but data is empty**
→ Verify RLS policies are enabled and schema.sql ran successfully. Check the Table Editor to confirm data exists.

**"Permission denied" errors in console**
→ Check RLS policies ran correctly. In Supabase → Table Editor, select a table and click the Policies tab.

**404 error when refreshing on any page other than /**
→ Confirm the `_redirects` file is in the root of your deployed Cloudflare Pages project. It must contain exactly: `/* /index.html 200`

**CORS errors**
→ Add your deployed URL to Supabase → Authentication → URL Configuration → Redirect URLs.

**Changes to js/config.js not taking effect after redeploy**
→ Hard refresh with Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac). Or go to Cloudflare → Caching → Purge Everything.

---

## Support

For Supabase issues: https://supabase.com/docs  
For Cloudflare Pages issues: https://developers.cloudflare.com/pages  
For Row Level Security help: https://supabase.com/docs/guides/auth/row-level-security
