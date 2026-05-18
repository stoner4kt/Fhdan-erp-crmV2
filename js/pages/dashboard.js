import { supabase } from '../supabase-client.js';
import { formatCurrency, formatDateTime, statusBadge, loading } from '../utils.js';

export default async function render(container) {
  loading(container, 'Loading dashboard...');

  const [stats, activeTrips, pendingDeposits] = await Promise.all([
    fetchStats(),
    fetchActiveTrips(),
    fetchPendingDeposits(),
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <p class="page-sub">Dispatcher Cockpit — ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="window._refreshDashboard()">Refresh</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-active">
        <div class="stat-value">${stats.active_trips}</div>
        <div class="stat-label">Active Trips</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.vehicles_available}</div>
        <div class="stat-label">Vehicles Available</div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-value">${stats.vehicles_maintenance}</div>
        <div class="stat-label">In Maintenance</div>
      </div>
      <div class="stat-card stat-pending">
        <div class="stat-value">${stats.pending_deposits}</div>
        <div class="stat-label">Pending Deposits</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.total_bookings_month}</div>
        <div class="stat-label">Bookings This Month</div>
      </div>
      <div class="stat-card stat-revenue">
        <div class="stat-value">${formatCurrency(stats.monthly_revenue)}</div>
        <div class="stat-label">Revenue This Month</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <h3>Active Trips</h3>
          <span class="badge badge-green">${activeTrips.length} Live</span>
        </div>
        <div class="table-wrap">
          ${activeTrips.length === 0 ? '<div class="empty-state"><p>No active trips right now.</p></div>' : `
          <table class="data-table">
            <thead><tr>
              <th>Reference</th><th>Client</th><th>Vehicle</th><th>Pickup</th><th>Dropoff</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${activeTrips.map(b => `<tr>
                <td class="mono">${b.booking_reference}</td>
                <td>${b.clients?.full_name || '—'}</td>
                <td>${b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : '—'}</td>
                <td>${formatDateTime(b.pickup_datetime)}</td>
                <td>${formatDateTime(b.dropoff_datetime)}</td>
                <td>${statusBadge(b.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Pending Deposits</h3>
          <span class="badge badge-amber">${pendingDeposits.length}</span>
        </div>
        <div class="table-wrap">
          ${pendingDeposits.length === 0 ? '<div class="empty-state"><p>No pending deposits.</p></div>' : `
          <table class="data-table">
            <thead><tr>
              <th>Reference</th><th>Client</th><th>Deposit</th><th>Pickup</th>
            </tr></thead>
            <tbody>
              ${pendingDeposits.map(b => `<tr>
                <td class="mono">${b.booking_reference}</td>
                <td>${b.clients?.full_name || '—'}</td>
                <td class="amount">${formatCurrency(b.deposit_amount)}</td>
                <td>${formatDateTime(b.pickup_datetime)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>
    </div>`;

  window._refreshDashboard = () => render(container);
}

async function fetchStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: vehicles }, { data: bookings }, { data: completed }] = await Promise.all([
    supabase.from('vehicles').select('status'),
    supabase.from('bookings').select('status, created_at'),
    supabase.from('bookings').select('total_zar').eq('status', 'completed').gte('created_at', startOfMonth),
  ]);

  const vs = vehicles || [];
  const bs = bookings || [];
  const monthBookings = bs.filter(b => b.created_at >= startOfMonth);
  const revenue = (completed || []).reduce((s, b) => s + parseFloat(b.total_zar || 0), 0);

  return {
    active_trips: bs.filter(b => b.status === 'active').length,
    vehicles_available: vs.filter(v => v.status === 'available').length,
    vehicles_booked: vs.filter(v => v.status === 'booked').length,
    vehicles_maintenance: vs.filter(v => v.status === 'maintenance').length,
    pending_deposits: bs.filter(b => b.status === 'pending_deposit').length,
    total_bookings_month: monthBookings.length,
    monthly_revenue: revenue,
  };
}

async function fetchActiveTrips() {
  const { data } = await supabase
    .from('bookings')
    .select('*, clients(full_name, phone), vehicles(make, model, registration), drivers(full_name)')
    .eq('status', 'active')
    .order('pickup_datetime', { ascending: true })
    .limit(20);
  return data || [];
}

async function fetchPendingDeposits() {
  const { data } = await supabase
    .from('bookings')
    .select('*, clients(full_name, phone), vehicles(make, model)')
    .eq('status', 'pending_deposit')
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}
