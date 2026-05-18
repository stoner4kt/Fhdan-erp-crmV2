import { supabase } from '../supabase-client.js';
import { formatCurrency, statusBadge, showToast, showModal, closeModal, loading, debounce, escapeHtml, confirmDialog } from '../utils.js';
import { can } from '../rbac.js';
import { getRole } from '../auth.js';

const CATEGORIES = ['all','sedan','suv','luxury','minibus','bus','van','pickup'];
const STATUSES = ['all','available','booked','maintenance','inactive'];

let _filter = { status: 'all', q: '' };

export default async function render(container) {
  const role = getRole();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Fleet</h2><p class="page-sub">Vehicle management and availability</p></div>
      ${can(role, 'create_vehicle') ? `<button class="btn btn-primary" id="add-vehicle-btn">+ Add Vehicle</button>` : ''}
    </div>
    <div class="filter-bar">
      <div class="filter-chips" id="status-filter">
        ${STATUSES.map(s => `<button class="chip ${s === 'all' ? 'active' : ''}" data-status="${s}">${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>`).join('')}
      </div>
      <input type="search" class="search-input" id="fleet-search" placeholder="Search registration, make, model...">
    </div>
    <div id="fleet-grid" class="vehicle-grid"></div>`;

  document.getElementById('status-filter').addEventListener('click', e => {
    if (!e.target.closest('.chip')) return;
    document.querySelectorAll('#status-filter .chip').forEach(c => c.classList.remove('active'));
    e.target.closest('.chip').classList.add('active');
    _filter.status = e.target.closest('.chip').dataset.status;
    loadVehicles(container);
  });

  document.getElementById('fleet-search').addEventListener('input', debounce(e => {
    _filter.q = e.target.value.trim().toLowerCase();
    loadVehicles(container);
  }));

  if (can(role, 'create_vehicle')) {
    document.getElementById('add-vehicle-btn').addEventListener('click', () => vehicleForm(null, container));
  }

  await loadVehicles(container);
}

async function loadVehicles(container) {
  const grid = document.getElementById('fleet-grid');
  loading(grid, 'Loading vehicles...');

  let q = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (_filter.status !== 'all') q = q.eq('status', _filter.status);

  const { data, error } = await q;
  if (error) { grid.innerHTML = `<div class="error-state">Failed to load vehicles.</div>`; return; }

  let vehicles = data || [];
  if (_filter.q) {
    vehicles = vehicles.filter(v =>
      v.registration.toLowerCase().includes(_filter.q) ||
      v.make.toLowerCase().includes(_filter.q) ||
      v.model.toLowerCase().includes(_filter.q)
    );
  }

  const role = getRole();
  if (vehicles.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No vehicles found.</p></div>';
    return;
  }

  grid.innerHTML = vehicles.map(v => `
    <div class="vehicle-card" data-id="${v.id}">
      <div class="vehicle-card-header">
        <div>
          <div class="vehicle-reg">${escapeHtml(v.registration)}</div>
          <div class="vehicle-name">${escapeHtml(v.make)} ${escapeHtml(v.model)} <span class="text-muted">${v.year}</span></div>
        </div>
        ${statusBadge(v.status)}
      </div>
      <div class="vehicle-meta">
        <span class="badge badge-purple">${v.category}</span>
        <span class="text-muted">${v.seating_capacity} seats</span>
        <span class="text-muted">${v.color}</span>
      </div>
      <div class="vehicle-rates">
        <div><span class="rate-label">Daily</span><span class="rate-value">${formatCurrency(v.daily_rate_zar)}</span></div>
        <div><span class="rate-label">Chauffeur</span><span class="rate-value">${formatCurrency(v.chauffeur_rate_zar)}</span></div>
      </div>
      <div class="vehicle-odometer">${(v.odometer_km || 0).toLocaleString()} km</div>
      <div class="card-actions">
        ${can(role, 'edit_vehicle') ? `<button class="btn btn-sm btn-secondary edit-vehicle" data-id="${v.id}">Edit</button>` : ''}
        ${can(role, 'delete_vehicle') ? `<button class="btn btn-sm btn-danger del-vehicle" data-id="${v.id}">Delete</button>` : ''}
      </div>
    </div>`).join('');

  document.querySelectorAll('.edit-vehicle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: v } = await supabase.from('vehicles').select('*').eq('id', btn.dataset.id).single();
      vehicleForm(v, container);
    });
  });

  document.querySelectorAll('.del-vehicle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete this vehicle? This cannot be undone.');
      if (!ok) return;
      const { error } = await supabase.from('vehicles').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Failed to delete vehicle.', 'error'); return; }
      showToast('Vehicle deleted.');
      loadVehicles(container);
    });
  });
}

function vehicleForm(vehicle, container) {
  const isEdit = !!vehicle;
  showModal(isEdit ? 'Edit Vehicle' : 'Add Vehicle', `
    <form id="vehicle-form" class="form-grid">
      <div class="form-group"><label>Registration *</label><input name="registration" value="${vehicle?.registration||''}" required placeholder="CA 123-456"></div>
      <div class="form-group"><label>Make *</label><input name="make" value="${vehicle?.make||''}" required placeholder="Toyota"></div>
      <div class="form-group"><label>Model *</label><input name="model" value="${vehicle?.model||''}" required placeholder="Fortuner"></div>
      <div class="form-group"><label>Year *</label><input name="year" type="number" value="${vehicle?.year||new Date().getFullYear()}" required min="2000" max="2030"></div>
      <div class="form-group"><label>Color *</label><input name="color" value="${vehicle?.color||''}" required></div>
      <div class="form-group"><label>Category *</label>
        <select name="category">
          ${['sedan','suv','luxury','minibus','bus','van','pickup'].map(c => `<option value="${c}" ${vehicle?.category===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Fuel Type</label>
        <select name="fuel_type">
          ${['petrol','diesel','electric','hybrid'].map(f => `<option value="${f}" ${vehicle?.fuel_type===f?'selected':''}>${f}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Seating Capacity</label><input name="seating_capacity" type="number" value="${vehicle?.seating_capacity||4}" min="1" max="60"></div>
      <div class="form-group"><label>Drive Mode</label>
        <select name="drive_modes">
          ${['both','chauffeur','self_drive'].map(d => `<option value="${d}" ${vehicle?.drive_modes===d?'selected':''}>${d}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Status</label>
        <select name="status">
          ${['available','booked','maintenance','inactive'].map(s => `<option value="${s}" ${vehicle?.status===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Daily Rate (ZAR)</label><input name="daily_rate_zar" type="number" step="0.01" value="${vehicle?.daily_rate_zar||0}"></div>
      <div class="form-group"><label>Chauffeur Rate (ZAR)</label><input name="chauffeur_rate_zar" type="number" step="0.01" value="${vehicle?.chauffeur_rate_zar||0}"></div>
      <div class="form-group"><label>Odometer (km)</label><input name="odometer_km" type="number" value="${vehicle?.odometer_km||0}"></div>
      <div class="form-group form-full"><label>Notes</label><textarea name="notes" rows="2">${vehicle?.notes||''}</textarea></div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-vehicle-btn">Save Vehicle</button>`
  );

  document.getElementById('save-vehicle-btn').addEventListener('click', async () => {
    const form = document.getElementById('vehicle-form');
    const data = Object.fromEntries(new FormData(form));
    data.year = parseInt(data.year);
    data.seating_capacity = parseInt(data.seating_capacity);
    data.odometer_km = parseInt(data.odometer_km);
    data.daily_rate_zar = parseFloat(data.daily_rate_zar);
    data.chauffeur_rate_zar = parseFloat(data.chauffeur_rate_zar);

    const btn = document.getElementById('save-vehicle-btn');
    btn.disabled = true; btn.textContent = 'Saving...';

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('vehicles').update(data).eq('id', vehicle.id));
    } else {
      ({ error } = await supabase.from('vehicles').insert(data));
    }

    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Save Vehicle'; return; }
    showToast(isEdit ? 'Vehicle updated.' : 'Vehicle added.');
    closeModal();
    loadVehicles(container);
  });
}
