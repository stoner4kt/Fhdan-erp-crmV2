import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabaseLibrary = window.supabaseJs || window.supabase;

if (!supabaseLibrary?.createClient) {
  throw new Error('Supabase client library did not load. Check the CDN script, CSP headers, and network access.');
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL or anon key is missing from js/config.js.');
}

export const supabase = supabaseLibrary.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
