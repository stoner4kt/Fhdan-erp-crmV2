import { supabase } from '../supabase-client.js';
import { formatCurrency, showToast, loading, escapeHtml, generateRef } from '../utils.js';
import { navigate } from '../router.js';
import { getProfile } from '../auth.js';
import { VAT_RATE } from '../config.js';

let _step = 1;
let _data = { client: null, vehicle: null, driver: null, dates: {}, financials: {} };

export default async function render(container) {
  _step = 1;
  _data = { client: null, vehicle: null, driver: null, dates: {}, financials: {} };

  container.innerHTML = `
    <div class="page-header">
      <div><h2>New Booking</h2><p class="page-sub">Create a new booking in 4 steps</p></div>
      <button class="btn btn-secondary" onclick="window._navigate('/bookings')">Cancel</button>
    </div>
    <div class="stepper" id="stepper">
      ${['Client','Vehicle & Dates','Financials','Review'].map((s,i) => `
        <div class="step ${i===0?'active':''}" data-step="${i+1}">
          <div class="step-num">${i+1}</div>
          <div class="step-label">${s}</div>
        </div>`).join('<div class="step-line"></div>')}
    </div>
    <div class="card" id="step-content"></div>`;

  await renderStep(container);
}

async function renderStep(container) {
  // Update stepper
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === _step);
    el.classList.toggle('done', i + 1 < _step);
  });

  const content = document.getElementById('step-content');

  if (_step === 1) await renderStep1(content);
  else if (_step === 2) await renderStep2(content);
  else if (_step === 3) renderStep3(content);
  else if (_step === 4) renderStep4(content);
}

async function renderStep1(content) {
  const { data: clients } = await supabase.from('clients').select('id, full_name, email, phone').eq('status', 'active').order('full_name');

  content.innerHTML = `
    <div class="step-body">
      <h3>Step 1 — Select Client</h3>
      <div class="filter-bar">
        <input type="search" id="client-search-s1" placeholder="Search clients..." class="search-input">
        <button class="btn btn-secondary btn-sm" id="new-client-toggle">+ New Client</button>
      </div>
      <div id="client-list" class="select-list">
        ${(clients||[]).map(c => `
          <div class="select-item ${_data.client?.id===c.id?'selected':''}" data-id="${c.id}" data-name="${escapeHtml(c.full_name)}" data-email="${escapeHtml(c.email)}" data-phone="${escapeHtml(c.phone||'')}">
            <div class="select-item-main">${escapeHtml(c.full_name)}</div>
            <div class="text-muted text-sm">${escapeHtml(c.email)} ${c.phone?'· '+c.phone:''}</div>
          </div>`).join('')}
      </div>
      <div id="new-client-form" style="display:none" class="form-grid mt-4">
        <div class="form-group"><label>Full Name *</label><input id="nc-name" placeholder="John Smith"></div>
        <div class="form-group"><label>Email *</label><input id="nc-email" type="email"></div>
        <div class="form-group"><label>Phone</label><input id="nc-phone"></div>
        <div class="form-group"><label>Client Type</label>
          <select id="nc-type"><option value="individual">Individual</option><option value="corporate">Corporate</option><option value="government">Government</option></select></div>
        <div class="form-group form-full"><button class="btn btn-secondary" id="create-client-btn">Create & Select Client</button></div>
      </div>
      <div class="step-nav">
        <span></span>
        <button class="btn btn-primary" id="step1-next" ${!_data.client?'disabled':''}>Next: Vehicle & Dates</button>
      </div>
    </div>`;

  const listEl = document.getElementById('client-list');
  listEl.addEventListener('click', e => {
    const item = e.target.closest('.select-item');
    if (!item) return;
    document.querySelectorAll('.select-item').forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    _data.client = { id: item.dataset.id, full_name: item.dataset.name, email: item.dataset.email, phone: item.dataset.phone };
    document.getElementById('step1-next').disabled = false;
  });

  document.getElementById('client-search-s1').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.select-item').forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('new-client-toggle').addEventListener('click', () => {
    const f = document.getElementById('new-client-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('create-client-btn').addEventListener('click', async () => {
    const name = document.getElementById('nc-name').value.trim();
    const email = document.getElementById('nc-email').value.trim();
    const phone = document.getElementById('nc-phone').value.trim();
    const type = document.getElementById('nc-type').value;
    if (!name || !email) { showToast('Name and email required.', 'error'); return; }
    const { data: nc, error } = await supabase.from('clients').insert({ full_name: name, email, phone, client_type: type }).select().single();
    if (error) { showToast(error.message, 'error'); return; }
    _data.client = { id: nc.id, full_name: nc.full_name, email: nc.email, phone: nc.phone };
    showToast(`Client ${name} created and selected.`);
    document.getElementById('new-client-form').style.display = 'none';
    document.getElementById('step1-next').disabled = false;
  });

  document.getElementById('step1-next').addEventListener('click', () => { _step = 2; renderStep(); });
}

