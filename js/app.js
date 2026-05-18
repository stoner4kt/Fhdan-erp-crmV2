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
  const { session } = await initAuth();

  // Show/hide shell based on auth state
  function updateShell() {
    const authenticated = isAuthenticated();
    document.getElementById('shell').style.display = authenticated ? 'flex' : 'none';
    document.getElementById('login-container').style.display = authenticated ? 'none' : 'flex';
    if (authenticated) renderSidebar();
  }

  updateShell();
  dispatch(location.pathname);
}

bootstrap();
