const ALLOWED_ROLES = new Set(['system_admin','manager','finance_officer','sales_agent','fleet_coordinator','driver']);

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) {
    return json({ error: 'Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.' }, 500, cors);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Missing staff bearer token.' }, 401, cors);

  const caller = await supabaseFetch(env, '/auth/v1/user', { headers: { Authorization: `Bearer ${jwt}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!caller.ok) return json({ error: 'Invalid staff session.' }, 401, cors);
  const callerUser = await caller.json();

  const profileRes = await supabaseFetch(env, `/rest/v1/profiles?id=eq.${callerUser.id}&select=role,is_active`, {
    headers: serviceHeaders(env),
  });
  const [profile] = await profileRes.json();
  if (!profile?.is_active || profile.role !== 'system_admin') {
    return json({ error: 'Only active system administrators can create staff users.' }, 403, cors);
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.full_name || !ALLOWED_ROLES.has(body?.role)) {
    return json({ error: 'full_name, email, password and a valid role are required.' }, 400, cors);
  }

  const createRes = await supabaseFetch(env, '/auth/v1/admin/users', {
    method: 'POST',
    headers: { ...serviceHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, role: body.role },
    }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) return json({ error: created.msg || created.error_description || created.error || 'Supabase user creation failed.' }, createRes.status, cors);

  await supabaseFetch(env, '/rest/v1/profiles', {
    method: 'POST',
    headers: { ...serviceHeaders(env), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: created.id, email: body.email, full_name: body.full_name, role: body.role, phone: body.phone || null, is_active: true }),
  });

  return json({ id: created.id, email: created.email, role: body.role }, 201, cors);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function serviceHeaders(env) {
  return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
}
function supabaseFetch(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}${path}`, init);
}
function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Vary': 'Origin' };
}