async function renderStep2(content) {
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    supabase.from('vehicles').select('id, registration, make, model, year, category, daily_rate_zar, chauffeur_rate_zar, status, seating_capacity').order('make'),
    supabase.from('drivers').select('id, full_name, status').order('full_name'),
  ]);

  content.innerHTML = `
    <div class="step-body">
      <h3>Step 2 — Vehicle & Dates</h3>
      <div class="form-grid">
        <div class="form-group form-full"><label>Booking Type *</label>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" name="booking_type" value="chauffeur" ${_data.dates.booking_type!=='self_drive'?'checked':''}> Chauffeur Drive</label>
            <label class="radio-label"><input type="radio" name="booking_type" value="self_drive" ${_data.dates.booking_type==='self_drive'?'checked':''}> Self Drive</label>
          </div>
        </div>
        <div class="form-group"><label>Pickup Date & Time *</label><input type="datetime-local" id="pickup-dt" value="${_data.dates.pickup_datetime||''}"></div>
        <div class="form-group"><label>Dropoff Date & Time *</label><input type="datetime-local" id="dropoff-dt" value="${_data.dates.dropoff_datetime||''}"></div>
        <div class="form-group"><label>Pickup Location *</label><input id="pickup-loc" value="${_data.dates.pickup_location||''}" placeholder="Cape Town International Airport"></div>
        <div class="form-group"><label>Dropoff Location *</label><input id="dropoff-loc" value="${_data.dates.dropoff_location||''}" placeholder="V&A Waterfront Hotel"></div>
        <div class="form-group form-full"><label>Driver</label>
          <select id="driver-select">
            <option value="">No driver (self-drive)</option>
            ${(drivers||[]).map(d => `<option value="${d.id}" ${_data.driver?.id===d.id?'selected':''}>${escapeHtml(d.full_name)} — ${d.status}</option>`).join('')}
          </select>
        </div>
      </div>
      <h4 class="mt-4">Select Vehicle</h4>
      <div id="vehicle-list" class="select-list vehicle-select-list">
        ${(vehicles||[]).map(v => `
          <div class="select-item vehicle-select-item ${_data.vehicle?.id===v.id?'selected':''}" data-id="${v.id}"
               data-name="${escapeHtml(v.make+' '+v.model)}" data-reg="${escapeHtml(v.registration)}"
               data-daily="${v.daily_rate_zar}" data-chauffeur="${v.chauffeur_rate_zar}" data-status="${v.status}">
            <div class="vehicle-select-info">
              <strong>${escapeHtml(v.make)} ${escapeHtml(v.model)} ${v.year}</strong>
              <span class="mono text-sm">${v.registration}</span>
              <span class="badge badge-purple">${v.category}</span>
            </div>
            <div class="vehicle-select-rates">
              <span>Daily: ${formatCurrency(v.daily_rate_zar)}</span>
              <span>Chauffeur: ${formatCurrency(v.chauffeur_rate_zar)}</span>
            </div>
            <div class="vehicle-select-status">${v.status}</div>
          </div>`).join('')}
      </div>
      <div id="avail-status" class="avail-status"></div>
      <div class="step-nav">
        <button class="btn btn-secondary" id="step2-back">Back</button>
        <button class="btn btn-primary" id="step2-next">Next: Financials</button>
      </div>
    </div>`;

  document.querySelectorAll('.vehicle-select-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.vehicle-select-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      _data.vehicle = { id: item.dataset.id, name: item.dataset.name, registration: item.dataset.reg, daily_rate: item.dataset.daily, chauffeur_rate: item.dataset.chauffeur };
    });
  });

  document.getElementById('step2-back').addEventListener('click', () => { _step = 1; renderStep(); });
  document.getElementById('step2-next').addEventListener('click', () => {
    const pickup = document.getElementById('pickup-dt').value;
    const dropoff = document.getElementById('dropoff-dt').value;
    const pickupLoc = document.getElementById('pickup-loc').value.trim();
    const dropoffLoc = document.getElementById('dropoff-loc').value.trim();
    const bookingType = document.querySelector('input[name="booking_type"]:checked')?.value || 'chauffeur';
    const driverId = document.getElementById('driver-select').value;

    if (!pickup || !dropoff) { showToast('Please select pickup and dropoff times.', 'error'); return; }
    if (new Date(dropoff) <= new Date(pickup)) { showToast('Dropoff must be after pickup.', 'error'); return; }
    if (!pickupLoc || !dropoffLoc) { showToast('Please enter locations.', 'error'); return; }
    if (!_data.vehicle) { showToast('Please select a vehicle.', 'error'); return; }

    _data.dates = { pickup_datetime: pickup, dropoff_datetime: dropoff, pickup_location: pickupLoc, dropoff_location: dropoffLoc, booking_type: bookingType };
    if (driverId) {
      const driverEl = document.querySelector(`#driver-select option[value="${driverId}"]`);
      _data.driver = { id: driverId, full_name: driverEl?.textContent.split(' — ')[0] || '' };
    } else {
      _data.driver = null;
    }

    // Calculate days
    const days = Math.max(1, Math.ceil((new Date(dropoff) - new Date(pickup)) / (1000 * 60 * 60 * 24)));
    const rate = bookingType === 'chauffeur' ? parseFloat(_data.vehicle.chauffeur_rate) : parseFloat(_data.vehicle.daily_rate);
    _data.financials = { days, rate, subtotal: days * rate, discount: 0 };

    _step = 3; renderStep();
  });
}

