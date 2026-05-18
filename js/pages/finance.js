import { supabase } from '../supabase-client.js';
import { formatCurrency, formatDate, statusBadge, showToast, showModal, closeModal, loading, escapeHtml } from '../utils.js';
import { can } from '../rbac.js';
import { getRole } from '../auth.js';

export default async function render(container) {
  const role = getRole();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Finance</h2><p class="page-sub">Invoices, payments, and revenue overview</p></div>
    </div>
    <div id="finance-stats" class="stats-grid"></div>
    <div class="card">
      <div class="tab-bar" id="finance-tabs">
        <button class="tab active" data-tab="invoices">Invoices</button>
        <button class="tab" data-tab="payments">Payments</button>
        <button class="tab" data-tab="overdue">Overdue</button>
      </div>
      <div id="finance-content"></div>
    </div>`;

  loadStats();

  document.getElementById('finance-tabs').addEventListener('click', e => {
    if (!e.target.closest('.tab')) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    e.target.closest('.tab').classList.add('active');
    const tab = e.target.closest('.tab').dataset.tab;
    if (tab === 'invoices') loadInvoices();
    else if (tab === 'payments') loadPayments();
    else if (tab === 'overdue') loadOverdue();
  });

  await loadInvoices();
}

async function loadStats() {
  const statsDiv = document.getElementById('finance-stats');
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: invoices } = await supabase.from('invoices').select('status, total_zar, vat_zar, payments_received, balance_due_zar, created_at');
  const all = invoices || [];
  const thisMonth = all.filter(i => i.created_at >= startOfMonth);
  const paid = thisMonth.filter(i => i.status === 'paid');
  const outstanding = all.filter(i => ['sent','overdue'].includes(i.status));
  const overdue = all.filter(i => i.status === 'overdue');

  const monthRev = paid.reduce((s,i) => s + parseFloat(i.total_zar||0), 0);
  const monthVat = paid.reduce((s,i) => s + parseFloat(i.vat_zar||0), 0);
  const deposits = thisMonth.reduce((s,i) => s + parseFloat(i.payments_received||0), 0);
  const outstandingTotal = outstanding.reduce((s,i) => s + parseFloat(i.balance_due_zar||0), 0);

  statsDiv.innerHTML = [
    ['Revenue This Month', formatCurrency(monthRev), 'stat-revenue'],
    ['VAT Collected', formatCurrency(monthVat), ''],
    ['Deposits Collected', formatCurrency(deposits), 'stat-active'],
    ['Outstanding Balance', formatCurrency(outstandingTotal), overdue.length > 0 ? 'stat-danger' : ''],
  ].map(([l,v,c]) => `<div class="stat-card ${c}"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`).join('');
}

async function loadInvoices() {
  const content = document.getElementById('finance-content');
  loading(content);
  const { data } = await supabase.from('invoices')
    .select('*, clients(full_name), bookings(booking_reference)')
    .order('created_at', { ascending: false });
  const invoices = data || [];
  const role = getRole();
  renderInvoiceTable(content, invoices, role);
}

async function loadPayments() {
  const content = document.getElementById('finance-content');
  loading(content);
  const { data } = await supabase.from('payments')
    .select('*, invoices(invoice_number)')
    .order('created_at', { ascending: false });
  const payments = data || [];
  if (payments.length === 0) { content.innerHTML = '<div class="empty-state"><p>No payments recorded.</p></div>'; return; }
  content.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Invoice</th><th>Amount</th><th>Method</th><th>Date</th><th>Reference</th></tr></thead>
        <tbody>
          ${payments.map(p => `<tr>
            <td class="mono">${p.invoices?.invoice_number || '—'}</td>
            <td class="amount">${formatCurrency(p.amount_zar)}</td>
            <td><span class="badge badge-blue">${p.payment_method}</span></td>
            <td>${formatDate(p.payment_date)}</td>
            <td class="text-muted">${p.reference || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function loadOverdue() {
  const content = document.getElementById('finance-content');
  loading(content);
  const { data } = await supabase.from('invoices')
    .select('*, clients(full_name), bookings(booking_reference)')
    .in('status', ['overdue','sent'])
    .lt('due_date', new Date().toISOString().split('T')[0])
    .order('due_date', { ascending: true });
  const invoices = data || [];
  if (invoices.length === 0) { content.innerHTML = '<div class="empty-state"><p>No overdue invoices.</p></div>'; return; }
  const role = getRole();
  renderInvoiceTable(content, invoices, role);
}

function renderInvoiceTable(container, invoices, role) {
  if (invoices.length === 0) { container.innerHTML = '<div class="empty-state"><p>No invoices found.</p></div>'; return; }
  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Invoice #</th><th>Booking</th><th>Client</th><th>Total</th><th>Balance Due</th><th>Due Date</th><th>Status</th>
          ${can(role,'record_payment') ? '<th>Actions</th>' : ''}
        </tr></thead>
        <tbody>
          ${invoices.map(inv => `<tr>
            <td class="mono">${inv.invoice_number}</td>
            <td class="mono">${inv.bookings?.booking_reference || '—'}</td>
            <td>${inv.clients?.full_name || '—'}</td>
            <td class="amount">${formatCurrency(inv.total_zar)}</td>
            <td class="amount ${parseFloat(inv.balance_due_zar) > 0 ? 'text-danger' : ''}">${formatCurrency(inv.balance_due_zar)}</td>
            <td>${formatDate(inv.due_date)}</td>
            <td>${statusBadge(inv.status)}</td>
            ${can(role,'record_payment') ? `<td class="actions">
              ${parseFloat(inv.balance_due_zar) > 0 ? `<button class="btn btn-sm btn-primary record-payment" data-id="${inv.id}" data-num="${escapeHtml(inv.invoice_number)}" data-balance="${inv.balance_due_zar}">Record Payment</button>` : ''}
              <button class="btn btn-sm btn-secondary update-inv-status" data-id="${inv.id}" data-status="${inv.status}">Status</button>
            </td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.querySelectorAll('.record-payment').forEach(btn => {
    btn.addEventListener('click', () => recordPaymentModal(btn.dataset.id, btn.dataset.num, btn.dataset.balance));
  });
  document.querySelectorAll('.update-inv-status').forEach(btn => {
    btn.addEventListener('click', () => updateInvoiceStatus(btn.dataset.id, btn.dataset.status));
  });
}

function recordPaymentModal(invoiceId, invoiceNum, balance) {
  showModal(`Record Payment — ${invoiceNum}`, `
    <div class="form-grid">
      <div class="form-group"><label>Amount (ZAR) *</label>
        <input type="number" id="pay-amount" step="0.01" value="${parseFloat(balance).toFixed(2)}" min="0.01"></div>
      <div class="form-group"><label>Payment Method</label>
        <select id="pay-method">${['eft','cash','card','crypto','other'].map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="form-group"><label>Payment Date</label>
        <input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Reference</label>
        <input id="pay-ref" placeholder="EFT reference, receipt number..."></div>
      <div class="form-group form-full"><label>Notes</label><textarea id="pay-notes" rows="2"></textarea></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-payment-btn">Record Payment</button>`
  );

  document.getElementById('save-payment-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const method = document.getElementById('pay-method').value;
    const date = document.getElementById('pay-date').value;
    const ref = document.getElementById('pay-ref').value;
    const notes = document.getElementById('pay-notes').value;
    if (!amount || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    const btn = document.getElementById('save-payment-btn');
    btn.disabled = true; btn.textContent = 'Saving...';

    const { error: pErr } = await supabase.from('payments').insert({
      invoice_id: invoiceId, amount_zar: amount, payment_method: method,
      payment_date: date, reference: ref || null, notes: notes || null,
    });
    if (pErr) { showToast(pErr.message, 'error'); btn.disabled = false; btn.textContent = 'Record Payment'; return; }

    // Update invoice
    const { data: inv } = await supabase.from('invoices').select('total_zar, payments_received').eq('id', invoiceId).single();
    if (inv) {
      const newReceived = parseFloat(inv.payments_received || 0) + amount;
      const newBalance = Math.max(0, parseFloat(inv.total_zar) - newReceived);
      const newStatus = newBalance <= 0 ? 'paid' : 'sent';
      await supabase.from('invoices').update({
        payments_received: newReceived, balance_due_zar: newBalance, status: newStatus,
        ...(newBalance <= 0 ? { paid_date: date } : {}),
      }).eq('id', invoiceId);
    }

    showToast('Payment recorded.');
    closeModal(); loadInvoices();
  });
}

function updateInvoiceStatus(invoiceId, currentStatus) {
  showModal('Update Invoice Status', `
    <div class="form-group"><label>Status</label>
      <select id="new-inv-status">
        ${['draft','sent','paid','overdue','cancelled','void'].map(s=>`<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="update-inv-btn">Update</button>`
  );

  document.getElementById('update-inv-btn').addEventListener('click', async () => {
    const status = document.getElementById('new-inv-status').value;
    const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Invoice updated.'); closeModal(); loadInvoices();
  });
}
