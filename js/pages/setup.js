export default async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Setup Guide</h2><p class="page-sub">Step-by-step deployment and configuration instructions</p></div>
    </div>
    <div class="setup-doc">

      <div class="setup-section">
        <h3>Overview</h3>
        <p>Fhdan Fleet Hub is a self-hosted fleet management system built with vanilla HTML/CSS/JS using Supabase, Cloudflare Pages, Supabase Edge Functions, and an optional Cloudflare Worker cron. See <code>PRODUCTION_SETUP.md</code> in the source handover for the complete credential-by-credential production guide.</p>
        <div class="setup-tech">
          <span class="tech-badge">HTML / CSS / JS</span>
          <span class="tech-badge">Supabase</span>
          <span class="tech-badge">Cloudflare Pages</span>
          <span class="tech-badge">Cloudflare Workers</span>
          <span class="tech-badge">Supabase Edge Functions</span>
          <span class="tech-badge">PostgreSQL (via Supabase)</span>
        </div>
      </div>

      <div class="setup-section">
        <h3>Step 1 — Create a Supabase Project</h3>
        <ol>
          <li>Go to <a href="https://supabase.com" target="_blank">supabase.com</a> and sign in or create a free account.</li>
          <li>Click <strong>New Project</strong>, choose your organisation, set a project name (e.g. <code>fhdan-fleet-hub</code>), and set a strong database password.</li>
          <li>Select the region closest to South Africa — <strong>AWS af-south-1 (Cape Town)</strong> is recommended.</li>
          <li>Wait for the project to provision (about 1 minute).</li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 2 — Run the Database Schema</h3>
        <ol>
          <li>In your Supabase project, go to <strong>SQL Editor</strong> → <strong>New Query</strong>.</li>
          <li>Open the file <code>supabase/schema.sql</code> from the downloaded ZIP.</li>
          <li>Paste the entire contents and click <strong>Run</strong>. You should see "Success. No rows returned."</li>
          <li>This creates all tables, enums, RLS policies, indexes, double-booking prevention triggers, maintenance windows, notifications, 360° history RPC, and immutable audit logging.</li>
        </ol>
        <div class="callout callout-warning">
          <strong>Important:</strong> Run the schema BEFORE creating any auth users, otherwise the trigger that auto-creates profile records will not fire for users created before the schema exists.
        </div>
      </div>

      <div class="setup-section">
        <h3>Step 3 — Create Demo Auth Users</h3>
        <ol>
          <li>In Supabase, go to <strong>Authentication</strong> → <strong>Users</strong>.</li>
          <li>Click <strong>Add User</strong> → <strong>Create new user</strong> for each demo account:
            <div class="cred-table">
              <table><thead><tr><th>Email</th><th>Password</th><th>Role</th></tr></thead><tbody>
                <tr><td>admin@fhdan.co.za</td><td>Admin2026!</td><td>system_admin</td></tr>
                <tr><td>manager@fhdan.co.za</td><td>Manager2026!</td><td>manager</td></tr>
                <tr><td>finance@fhdan.co.za</td><td>Finance2026!</td><td>finance_officer</td></tr>
                <tr><td>sales@fhdan.co.za</td><td>Sales2026!</td><td>sales_agent</td></tr>
                <tr><td>fleet@fhdan.co.za</td><td>Fleet2026!</td><td>fleet_coordinator</td></tr>
                <tr><td>driver@fhdan.co.za</td><td>Driver2026!</td><td>driver</td></tr>
              </tbody></table>
            </div>
          </li>
          <li>After creating users, run these SQL statements in the SQL Editor to assign roles:
            <div class="code-block">
              UPDATE public.profiles SET role = 'system_admin', full_name = 'System Administrator' WHERE email = 'admin@fhdan.co.za';
              UPDATE public.profiles SET role = 'manager', full_name = 'Sipho Nkosi' WHERE email = 'manager@fhdan.co.za';
              UPDATE public.profiles SET role = 'finance_officer', full_name = 'Lerato Dlamini' WHERE email = 'finance@fhdan.co.za';
              UPDATE public.profiles SET role = 'sales_agent', full_name = 'Thabo Molefe' WHERE email = 'sales@fhdan.co.za';
              UPDATE public.profiles SET role = 'fleet_coordinator', full_name = 'Priya Govender' WHERE email = 'fleet@fhdan.co.za';
              UPDATE public.profiles SET role = 'driver', full_name = 'Ahmed Hassan' WHERE email = 'driver@fhdan.co.za';
            </div>
          </li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 4 — Load Demo Data (Optional)</h3>
        <ol>
          <li>Open <code>supabase/seed.sql</code> from the ZIP.</li>
          <li>Paste the contents into the SQL Editor and click <strong>Run</strong>.</li>
          <li>This inserts 5 clients, 6 vehicles, 4 drivers, 6 bookings, 4 invoices, and 3 payments.</li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 5 — Get Your Supabase Credentials</h3>
        <ol>
          <li>Go to <strong>Project Settings</strong> → <strong>API</strong>.</li>
          <li>Copy two values:
            <ul>
              <li><strong>Project URL</strong> — looks like <code>https://abcdefghij.supabase.co</code></li>
              <li><strong>anon / public key</strong> — a long JWT string starting with <code>eyJ...</code></li>
            </ul>
          </li>
          <li>Open <code>js/config.js</code> in the ZIP and replace the placeholder values:
            <div class="code-block">
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';  // ← Replace this
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';  // ← Replace this
            </div>
          </li>
        </ol>
        <div class="callout callout-info">
          The <strong>anon key</strong> is safe to expose in the browser — Supabase Row Level Security policies control what each authenticated user can access. Never use your <strong>service role key</strong> in the frontend.
        </div>
      </div>

      <div class="setup-section">
        <h3>Step 6 — Deploy to Cloudflare Pages</h3>
        <ol>
          <li>Go to <a href="https://pages.cloudflare.com" target="_blank">pages.cloudflare.com</a> and sign in (free account works).</li>
          <li>Click <strong>Create a project</strong> → <strong>Direct Upload</strong> (no Git required).</li>
          <li>Name your project (e.g. <code>fhdan-fleet-hub</code>) and click <strong>Create project</strong>.</li>
          <li>Drag and drop the entire contents of the ZIP folder (not the folder itself — the files inside it) into the upload area.</li>
          <li>Click <strong>Deploy site</strong>. Your site will be live at <code>fhdan-fleet-hub.pages.dev</code> in about 30 seconds.</li>
        </ol>

        <h4>Alternatively — Deploy via Git</h4>
        <ol>
          <li>Push the ZIP contents to a GitHub repository.</li>
          <li>In Cloudflare Pages, click <strong>Connect to Git</strong>.</li>
          <li>Select your repository. Set build command to blank and output directory to <code>/</code>.</li>
          <li>Click <strong>Save and Deploy</strong>.</li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 7 — Configure Supabase Auth Redirect URLs</h3>
        <ol>
          <li>In Supabase, go to <strong>Authentication</strong> → <strong>URL Configuration</strong>.</li>
          <li>Set <strong>Site URL</strong> to your Cloudflare Pages URL, e.g. <code>https://fhdan-fleet-hub.pages.dev</code>.</li>
          <li>Add the same URL to <strong>Redirect URLs</strong>.</li>
          <li>If using a custom domain, add that too.</li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 8 — Custom Domain (Optional)</h3>
        <ol>
          <li>In Cloudflare Pages, go to your project → <strong>Custom domains</strong>.</li>
          <li>Add your domain (e.g. <code>fleet.fhdan.co.za</code>). If your domain uses Cloudflare DNS, it configures automatically.</li>
          <li>Update the Supabase Site URL and Redirect URLs with your new domain.</li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 9 — Supabase Storage for Document Vault</h3>
        <p>To enable actual file uploads in the Document Vault:</p>
        <ol>
          <li>In Supabase, go to <strong>Storage</strong> → <strong>New bucket</strong>.</li>
          <li>Create private buckets named <code>document-vault</code> and <code>generated-documents</code>.</li>
          <li>In <code>js/pages/vault.js</code>, uncomment and implement the storage upload code using <code>supabase.storage.from('document-vault').upload(...)</code>.</li>
        </ol>
      </div>

      <div class="setup-section">
        <h3>Step 10 — Edge Functions, Worker Cron & Notifications</h3>
        <p>Deploy <code>supabase/functions/notification-dispatcher</code> and <code>supabase/functions/generate-booking-documents</code>, then deploy the Cloudflare Worker in <code>workers/notification-cron.js</code>. Configure Telegram, CallMeBot, and Resend secrets as described in <code>PRODUCTION_SETUP.md</code>.</p><p>Configure outbound email for booking confirmations and payment receipts using one of:</p>
        <ul>
          <li><strong>Supabase Edge Functions</strong> — Write a serverless function that triggers on booking status changes and sends email via <a href="https://resend.com" target="_blank">Resend</a> or SendGrid. Recommended for South African businesses.</li>
          <li><strong>Postmark</strong> — Excellent deliverability for transactional emails.</li>
          <li><strong>WhatsApp via Twilio</strong> — Send booking confirmations via WhatsApp Business API.</li>
        </ul>
        <p>Get your Resend API key from <a href="https://resend.com" target="_blank">resend.com</a> (free tier: 100 emails/day).</p>
      </div>

      <div class="setup-section">
        <h3>Credentials Summary</h3>
        <p>Here is a list of all credentials you need to collect:</p>
        <div class="cred-table">
          <table><thead><tr><th>Credential</th><th>Where to find it</th><th>Used in</th></tr></thead><tbody>
            <tr><td>Supabase Project URL</td><td>Project Settings → API</td><td>js/config.js</td></tr>
            <tr><td>Supabase Anon Key</td><td>Project Settings → API → anon/public</td><td>js/config.js</td></tr>
            <tr><td>Supabase Service Role Key</td><td>Project Settings → API → service_role</td><td>Edge Functions only (never in browser)</td></tr>
            <tr><td>Database Password</td><td>Set during project creation</td><td>Direct DB connections only</td></tr>
            <tr><td>Cloudflare Account ID</td><td>Cloudflare Dashboard → right sidebar</td><td>Cloudflare Pages deployment</td></tr>
            <tr><td>Resend API Key (optional)</td><td>resend.com → API Keys</td><td>Email notifications (Edge Functions)</td></tr>
          </tbody></table>
        </div>
      </div>

      <div class="setup-section">
        <h3>Troubleshooting</h3>
        <dl class="faq">
          <dt>Login fails with "Invalid credentials"</dt>
          <dd>Ensure the user was created in Supabase Authentication AND their profile was created (check the profiles table in the Table Editor).</dd>
          <dt>Data loads but shows empty tables</dt>
          <dd>Check that RLS policies are active and that you have run the schema.sql. Verify in Table Editor that data exists.</dd>
          <dt>CORS errors in the browser console</dt>
          <dd>Add your Cloudflare Pages URL to Supabase → Authentication → URL Configuration → Redirect URLs.</dd>
          <dt>Site shows 404 after refresh on deep routes</dt>
          <dd>Make sure the _redirects file is in the root of your deployed site. It contains the rule that redirects all routes to index.html.</dd>
          <dt>Changes to js/config.js don't apply after redeployment</dt>
          <dd>Cloudflare Pages caches aggressively. Do a hard refresh (Ctrl+Shift+R) or purge the cache in Cloudflare → Caching → Purge Cache.</dd>
        </dl>
      </div>

    </div>`;
}