function renderStep3(content) {
  const { subtotal = 0, discount = 0, rate, days } = _data.financials;
  const calc = () => {
    const sub = parseFloat(document.getElementById('fin-subtotal').value) || 0;
    const disc = parseFloat(document.getElementById('fin-discount').value) || 0;
    const dep = parseFloat(document.getElementById('fin-deposit').value) || 0;
    const vat = (sub - disc) * VAT_RATE;
    const total = sub - disc + vat;
    document.getElementById('fin-vat').textContent = formatCurrency(vat);
    document.getElementById('fin-total').textContent = formatCurrency(total);
    _data.financials = { ...(_data.financials), subtotal: sub, discount: disc, deposit: dep, vat, total };
  };

  const initVat = (subtotal - discount) * VAT_RATE;
  const initTotal = subtotal - discount + initVat;
  _data.financials = { ...(_data.financials), vat: initVat, total: initTotal, deposit: subtotal * 0.5 };

  content.innerHTML = `
    <div class="step-body">
      <h3>Step 3 — Financials</h3>
      <div class="finance-calc">
        <div class="calc-info">
          <div class="calc-row"><span>${days} day(s) × ${formatCurrency(rate)}/day</span></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Subtotal (ZAR)</label>
            <input type="number" id="fin-subtotal" value="${subtotal.toFixed(2)}" step="0.01" oninput="window._calcFin()"></div>
          <div class="form-group"><label>Discount (ZAR)</label>
            <input type="number" id="fin-discount" value="${discount.toFixed(2)}" step="0.01" oninput="window._calcFin()"></div>
          <div class="form-group"><label>Deposit Required (ZAR)</label>
            <input type="number" id="fin-deposit" value="${(_data.financials.deposit||0).toFixed(2)}" step="0.01" oninput="window._calcFin()"></div>
        </div>
        <div class="calc-summary">
          <div class="calc-row"><span>VAT (15%)</span><span id="fin-vat">${formatCurrency(initVat)}</span></div>
          <div class="calc-row total-row"><span>TOTAL</span><span id="fin-total">${formatCurrency(initTotal)}</span></div>
        </div>
        <div class="form-group mt-4"><label>Special Requirements</label>
          <textarea id="fin-requirements" rows="2" placeholder="Any special requirements...">${_data.financials.requirements||''}</textarea></div>
        <div class="form-group"><label>Booking Status</label>
          <select id="fin-status">
            ${['quote','pending_deposit','confirmed'].map(s=>`<option value="${s}" ${_data.financials.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select></div>
      </div>
      <div class="step-nav">
        <button class="btn btn-secondary" id="step3-back">Back</button>
        <button class="btn btn-primary" id="step3-next">Review Booking</button>
      </div>
    </div>`;

  window._calcFin = calc;

  document.getElementById('step3-back').addEventListener('click', () => { _step = 2; renderStep(); });
  document.getElementById('step3-next').addEventListener('click', () => {
    calc();
    _data.financials.requirements = document.getElementById('fin-requirements').value;
    _data.financials.status = document.getElementById('fin-status').value;
    _step = 4; renderStep();
  });
}

function renderStep4(content) {
  const f = _data.financials;
  content.innerHTML = `
    <div class="step-body">
      <h3>Step 4 — Review & Confirm</h3>
      <div class="review-grid">
        <div class="review-section">
          <h4>Client</h4>
          <p><strong>${escapeHtml(_data.client?.full_name)}</strong></p>
          <p>${escapeHtml(_data.client?.email)}</p>
          ${_data.client?.phone ? `<p>${escapeHtml(_data.client.phone)}</p>` : ''}
        </div>
        <div class="review-section">
          <h4>Vehicle</h4>
          <p><strong>${escapeHtml(_data.vehicle?.name)}</strong></p>
          <p class="mono">${escapeHtml(_data.vehicle?.registration)}</p>
        </div>
        <div class="review-section">
          <h4>Trip Details</h4>
          <p><strong>Type:</strong> ${_data.dates.booking_type}</p>
          <p><strong>Pickup:</strong> ${_data.dates.pickup_datetime?.replace('T', ' ')}</p>
          <p><strong>Dropoff:</strong> ${_data.dates.dropoff_datetime?.replace('T', ' ')}</p>
          <p><strong>From:</strong> ${escapeHtml(_data.dates.pickup_location)}</p>
          <p><strong>To:</strong> ${escapeHtml(_data.dates.dropoff_location)}</p>
          ${_data.driver ? `<p><strong>Driver:</strong> ${escapeHtml(_data.driver.full_name)}</p>` : ''}
        </div>
        <div class="review-section">
          <h4>Financials</h4>
          <p><strong>Subtotal:</strong> ${formatCurrency(f.subtotal)}</p>
          ${f.discount > 0 ? `<p><strong>Discount:</strong> − ${formatCurrency(f.discount)}</p>` : ''}
          <p><strong>VAT (15%):</strong> ${formatCurrency(f.vat)}</p>
          <p class="total-line"><strong>TOTAL:</strong> ${formatCurrency(f.total)}</p>
          <p><strong>Deposit:</strong> ${formatCurrency(f.deposit)}</p>
          <p><strong>Status:</strong> ${f.status}</p>
        </div>
      </div>
      <div class="step-nav">
        <button class="btn btn-secondary" id="step4-back">Back</button>
        <button class="btn btn-primary btn-lg" id="confirm-booking-btn">Confirm Booking</button>
      </div>
    </div>`;

  document.getElementById('step4-back').addEventListener('click', () => { _step = 3; renderStep(); });
  document.getElementById('confirm-booking-btn').addEventListener('click', async () => {
    const btn = document.getElementById('confirm-booking-btn');
    btn.disabled = true; btn.textContent = 'Creating booking...';

    const profile = getProfile();
    const payload = {
      booking_reference: generateRef(),
      client_id: _data.client.id,
      vehicle_id: _data.vehicle.id,
      driver_id: _data.driver?.id || null,
      booking_type: _data.dates.booking_type,
      status: _data.financials.status || 'quote',
      pickup_datetime: new Date(_data.dates.pickup_datetime).toISOString(),
      dropoff_datetime: new Date(_data.dates.dropoff_datetime).toISOString(),
      pickup_location: _data.dates.pickup_location,
      dropoff_location: _data.dates.dropoff_location,
      currency: 'ZAR',
      subtotal_zar: _data.financials.subtotal,
      discount_amount: _data.financials.discount || 0,
      deposit_amount: _data.financials.deposit || 0,
      vat_zar: _data.financials.vat,
      total_zar: _data.financials.total,
      special_requirements: _data.financials.requirements || null,
      created_by: profile?.id || null,
    };

    const { error } = await supabase.from('bookings').insert(payload);
    if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Confirm Booking'; return; }
    showToast('Booking created successfully!');
    navigate('/bookings');
  });
}
