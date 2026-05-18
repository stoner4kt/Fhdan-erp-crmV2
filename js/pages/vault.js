import { supabase } from '../supabase-client.js';
import { formatDate, statusBadge, showToast, showModal, closeModal, loading, escapeHtml, confirmDialog } from '../utils.js';
import { can } from '../rbac.js';
import { getRole, getProfile } from '../auth.js';

const DOC_TYPES = ['passport','rsa_id','drivers_license','pdp','vehicle_registration','insurance','roadworthy','other'];
const ENTITY_TYPES = ['client','driver','vehicle'];

export default async function render(container) {
  const role = getRole();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Document Vault</h2><p class="page-sub">POPIA-compliant secure document storage</p></div>
      ${can(role,'upload_document') ? `<button class="btn btn-primary" id="upload-doc-btn">+ Upload Document</button>` : ''}
    </div>
    <div class="filter-bar">
      <div class="filter-chips" id="doc-type-filter">
        <button class="chip active" data-type="all">All</button>
        ${DOC_TYPES.map(t => `<button class="chip" data-type="${t}">${t.replace('_',' ')}</button>`).join('')}
      </div>
    </div>
    <div class="card"><div id="vault-table"></div></div>`;

  if (can(role,'upload_document')) {
    document.getElementById('upload-doc-btn').addEventListener('click', () => uploadForm(container));
  }

  document.getElementById('doc-type-filter').addEventListener('click', e => {
    if (!e.target.closest('.chip')) return;
    document.querySelectorAll('#doc-type-filter .chip').forEach(c => c.classList.remove('active'));
    e.target.closest('.chip').classList.add('active');
    loadDocuments(e.target.closest('.chip').dataset.type);
  });

  await loadDocuments('all');
}

async function loadDocuments(typeFilter) {
  const tableDiv = document.getElementById('vault-table');
  loading(tableDiv);

  let q = supabase.from('documents').select('*').order('created_at', { ascending: false });
  if (typeFilter !== 'all') q = q.eq('document_type', typeFilter);

  const { data, error } = await q;
  if (error) { tableDiv.innerHTML = '<div class="error-state">Failed to load documents.</div>'; return; }
  const docs = data || [];
  const role = getRole();

  if (docs.length === 0) { tableDiv.innerHTML = '<div class="empty-state"><p>No documents found.</p></div>'; return; }

  tableDiv.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>File Name</th><th>Document Type</th><th>Entity</th><th>Expiry</th><th>Uploaded</th>
          ${can(role,'delete_document')||true ? '<th>Actions</th>' : ''}
        </tr></thead>
        <tbody>
          ${docs.map(d => `<tr>
            <td><strong>${escapeHtml(d.file_name)}</strong></td>
            <td><span class="badge badge-blue">${d.document_type.replace('_',' ')}</span></td>
            <td><span class="badge badge-gray">${d.entity_type}</span> <span class="text-muted text-sm">${d.entity_id.slice(0,8)}...</span></td>
            <td class="${d.expiry_date && new Date(d.expiry_date) < new Date() ? 'text-danger' : ''}">${formatDate(d.expiry_date)}</td>
            <td>${formatDate(d.created_at)}</td>
            <td class="actions">
              ${can(role,'delete_document') ? `<button class="btn btn-sm btn-danger del-doc" data-id="${d.id}">Delete</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.querySelectorAll('.del-doc').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete this document? This cannot be undone.');
      if (!ok) return;
      const { error } = await supabase.from('documents').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Failed to delete.', 'error'); return; }
      showToast('Document deleted.'); loadDocuments(document.querySelector('#doc-type-filter .chip.active')?.dataset.type || 'all');
    });
  });
}

async function uploadForm(container) {
  // Fetch entity lists for reference
  const [{ data: clients }, { data: drivers }, { data: vehicles }] = await Promise.all([
    supabase.from('clients').select('id, full_name').order('full_name'),
    supabase.from('drivers').select('id, full_name').order('full_name'),
    supabase.from('vehicles').select('id, registration, make, model').order('registration'),
  ]);

  showModal('Upload Document', `
    <form id="upload-form" class="form-grid">
      <div class="form-group"><label>Entity Type *</label>
        <select id="doc-entity-type" name="entity_type" required>
          <option value="">Select entity type</option>
          ${ENTITY_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Entity *</label>
        <select id="doc-entity-id" name="entity_id" required>
          <option value="">Select entity type first</option>
        </select></div>
      <div class="form-group"><label>Document Type *</label>
        <select name="document_type" required>
          ${DOC_TYPES.map(t => `<option value="${t}">${t.replace('_',' ')}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>File Name *</label>
        <input name="file_name" required placeholder="e.g. passport_john_smith.pdf"></div>
      <div class="form-group"><label>Expiry Date</label>
        <input type="date" name="expiry_date"></div>
      <div class="form-group form-full"><label>Notes</label>
        <textarea name="notes" rows="2"></textarea></div>
      <div class="form-group form-full">
        <p class="text-muted text-sm">Note: File upload requires Supabase Storage to be configured. For now, provide the file name and path manually. See the Setup Guide for storage configuration.</p>
      </div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-doc-btn">Save Document Record</button>`
  );

  // Dynamic entity list
  document.getElementById('doc-entity-type').addEventListener('change', e => {
    const type = e.target.value;
    const entitySelect = document.getElementById('doc-entity-id');
    let options = '<option value="">Select...</option>';
    if (type === 'client') options += (clients||[]).map(c => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join('');
    else if (type === 'driver') options += (drivers||[]).map(d => `<option value="${d.id}">${escapeHtml(d.full_name)}</option>`).join('');
    else if (type === 'vehicle') options += (vehicles||[]).map(v => `<option value="${v.id}">${escapeHtml(v.registration)} — ${v.make} ${v.model}</option>`).join('');
    entitySelect.innerHTML = options;
  });

  document.getElementById('save-doc-btn').addEventListener('click', async () => {
    const form = document.getElementById('upload-form');
    const data = Object.fromEntries(new FormData(form));
    if (!data.entity_type || !data.entity_id || !data.document_type || !data.file_name) {
      showToast('Please fill all required fields.', 'error'); return;
    }
    const profile = getProfile();
    const btn = document.getElementById('save-doc-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    const { error } = await supabase.from('documents').insert({
      ...data, file_size: 0, uploaded_by: profile?.id,
    });
    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Save Document Record'; return; }
    showToast('Document record saved.');
    closeModal(); loadDocuments('all');
  });
}
