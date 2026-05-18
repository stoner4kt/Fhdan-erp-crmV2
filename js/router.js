import { isAuthenticated, getRole } from './auth.js';
import { can } from './rbac.js';

const ROLE_HOME = {
  system_admin: '/dashboard',
  manager: '/dashboard',
  finance_officer: '/finance',
  sales_agent: '/bookings',
  fleet_coordinator: '/fleet',
  driver: '/driver-trips',
};

export function homeForRole(role) {
  return ROLE_HOME[role] || '/dashboard';
}

const routes = {};
let currentPath = null;

export function register(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  history.pushState({}, '', path);
  dispatch(path);
}

export async function dispatch(path) {
  if (!isAuthenticated() && path !== '/login') {
    history.replaceState({}, '', '/login');
    path = '/login';
  }
  if (isAuthenticated() && (path === '/login' || path === '/')) {
    path = homeForRole(getRole());
    history.replaceState({}, '', path);
  }

  // Strip trailing slash (except root)
  const clean = path.length > 1 ? path.replace(/\/$/, '') : path;
  const handler = routes[clean] || routes['*'];
  if (!handler) return;

  // Permission check
  const role = getRole();
  const permKey = clean.replace('/', '').replace('-', '_') || 'dashboard';
  if (isAuthenticated() && clean !== '/login' && !can(role, permKey === '' ? 'dashboard' : permKey)) {
    const fallback = homeForRole(role);
    if (clean !== fallback && routes[fallback]) {
      history.replaceState({}, '', fallback);
      return dispatch(fallback);
    }
    const content = document.getElementById('content');
    if (content) content.innerHTML = '<div class="access-denied"><h2>Access Denied</h2><p>You do not have permission to view this page.</p></div>';
    return;
  }

  currentPath = clean;
  updateActiveNav(clean);
  const content = document.getElementById('content');
  if (content) await handler(content);
}

export function getCurrentPath() { return currentPath; }

function updateActiveNav(path) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === path);
  });
}

window.addEventListener('popstate', () => dispatch(location.pathname));
