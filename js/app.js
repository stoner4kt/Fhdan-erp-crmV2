import { initAuth, isAuthenticated } from './auth.js';
import { register, dispatch } from './router.js';
import { renderSidebar } from './sidebar.js';
import loginPage from './pages/login.js';
import dashboardPage from './pages/dashboard.js';
import fleetPage from './pages/fleet.js';
import bookingsPage from './pages/bookings.js';
import bookingsNewPage from './pages/bookings-new.js';
import clientsPage from './pages/clients.js';
import financePage from './pages/finance.js';
import vaultPage from './pages/vault.js';
import driversPage from './pages/drivers.js';
import driverTripsPage from './pages/driver-trips.js';
import settingsPage from './pages/settings.js';
import setupPage from './pages/setup.js';

// Register routes
register('/login', loginPage);
register('/dashboard', dashboardPage);
register('/fleet', fleetPage);
register('/bookings', bookingsPage);
register('/bookings/new', bookingsNewPage);
register('/clients', clientsPage);
register('/finance', financePage);
register('/vault', vaultPage);
register('/drivers', driversPage);
register('/driver-trips', driverTripsPage);
register('/settings', settingsPage);
register('/setup', setupPage);
register('*', (container) => {
  container.innerHTML = '<div class="not-found"><h2>404 — Page Not Found</h2><a href="/dashboard" onclick="event.preventDefault(); window._navigate(\'/dashboard\')">Go to Dashboard</a></div>';
});

async function bootstrap() {
  try {
    await initAuth();
    updateShell();
    dispatch(location.pathname);
  } catch (err) {
    console.error('Application bootstrap failed:', err);
    showStartupError(err);
  }
}

function updateShell() {
  const authenticated = isAuthenticated();
  const shell = document.getElementById('shell');
  const loginContainer = document.getElementById('login-container');

  if (shell) shell.style.display = authenticated ? 'flex' : 'none';
  if (loginContainer) loginContainer.style.display = authenticated ? 'none' : 'flex';
  if (authenticated) renderSidebar();
}

function showStartupError(err) {
  const loginContainer = document.getElementById('login-container');
  const shell = document.getElementById('shell');
  if (shell) shell.style.display = 'none';
  if (!loginContainer) return;

  const message = err?.message || 'Unknown startup error';
  loginContainer.style.display = 'flex';
  loginContainer.innerHTML = `
    <div class="startup-error-card" role="alert">
      <div class="login-logo-icon">FH</div>
      <h1>Fhdan Fleet Hub could not start</h1>
      <p>The app loaded, but its JavaScript startup failed before the login screen could be rendered.</p>
      <pre>${escapeHtml(message)}</pre>
      <button class="btn btn-primary" type="button" onclick="location.reload()">Reload</button>
    </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

bootstrap();
