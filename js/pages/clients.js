import { supabase } from '../supabase-client.js';
import { statusBadge, showToast, showModal, closeModal, formatDate, loading, debounce, escapeHtml, confirmDialog } from '../utils.js';
import { can } from '../rbac.js';
import { getRole } from '../auth.js';

let _filter = { status: 'all', q: '' };
let _page = 1;
const PER_PAGE = 25;

export default async function render(container) {
  const role = getRole();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Clients</h2><p class="page-sub">Client directory and management</p></div>
      ${can(role, 'create_client') ? `<button class="btn btn-primary" id="add-client-btn">+ Add Client</button>` : ''}
    </div>
    <div class="filter-bar">
      <div class="filter-chips" id="client-status-filter">
        ${['all','active','inactive','blacklisted'].map(s => `<button class="chip ${s==='all'?'active':''}" data-status="${s}">${s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)}</button>`).join('')}
      </div>
      <input type="search" class="search-input" id="client-search" placeholder="Search name, email, company...">
    </div>
    <div class="card">
      <div id="clients-table"></div>
    </div>`;

  document.getElementById('client-status-filter').addEventListener('click', e => {
    if (!e.target.closest('.chip')) return;
    document.querySelectorAll('#client-status-filter .chip').forEach(c => c.classList.remove('active'));
    e.target.closest('.chip').classList.add('active');
    _filter.status = e.target.closest('.chip').dataset.status;
    _page = 1;
    loadClients();
  });

  document.getElementById('client-search').addEventListener('input', debounce(e => {
    _filter.q = e.target.value.trim();
    _page = 1;
    loadClients();
  }));

  if (can(role, 'create_client')) {
    document.getElementById('add-client-btn').addEventListener('click', () => clientForm(null));
  }

  await loadClients();
}

async function loadClients() {
  const tableDiv = document.getElementById('clients-table');
  loading(tableDiv);

  let q = supabase.from('clients').select('*', { count: 'exact' });
  if (_filter.status !== 'all') q = q.eq('status', _filter.status);
  if (_filter.q) q = q.or(`full_name.ilike.%${_filter.q}%,email.ilike.%${_filter.q}%,company_name.ilike.%${_filter.q}%,phone.ilike.%${_filter.q}%`);
  q = q.order('created_at', { ascending: false }).range((_page - 1) * PER_PAGE, _page * PER_PAGE - 1);

  const { data, count, error } = await q;
  if (error) { tableDiv.innerHTML = `<div class="error-state">Failed to load clients.</div>`; return; }

  const clients = data || [];
  const role = getRole();
  const totalPages = Math.ceil((count || 0) / PER_PAGE);

  if (clients.length === 0) {
    tableDiv.innerHTML = '<div class="empty-state"><p>No clients found.</p></div>';
    return;
  }

  tableDiv.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Country</th><th>Payment Terms</th><th>Created</th>
          ${can(role, 'edit_client') ? '<th>Actions</th>' : ''}
        </tr></thead>
        <tbody>
          ${clients.map(c => `<tr>
            <td><div class="client-name">${escapeHtml(c.full_name)}</div>${c.company_name ? `<div class="text-muted text-sm">${escapeHtml(c.company_name)}</div>` : ''}</td>
            <td>${escapeHtml(c.email)}</td>
            <td>${statusBadge(c.client_type)}</td>
            <td>${statusBadge(c.status)}</td>
            <td>${escapeHtml(c.country)}</td>
            <td>${c.payment_terms_days} days</td>
            <td>${formatDate(c.created_at)}</td>
            ${can(role, 'edit_client') ? `<td class="actions">
              <button class="btn btn-sm btn-secondary edit-client" data-id="${c.id}">Edit</button>
              ${can(role, 'delete_client') ? `<button class="btn btn-sm btn-danger del-client" data-id="${c.id}">Delete</button>` : ''}
            </td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${totalPages > 1 ? `
    <div class="pagination">
      <button class="btn btn-sm btn-secondary" ${_page === 1 ? 'disabled' : ''} onclick="window._clientPage(${_page - 1})">Previous</button>
      <span class="page-info">Page ${_page} of ${totalPages} (${count} total)</span>
      <button class="btn btn-sm btn-secondary" ${_page >= totalPages ? 'disabled' : ''} onclick="window._clientPage(${_page + 1})">Next</button>
    </div>` : ''}`;

  window._clientPage = (p) => { _page = p; loadClients(); };

  document.querySelectorAll('.edit-client').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: c } = await supabase.from('clients').select('*').eq('id', btn.dataset.id).single();
      clientForm(c);
    });
  });
  document.querySelectorAll('.del-client').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete this client? This cannot be undone.');
      if (!ok) return;
      const { error } = await supabase.from('clients').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Failed to delete.', 'error'); return; }
      showToast('Client deleted.'); loadClients();
    });
  });
}

function clientForm(client) {
  const isEdit = !!client;
  showModal(isEdit ? 'Edit Client' : 'Add Client', `
    <form id="client-form" class="form-grid">
      <div class="form-group"><label>Full Name *</label><input name="full_name" value="${client?.full_name||''}" required></div>
      <div class="form-group"><label>Email *</label><input name="email" type="email" value="${client?.email||''}" required></div>
      <div class="form-group"><label>Phone</label><input name="phone" value="${client?.phone||''}"></div>
      <div class="form-group"><label>ID Number</label><input name="id_number" value="${client?.id_number||''}"></div>
      <div class="form-group"><label>Client Type</label>
        <select name="client_type">${['individual','corporate','government'].map(t=>`<option value="${t}" ${client?.client_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label>
        <select name="status">${['active','inactive','blacklisted'].map(s=>`<option value="${s}" ${client?.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-group"><label>Company Name</label><input name="company_name" value="${client?.company_name||''}"></div>
      <div class="form-group"><label>VAT Number</label><input name="vat_number" value="${client?.vat_number||''}"></div>
      <div class="form-group"><label>Tax Zone</label>
        <select name="tax_zone">${['standard','exempt','foreign'].map(t=>`<option value="${t}" ${client?.tax_zone===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Currency</label>
        <select name="preferred_currency">${['ZAR','USD','EUR','GBP','AED'].map(c=>`<option value="${c}" ${client?.preferred_currency===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Payment Terms (days)</label><input name="payment_terms_days" type="number" value="${client?.payment_terms_days||30}" min="0"></div>
      <div class="form-group"><label>Country</label><input name="country" value="${client?.country||'South Africa'}"></div>
      <div class="form-group"><label>City</label><input name="city" value="${client?.city||''}"></div>
      <div class="form-group form-full"><label>Address</label><textarea name="address" rows="2">${client?.address||''}</textarea></div>
      <div class="form-group form-full"><label>Notes</label><textarea name="notes" rows="2">${client?.notes||''}</textarea></div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-client-btn">${isEdit ? 'Update' : 'Add'} Client</button>`
  );

  document.getElementById('save-client-btn').addEventListener('click', async () => {
    const form = document.getElementById('client-form');
    const data = Object.fromEntries(new FormData(form));
    data.payment_terms_days = parseInt(data.payment_terms_days);
    const btn = document.getElementById('save-client-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    let error;
    if (isEdit) ({ error } = await supabase.from('clients').update(data).eq('id', client.id));
    else ({ error } = await supabase.from('clients').insert(data));
    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = `${isEdit?'Update':'Add'} Client`; return; }
    showToast(isEdit ? 'Client updated.' : 'Client added.');
    closeModal(); loadClients();
  });
}
