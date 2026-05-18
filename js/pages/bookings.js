import { supabase } from '../supabase-client.js';
import { statusBadge, showToast, showModal, closeModal, formatCurrency, formatDateTime, loading, debounce, escapeHtml, confirmDialog } from '../utils.js';
import { can } from '../rbac.js';
import { getRole } from '../auth.js';
import { navigate } from '../router.js';

const STATUSES = ['all','quote','pending_deposit','confirmed','active','completed','cancelled','no_show'];
let _filter = { status: 'all', q: '' };
let _page = 1;
const PER_PAGE = 25;

export default async function render(container) {
  const role = getRole();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Bookings</h2><p class="page-sub">All bookings and trip management</p></div>
      ${can(role, 'create_booking') ? `<button class="btn btn-primary" id="new-booking-btn">+ New Booking</button>` : ''}
    </div>
    <div class="filter-bar">
      <div class="filter-chips" id="booking-status-filter">
        ${STATUSES.map(s => `<button class="chip ${s==='all'?'active':''}" data-status="${s}">${s==='all'?'All':s.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}</button>`).join('')}
      </div>
      <input type="search" class="search-input" id="booking-search" placeholder="Search reference, client...">
    </div>
    <div class="card"><div id="bookings-table"></div></div>`;

  document.getElementById('booking-status-filter').addEventListener('click', e => {
    if (!e.target.closest('.chip')) return;
    document.querySelectorAll('#booking-status-filter .chip').forEach(c => c.classList.remove('active'));
    e.target.closest('.chip').classList.add('active');
    _filter.status = e.target.closest('.chip').dataset.status;
    _page = 1; loadBookings();
  });

  document.getElementById('booking-search').addEventListener('input', debounce(e => {
    _filter.q = e.target.value.trim(); _page = 1; loadBookings();
  }));

  if (can(role, 'create_booking')) {
    document.getElementById('new-booking-btn').addEventListener('click', () => navigate('/bookings/new'));
  }

  await loadBookings();
}

async function loadBookings() {
  const tableDiv = document.getElementById('bookings-table');
  loading(tableDiv);

  let q = supabase.from('bookings')
    .select('*, clients(full_name), vehicles(registration, make, model), drivers(full_name)', { count: 'exact' });

  if (_filter.status !== 'all') q = q.eq('status', _filter.status);
  if (_filter.q) q = q.or(`booking_reference.ilike.%${_filter.q}%`);
  q = q.order('created_at', { ascending: false }).range((_page - 1) * PER_PAGE, _page * PER_PAGE - 1);

  const { data, count, error } = await q;
  if (error) { tableDiv.innerHTML = '<div class="error-state">Failed to load bookings.</div>'; return; }

  const bookings = data || [];
  const role = getRole();
  const totalPages = Math.ceil((count || 0) / PER_PAGE);

  if (bookings.length === 0) {
    tableDiv.innerHTML = '<div class="empty-state"><p>No bookings found.</p></div>';
    return;
  }

  tableDiv.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Reference</th><th>Client</th><th>Vehicle</th><th>Pickup</th><th>Type</th><th>Total</th><th>Status</th>
          ${can(role, 'edit_booking') ? '<th>Actions</th>' : ''}
        </tr></thead>
        <tbody>
          ${bookings.map(b => `<tr>
            <td class="mono">${b.booking_reference}</td>
            <td>${b.clients?.full_name || '—'}</td>
            <td>${b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : '—'}<br><span class="text-muted text-sm">${b.vehicles?.registration||''}</span></td>
            <td>${formatDateTime(b.pickup_datetime)}</td>
            <td><span class="badge badge-gray">${b.booking_type}</span></td>
            <td class="amount">${formatCurrency(b.total_zar)}</td>
            <td>${statusBadge(b.status)}</td>
            ${can(role, 'edit_booking') ? `<td class="actions">
              <button class="btn btn-sm btn-secondary edit-booking" data-id="${b.id}">Edit Status</button>
              ${can(role, 'delete_booking') ? `<button class="btn btn-sm btn-danger del-booking" data-id="${b.id}">Delete</button>` : ''}
            </td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${totalPages > 1 ? `<div class="pagination">
      <button class="btn btn-sm btn-secondary" ${_page===1?'disabled':''} onclick="window._bPage(${_page-1})">Previous</button>
      <span class="page-info">Page ${_page} of ${totalPages}</span>
      <button class="btn btn-sm btn-secondary" ${_page>=totalPages?'disabled':''} onclick="window._bPage(${_page+1})">Next</button>
    </div>` : ''}`;

  window._bPage = p => { _page = p; loadBookings(); };

  document.querySelectorAll('.edit-booking').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: b } = await supabase.from('bookings').select('id, booking_reference, status').eq('id', btn.dataset.id).single();
      editStatusModal(b);
    });
  });

  document.querySelectorAll('.del-booking').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete this booking? This cannot be undone.');
      if (!ok) return;
      const { error } = await supabase.from('bookings').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Failed to delete.', 'error'); return; }
      showToast('Booking deleted.'); loadBookings();
    });
  });
}

function editStatusModal(booking) {
  const STATUSES_OPT = ['quote','pending_deposit','confirmed','active','completed','cancelled','no_show'];
  showModal(`Update Booking ${booking.booking_reference}`, `
    <div class="form-group">
      <label>Status</label>
      <select id="new-status">
        ${STATUSES_OPT.map(s => `<option value="${s}" ${s===booking.status?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Internal Notes</label>
      <textarea id="booking-notes" rows="3" placeholder="Optional note..."></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="update-booking-btn">Update Status</button>`
  );

  document.getElementById('update-booking-btn').addEventListener('click', async () => {
    const status = document.getElementById('new-status').value;
    const notes = document.getElementById('booking-notes').value;
    const btn = document.getElementById('update-booking-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    const updates = { status };
    if (notes) updates.internal_notes = notes;
    const { error } = await supabase.from('bookings').update(updates).eq('id', booking.id);
    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Update Status'; return; }
    showToast('Booking updated.'); closeModal(); loadBookings();
  });
}
