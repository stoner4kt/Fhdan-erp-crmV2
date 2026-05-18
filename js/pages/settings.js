import { supabase } from '../supabase-client.js';
import { formatDate, statusBadge, showToast, showModal, closeModal, loading, escapeHtml } from '../utils.js';
import { getRole } from '../auth.js';
import { can } from '../rbac.js';

const ROLES = ['system_admin','manager','finance_officer','sales_agent','fleet_coordinator','driver'];
const ROLE_LABELS = {
  system_admin: 'System Admin', manager: 'Manager',
  finance_officer: 'Finance Officer', sales_agent: 'Sales Agent',
  fleet_coordinator: 'Fleet Coordinator', driver: 'Driver',
};

export default async function render(container) {
  const role = getRole();
  if (!can(role, 'manage_users')) {
    container.innerHTML = '<div class="access-denied"><h2>Access Denied</h2><p>Only system administrators can access settings.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div><h2>Settings</h2><p class="page-sub">User management and system configuration</p></div>
      <button class="btn btn-primary" id="invite-user-btn">+ Invite User</button>
    </div>
    <div class="card">
      <div class="card-header"><h3>User Management</h3></div>
      <div id="users-table"></div>
    </div>`;

  document.getElementById('invite-user-btn').addEventListener('click', () => inviteUserModal());
  await loadUsers();
}

async function loadUsers() {
  const tableDiv = document.getElementById('users-table');
  loading(tableDiv);

  const { data, error } = await supabase.from('profiles').select('*').order('created_at');
  if (error) { tableDiv.innerHTML = '<div class="error-state">Failed to load users.</div>'; return; }
  const users = data || [];

  tableDiv.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td>
              <div class="user-row">
                <div class="user-avatar-sm">${(u.full_name||'U')[0].toUpperCase()}</div>
                <strong>${escapeHtml(u.full_name)}</strong>
              </div>
            </td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge badge-blue">${ROLE_LABELS[u.role]||u.role}</span></td>
            <td>${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
            <td>${formatDate(u.created_at)}</td>
            <td class="actions">
              <button class="btn btn-sm btn-secondary edit-user" data-id="${u.id}" data-name="${escapeHtml(u.full_name)}" data-role="${u.role}" data-active="${u.is_active}">Edit</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', () => editUserModal(btn.dataset.id, btn.dataset.name, btn.dataset.role, btn.dataset.active === 'true'));
  });
}

function editUserModal(id, name, role, isActive) {
  showModal(`Edit User — ${name}`, `
    <div class="form-grid">
      <div class="form-group form-full"><label>Role</label>
        <select id="edit-user-role">
          ${ROLES.map(r => `<option value="${r}" ${r===role?'selected':''}>${ROLE_LABELS[r]}</option>`).join('')}
        </select></div>
      <div class="form-group form-full">
        <label class="checkbox-label">
          <input type="checkbox" id="edit-user-active" ${isActive?'checked':''}> Account Active
        </label>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-user-btn">Save Changes</button>`
  );

  document.getElementById('save-user-btn').addEventListener('click', async () => {
    const newRole = document.getElementById('edit-user-role').value;
    const active = document.getElementById('edit-user-active').checked;
    const btn = document.getElementById('save-user-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    const { error } = await supabase.from('profiles').update({ role: newRole, is_active: active }).eq('id', id);
    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Save Changes'; return; }
    showToast('User updated.'); closeModal(); loadUsers();
  });
}

function inviteUserModal() {
  showModal('Invite New Staff User', `
    <form id="invite-user-form" class="form-grid">
      <div class="form-group"><label>Full Name *</label><input name="full_name" required placeholder="e.g. Nomsa Mokoena"></div>
      <div class="form-group"><label>Email *</label><input type="email" name="email" required placeholder="name@fhdan.co.za"></div>
      <div class="form-group"><label>Temporary Password *</label><input type="password" name="password" required minlength="8" placeholder="Minimum 8 characters"></div>
      <div class="form-group"><label>Role *</label><select name="role" required>${ROLES.map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}</select></div>
      <div class="form-group form-full"><label>Phone</label><input name="phone" placeholder="+27..."></div>
      <div class="alert-info form-full"><strong>Secure creation:</strong> this calls the Cloudflare Pages Function at <code>/api/staff-users</code>, which must be configured with <code>SUPABASE_SERVICE_ROLE_KEY</code>. The service-role key never appears in browser code.</div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="create-user-btn">Create User</button>`
  );

  document.getElementById('create-user-btn').addEventListener('click', async () => {
    const form = document.getElementById('invite-user-form');
    if (!form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    const btn = document.getElementById('create-user-btn');
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/staff-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to create user. Check Cloudflare environment variables.');
      showToast('Staff user created.');
      closeModal();
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Create User';
    }
  });
}
