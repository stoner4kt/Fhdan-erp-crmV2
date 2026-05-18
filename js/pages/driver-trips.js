import { supabase } from '../supabase-client.js';
import { getProfile } from '../auth.js';
import { formatCurrency, formatDateTime, statusBadge, loading, escapeHtml } from '../utils.js';

export default async function render(container) {
  loading(container, 'Loading assigned trips...');
  const profile = getProfile();

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, full_name, phone, email, status')
    .eq('email', profile?.email || '')
    .maybeSingle();

  if (!driver) {
    container.innerHTML = `
      <div class="page-header"><div><h2>My Trips</h2><p class="page-sub">Driver trip portal</p></div></div>
      <div class="card"><div class="empty-state"><p>Your staff login is not linked to a driver profile yet. Ask an administrator to create a driver record with email <strong>${escapeHtml(profile?.email || '')}</strong>.</p></div></div>`;
    return;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .select('*, clients(full_name, phone), vehicles(registration, make, model, color)')
    .eq('driver_id', driver.id)
    .in('status', ['confirmed','active'])
    .gte('dropoff_datetime', now)
    .order('pickup_datetime', { ascending: true });

  if (error) {
    container.innerHTML = '<div class="error-state">Failed to load trips.</div>';
    return;
  }

  const trips = data || [];
  container.innerHTML = `
    <div class="page-header">
      <div><h2>My Trips</h2><p class="page-sub">Upcoming chauffeur assignments for ${escapeHtml(driver.full_name)}</p></div>
      <span>${statusBadge(driver.status)}</span>
    </div>
    <div class="card">
      <div class="card-header"><h3>Upcoming Trips</h3><span class="badge badge-blue">${trips.length}</span></div>
      ${trips.length === 0 ? '<div class="empty-state"><p>No upcoming assigned trips.</p></div>' : `
      <div class="trip-list">
        ${trips.map(t => `
          <article class="trip-card">
            <div class="trip-main">
              <div><span class="mono">${escapeHtml(t.booking_reference)}</span><h3>${escapeHtml(t.clients?.full_name || 'Client')}</h3></div>
              ${statusBadge(t.status)}
            </div>
            <div class="detail-grid">
              <div><span>Pickup</span><strong>${formatDateTime(t.pickup_datetime)}</strong><p>${escapeHtml(t.pickup_location)}</p></div>
              <div><span>Dropoff</span><strong>${formatDateTime(t.dropoff_datetime)}</strong><p>${escapeHtml(t.dropoff_location)}</p></div>
              <div><span>Vehicle</span><strong>${escapeHtml(t.vehicles ? `${t.vehicles.registration} — ${t.vehicles.make} ${t.vehicles.model}` : '—')}</strong><p>${escapeHtml(t.vehicles?.color || '')}</p></div>
              <div><span>Client contact</span><strong>${escapeHtml(t.clients?.phone || '—')}</strong><p>Total ${formatCurrency(t.total_zar)}</p></div>
            </div>
            ${t.special_requirements ? `<div class="alert-info"><strong>Special requirements:</strong> ${escapeHtml(t.special_requirements)}</div>` : ''}
          </article>`).join('')}
      </div>`}
    </div>`;
}
