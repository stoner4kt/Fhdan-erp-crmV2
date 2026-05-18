export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dispatch(env));
  },
  async fetch(_request, env) {
    return dispatch(env);
  },
};

async function dispatch(env) {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/notification-dispatcher`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'cloudflare-worker-cron' }),
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
