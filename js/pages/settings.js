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
  showModal('Invite New User', `
    <div class="alert-info">
      <strong>How to invite users:</strong>
      <p>Use the Supabase Dashboard to create auth users:</p>
      <ol>
        <li>Go to Authentication → Users → Add User</li>
        <li>Enter their email and a temporary password</li>
        <li>After creation, set their role here in Settings</li>
      </ol>
      <p>Or use Supabase's invite API to send email invitations.</p>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  );
}
