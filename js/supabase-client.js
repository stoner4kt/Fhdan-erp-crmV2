import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const { createClient } = supabaseJs;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
