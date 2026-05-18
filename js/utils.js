export function formatCurrency(amount, currency = 'ZAR') {
  const num = parseFloat(amount) || 0;
  if (currency === 'ZAR') return `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(str) {
  if (!str) return '—';
  const d = new Date(str);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function generateRef() {
  return `FHD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function generateInvoiceNumber(seq) {
  return `FHD-INV-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
}

export function statusBadge(status) {
  const map = {
    // Booking statuses
    quote: ['badge-gray', 'Quote'],
    pending_deposit: ['badge-amber', 'Pending Deposit'],
    confirmed: ['badge-blue', 'Confirmed'],
    active: ['badge-green', 'Active'],
    completed: ['badge-teal', 'Completed'],
    cancelled: ['badge-red', 'Cancelled'],
    no_show: ['badge-red', 'No Show'],
    // Vehicle statuses
    available: ['badge-green', 'Available'],
    booked: ['badge-blue', 'Booked'],
    maintenance: ['badge-amber', 'Maintenance'],
    inactive: ['badge-gray', 'Inactive'],
    // Driver statuses
    on_trip: ['badge-blue', 'On Trip'],
    off_duty: ['badge-gray', 'Off Duty'],
    suspended: ['badge-red', 'Suspended'],
    // Invoice statuses
    draft: ['badge-gray', 'Draft'],
    sent: ['badge-blue', 'Sent'],
    paid: ['badge-green', 'Paid'],
    overdue: ['badge-red', 'Overdue'],
    void: ['badge-gray', 'Void'],
    // Client statuses
    blacklisted: ['badge-red', 'Blacklisted'],
    // Client types
    individual: ['badge-blue', 'Individual'],
    corporate: ['badge-purple', 'Corporate'],
    government: ['badge-teal', 'Government'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function showModal(title, bodyHtml, footerHtml = '') {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml || '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
  m.classList.add('active');
}

export function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

export function confirmDialog(message) {
  return new Promise(resolve => {
    showModal('Confirm', `<p>${message}</p>`,
      `<button class="btn btn-secondary" onclick="closeModal(); window._confirmResolve(false)">Cancel</button>
       <button class="btn btn-danger" onclick="closeModal(); window._confirmResolve(true)">Confirm</button>`);
    window._confirmResolve = resolve;
  });
}

export function loading(container, msg = 'Loading...') {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>${msg}</span></div>`;
}

export function empty(container, msg = 'No data found', icon = '') {
  container.innerHTML = `<div class="empty-state">${icon}<p>${msg}</p></div>`;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
