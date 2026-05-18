import { supabase } from './supabase-client.js';

let _profile = null;
let _session = null;

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  _session = session;
  if (session) {
    await loadProfile(session.user.id);
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    _session = session;
    if (session) {
      await loadProfile(session.user.id);
    } else {
      _profile = null;
    }
  });
  return { session, profile: _profile };
}

async function loadProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  _profile = data;
  return data;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _session = data.session;
  await loadProfile(data.user.id);
  if (!_profile || _profile.is_active === false) {
    await supabase.auth.signOut();
    _profile = null;
    _session = null;
    throw new Error('This account is inactive or has no staff profile. Contact a system administrator.');
  }
  return { session: data.session, profile: _profile };
}

export async function logout() {
  await supabase.auth.signOut();
  _profile = null;
  _session = null;
}

export function getProfile() { return _profile; }
export function getSession() { return _session; }
export function isAuthenticated() { return !!_session; }
export function getRole() { return _profile?.role || null; }
