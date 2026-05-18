import { supabase } from '../supabase-client.js';
import { statusBadge, showToast, showModal, closeModal, formatDate, loading, escapeHtml, confirmDialog } from '../utils.js';
import { can } from '../rbac.js';
import { getRole } from '../auth.js';

export default async function render(container) {
  const role = getRole();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Drivers</h2><p class="page-sub">Driver roster and status overview</p></div>
      ${can(role, 'create_driver') ? `<button class="btn btn-primary" id="add-driver-btn">+ Add Driver</button>` : ''}
    </div>
    <div id="driver-stats" class="stats-grid stats-grid-4"></div>
    <div class="card">
      <div id="drivers-table"></div>
    </div>`;

  if (can(role, 'create_driver')) {
    document.getElementById('add-driver-btn').addEventListener('click', () => driverForm(null, container));
  }
  await loadDrivers(container);
}

async function loadDrivers(container) {
  const tableDiv = document.getElementById('drivers-table');
  loading(tableDiv);

  const { data, error } = await supabase.from('drivers').select('*').order('full_name');
  if (error) { tableDiv.innerHTML = `<div class="error-state">Failed to load drivers.</div>`; return; }
  const drivers = data || [];

  // Stats
  const counts = { available: 0, on_trip: 0, off_duty: 0, suspended: 0 };
  drivers.forEach(d => { if (counts[d.status] !== undefined) counts[d.status]++; });
  document.getElementById('driver-stats').innerHTML = [
    ['Available', counts.available, 'stat-active'],
    ['On Trip', counts.on_trip, 'stat-blue'],
    ['Off Duty', counts.off_duty, ''],
    ['Suspended', counts.suspended, 'stat-danger'],
  ].map(([label, val, cls]) => `<div class="stat-card ${cls}"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`).join('');

  const role = getRole();
  if (drivers.length === 0) { tableDiv.innerHTML = '<div class="empty-state"><p>No drivers found.</p></div>'; return; }

  tableDiv.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Name</th><th>Phone</th><th>Email</th><th>License</th><th>PDP Expiry</th><th>Total Trips</th><th>Status</th>
          ${can(role, 'edit_driver') ? '<th>Actions</th>' : ''}
        </tr></thead>
        <tbody>
          ${drivers.map(d => `<tr>
            <td><strong>${escapeHtml(d.full_name)}</strong></td>
            <td>${escapeHtml(d.phone)}</td>
            <td>${d.email ? escapeHtml(d.email) : '—'}</td>
            <td><span class="badge badge-blue">${d.license_code}</span></td>
            <td>${formatDate(d.pdp_expiry)}</td>
            <td>${d.total_trips}</td>
            <td>${statusBadge(d.status)}</td>
            ${can(role, 'edit_driver') ? `<td class="actions">
              <button class="btn btn-sm btn-secondary edit-driver" data-id="${d.id}">Edit</button>
              ${can(role, 'delete_driver') ? `<button class="btn btn-sm btn-danger del-driver" data-id="${d.id}">Delete</button>` : ''}
            </td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.querySelectorAll('.edit-driver').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: d } = await supabase.from('drivers').select('*').eq('id', btn.dataset.id).single();
      driverForm(d, container);
    });
  });
  document.querySelectorAll('.del-driver').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete this driver?');
      if (!ok) return;
      const { error } = await supabase.from('drivers').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Failed to delete.', 'error'); return; }
      showToast('Driver deleted.'); loadDrivers(container);
    });
  });
}

function driverForm(driver, container) {
  const isEdit = !!driver;
  showModal(isEdit ? 'Edit Driver' : 'Add Driver', `
    <form id="driver-form" class="form-grid">
      <div class="form-group"><label>Full Name *</label><input name="full_name" value="${driver?.full_name||''}" required></div>
      <div class="form-group"><label>Phone *</label><input name="phone" value="${driver?.phone||''}" required></div>
      <div class="form-group"><label>Email</label><input name="email" type="email" value="${driver?.email||''}"></div>
      <div class="form-group"><label>ID Number</label><input name="id_number" value="${driver?.id_number||''}"></div>
      <div class="form-group"><label>License Code</label>
        <select name="license_code">${['B','C','C1','EB','PDP'].map(l=>`<option value="${l}" ${driver?.license_code===l?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="form-group"><label>PDP Expiry</label><input name="pdp_expiry" type="date" value="${driver?.pdp_expiry||''}"></div>
      <div class="form-group"><label>Status</label>
        <select name="status">${['available','on_trip','off_duty','suspended'].map(s=>`<option value="${s}" ${driver?.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-group form-full"><label>Notes</label><textarea name="notes" rows="2">${driver?.notes||''}</textarea></div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-driver-btn">${isEdit?'Update':'Add'} Driver</button>`
  );

  document.getElementById('save-driver-btn').addEventListener('click', async () => {
    const data = Object.fromEntries(new FormData(document.getElementById('driver-form')));
    const btn = document.getElementById('save-driver-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    let error;
    if (isEdit) ({ error } = await supabase.from('drivers').update(data).eq('id', driver.id));
    else ({ error } = await supabase.from('drivers').insert(data));
    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = `${isEdit?'Update':'Add'} Driver`; return; }
    showToast(isEdit ? 'Driver updated.' : 'Driver added.');
    closeModal(); loadDrivers(container);
  });
}
