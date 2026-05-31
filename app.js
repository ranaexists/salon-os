/* ========================================
   SALEEM LUXURY SALON MANAGEMENT SYSTEM
   Core Application Engine — All 24 Modules
======================================== */

'use strict';

// ========================================
// DATA STORE (localStorage backed)
// ========================================

const DB_KEYS = {
  settings:     'saleem_settings',
  customers:    'saleem_customers',
  queue:        'saleem_queue',
  barbers:      'saleem_barbers',
  invoices:     'saleem_invoices',
  appointments: 'saleem_appointments',
  inventory:    'saleem_inventory',
  expenses:     'saleem_expenses',
  employees:    'saleem_employees',
  notifications:'saleem_notifications',
  tokenCounter: 'saleem_token_counter',
  invoiceCounter:'saleem_invoice_counter',
  coupons:      'saleem_coupons',
  notifyLog:    'saleem_notify_log',
};

const DEFAULT_NOTIF_TEMPLATE =
`Dear {name} 🙏

Your token *{token}* is now ready!

Please proceed to *{chair}* with *{barber}*.

Thank you for choosing *{salon}*. We look forward to serving you! ✂️🌟`;

function dbGet(key, fallback = []) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function dbSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function dbGetObj(key, fallback = {}) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

// ========================================
// GLOBAL STATE
// ========================================

let state = {
  currentPage: 'dashboard',
  activeBillCustomer: null,
  selectedPayment: null,
  apptFilter: 'today',
  analyticsData: {},
};

// ========================================
// NAVIGATION
// ========================================

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  queue: 'Queue & Tokens',
  active: 'Active Customers',
  barbers: 'Barber Management',
  billing: 'Billing & Payment',
  crm: 'Customer CRM',
  appointments: 'Appointments',
  analytics: 'Analytics & Reports',
  inventory: 'Inventory',
  expenses: 'Expense Management',
  employees: 'Employee Management',
  settings: 'Settings',
  backup: 'Backup & Restore',
};

function navigate(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  // Show target
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  // Update title
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  state.currentPage = page;

  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('open');
  }

  // Render page content
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':    renderDashboard(); break;
    case 'queue':        renderQueue(); break;
    case 'active':       renderActiveCustomers(); break;
    case 'barbers':      renderBarbers(); break;
    case 'billing':      renderInvoices(); break;
    case 'crm':          renderCRM(); break;
    case 'appointments': renderAppointments(); break;
    case 'analytics':    renderAnalytics(); break;
    case 'inventory':    renderInventory(); break;
    case 'expenses':     renderExpenses(); break;
    case 'employees':    renderEmployees(); break;
    case 'settings':     renderSettings(); break;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ========================================
// MODULE 1 — TOKEN SYSTEM
// ========================================

function generateToken() {
  const counter = dbGetObj(DB_KEYS.tokenCounter, { count: 0 });
  counter.count++;
  dbSet(DB_KEYS.tokenCounter, counter);
  return 'T-' + String(counter.count).padStart(3, '0');
}

function generateInvoiceNo() {
  const counter = dbGetObj(DB_KEYS.invoiceCounter, { count: 0 });
  counter.count++;
  dbSet(DB_KEYS.invoiceCounter, counter);
  return 'INV-' + String(counter.count).padStart(4, '0');
}

function openAddCustomerModal() {
  const barbers = dbGet(DB_KEYS.barbers);
  const select = document.getElementById('new-cust-barber');
  select.innerHTML = '<option value="">Auto-assign</option>';
  barbers.filter(b => b.status !== 'offline').forEach(b => {
    select.innerHTML += `<option value="${b.id}">${b.name} — ${b.chair}</option>`;
  });
  document.getElementById('new-cust-name').value = '';
  document.getElementById('new-cust-phone').value = '';
  document.getElementById('new-cust-notes').value = '';
  document.getElementById('new-cust-type').value = 'walkin';
  document.getElementById('returning-customer-info').classList.add('hidden');
  openModal('modal-add-customer');
}

function openVIPModal() {
  openAddCustomerModal();
  document.getElementById('new-cust-type').value = 'vip';
}

function detectReturningCustomer(phone) {
  if (phone.length < 6) {
    document.getElementById('returning-customer-info').classList.add('hidden');
    return;
  }
  const customers = dbGet(DB_KEYS.customers);
  const found = customers.find(c => c.phone === phone);
  const infoEl = document.getElementById('returning-customer-info');
  if (found) {
    document.getElementById('new-cust-name').value = found.name;
    document.getElementById('new-cust-type').value = 'returning';
    infoEl.innerHTML = `
      <div style="display:flex;gap:0.75rem;align-items:center">
        <span style="font-size:1.2rem">👋</span>
        <div>
          <strong style="color:#27ae60">Returning Customer — ${found.name}</strong>
          <div style="font-size:0.75rem;color:rgba(245,245,245,0.6);margin-top:2px">
            ${found.visits} visits &nbsp;•&nbsp; Lifetime: ₹${found.lifetimeSpend.toFixed(0)}
            &nbsp;•&nbsp; <span style="color:var(--gold)">${getMembershipLevel(found.lifetimeSpend)}</span>
          </div>
        </div>
      </div>`;
    infoEl.classList.remove('hidden');
  } else {
    infoEl.classList.add('hidden');
  }
}

function addCustomerToQueue() {
  const name = document.getElementById('new-cust-name').value.trim();
  const phone = document.getElementById('new-cust-phone').value.trim();
  const notes = document.getElementById('new-cust-notes').value.trim();
  const type = document.getElementById('new-cust-type').value;
  const prefBarber = document.getElementById('new-cust-barber').value;

  if (!name || !phone) return showToast('error', 'Name and phone are required');

  const token = generateToken();
  const entry = {
    id: Date.now(),
    token,
    name,
    phone,
    notes,
    type,
    status: 'waiting',
    arrivalTime: new Date().toISOString(),
    startTime: null,
    endTime: null,
    barberID: null,
    preferredBarber: prefBarber || null,
  };

  const queue = dbGet(DB_KEYS.queue);
  queue.push(entry);
  dbSet(DB_KEYS.queue, queue);

  closeModal('modal-add-customer');
  showToast('success', `Token ${token} generated for ${name}`);
  addNotification('🎫', 'New Token Generated', `${token} — ${name}`);
  updateBadges();

  // Auto-assign if barber available
  autoAssignCustomer(entry);

  if (state.currentPage === 'queue') renderQueue();
  if (state.currentPage === 'dashboard') renderDashboard();
}

// ========================================
// MODULE 4 — SMART AUTO ASSIGNMENT
// ========================================

function autoAssignCustomer(qEntry) {
  const barbers = dbGet(DB_KEYS.barbers);
  let available = barbers.filter(b => b.status === 'available');

  if (qEntry.preferredBarber) {
    const pref = available.find(b => String(b.id) === String(qEntry.preferredBarber));
    if (pref) return assignCustomerToBarber(qEntry, pref);
  }

  if (available.length === 0) return; // stays in queue

  // VIP gets first barber; otherwise round-robin
  const barber = available[0];
  assignCustomerToBarber(qEntry, barber);
}

function assignCustomerToBarber(qEntry, barber) {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);

  const qi = queue.findIndex(q => q.id === qEntry.id);
  if (qi !== -1) {
    queue[qi].status = 'active';
    queue[qi].barberID = barber.id;
    queue[qi].startTime = new Date().toISOString();
  }

  const bi = barbers.findIndex(b => b.id === barber.id);
  if (bi !== -1) {
    barbers[bi].status = 'busy';
    barbers[bi].currentCustomer = { id: qEntry.id, name: qEntry.name, token: qEntry.token, startTime: new Date().toISOString() };
  }

  dbSet(DB_KEYS.queue, queue);
  dbSet(DB_KEYS.barbers, barbers);

  showToast('info', `${qEntry.name} assigned to ${barber.name}`);
  addNotification('✂', 'Customer Assigned', `${qEntry.token} — ${qEntry.name} → ${barber.name} (${barber.chair})`);
  updateBadges();

  // Auto-notify if enabled
  const settings = dbGetObj(DB_KEYS.settings);
  if (settings.autoNotify) {
    // Small delay so the UI updates first
    setTimeout(() => openNotifyModal(qEntry.id), 400);
  }
}

function assignNextCustomerToBarber(barberId) {
  const queue = dbGet(DB_KEYS.queue);
  const next = queue.find(q => q.status === 'waiting' && (!q.preferredBarber || String(q.preferredBarber) === String(barberId)));
  if (next) {
    const barbers = dbGet(DB_KEYS.barbers);
    const barber = barbers.find(b => b.id === barberId);
    if (barber) autoAssignCustomer(next); // re-trigger; barber is now available
  }
}

// ========================================
// MODULE 3 — BARBER ENGINE
// ========================================

function openAddBarberModal() {
  ['barber-name','barber-chair','barber-spec'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('barber-exp').value = '';
  document.getElementById('barber-status').value = 'available';
  openModal('modal-add-barber');
}

function addBarber() {
  const name = document.getElementById('barber-name').value.trim();
  const chair = document.getElementById('barber-chair').value.trim();
  const exp = parseInt(document.getElementById('barber-exp').value) || 0;
  const status = document.getElementById('barber-status').value;
  const spec = document.getElementById('barber-spec').value.trim();

  if (!name || !chair) return showToast('error', 'Name and chair are required');

  const barber = {
    id: Date.now(),
    name, chair, experience: exp, specialization: spec || 'General',
    status,
    currentCustomer: null,
    revenue: 0,
    served: 0,
  };

  const barbers = dbGet(DB_KEYS.barbers);
  barbers.push(barber);
  dbSet(DB_KEYS.barbers, barbers);

  closeModal('modal-add-barber');
  showToast('success', `Barber ${name} added`);
  renderBarbers();
}

function barberAction(bid, action) {
  const barbers = dbGet(DB_KEYS.barbers);
  const bi = barbers.findIndex(b => b.id === bid);
  if (bi === -1) return;

  const barber = barbers[bi];

  if (action === 'complete') {
    // Open billing for current customer
    const customer = barber.currentCustomer;
    if (!customer) return showToast('error', 'No active customer');
    openBillingForCustomer(customer.id, bid);
    return;
  }
  if (action === 'break') {
    barbers[bi].status = 'break';
  }
  if (action === 'resume') {
    barbers[bi].status = 'available';
    dbSet(DB_KEYS.barbers, barbers);
    // Try assign next
    const saved = barbers[bi];
    dbSet(DB_KEYS.barbers, barbers);
    assignNextCustomerToBarber(bid);
    renderBarbers();
    return;
  }
  if (action === 'skip') {
    // Move current customer back to waiting
    const customer = barber.currentCustomer;
    if (customer) {
      const queue = dbGet(DB_KEYS.queue);
      const qi = queue.findIndex(q => q.id === customer.id);
      if (qi !== -1) { queue[qi].status = 'waiting'; queue[qi].barberID = null; }
      dbSet(DB_KEYS.queue, queue);
    }
    barbers[bi].status = 'available';
    barbers[bi].currentCustomer = null;
  }
  if (action === 'delete') {
    if (!confirm(`Remove barber ${barber.name}?`)) return;
    barbers.splice(bi, 1);
    dbSet(DB_KEYS.barbers, barbers);
    renderBarbers();
    return;
  }
  if (action === 'offline') {
    barbers[bi].status = 'offline';
    barbers[bi].currentCustomer = null;
  }

  dbSet(DB_KEYS.barbers, barbers);
  renderBarbers();
  updateBadges();
  if (state.currentPage === 'active') renderActiveCustomers();
}

function renderBarbers() {
  const barbers = dbGet(DB_KEYS.barbers);
  const grid = document.getElementById('barbers-grid');

  const counts = { available: 0, busy: 0, break: 0, offline: 0 };
  barbers.forEach(b => counts[b.status] = (counts[b.status] || 0) + 1);
  document.getElementById('b-available').textContent = counts.available || 0;
  document.getElementById('b-busy').textContent = counts.busy || 0;
  document.getElementById('b-break').textContent = counts.break || 0;
  document.getElementById('b-offline').textContent = counts.offline || 0;

  if (!barbers.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:rgba(245,245,245,0.3);">No barbers added. Click + Add Barber to get started.</div>`;
    return;
  }

  grid.innerHTML = barbers.map(b => {
    const initials = b.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    const hasCurrent = !!b.currentCustomer;
    const canComplete = b.status === 'busy' && hasCurrent;
    const canBreak = b.status === 'available';
    const canResume = b.status === 'break' || b.status === 'offline';
    const waitingMins = hasCurrent ? Math.floor((Date.now() - new Date(b.currentCustomer.startTime).getTime()) / 60000) : 0;

    return `<div class="barber-card status-${b.status}">
      <div class="bc-header">
        <div class="bc-avatar">${initials}</div>
        <div class="bc-title">
          <div class="bc-name">${escHtml(b.name)}</div>
          <div class="bc-chair">${escHtml(b.chair)} &nbsp;•&nbsp; ${b.experience}yr exp</div>
        </div>
        <span class="bc-status-badge ${b.status}">${capitalize(b.status)}</span>
      </div>
      <div class="bc-current">
        <div class="bc-current-label">Current Customer</div>
        ${hasCurrent
          ? `<div class="bc-current-customer">${escHtml(b.currentCustomer.token)} — ${escHtml(b.currentCustomer.name)} <span style="color:var(--gold);font-size:0.72rem">(${waitingMins}min)</span></div>`
          : `<div class="bc-current-idle">Available for service</div>`}
      </div>
      <div class="bc-stats">
        <div class="bc-stat"><div class="bc-stat-val">${b.served || 0}</div><div class="bc-stat-label">Served</div></div>
        <div class="bc-stat"><div class="bc-stat-val">₹${(b.revenue || 0).toFixed(0)}</div><div class="bc-stat-label">Revenue</div></div>
      </div>
      <div class="bc-spec">✦ ${escHtml(b.specialization)}</div>
      <div class="bc-actions">
        ${canComplete ? `<button class="complete-btn" onclick="barberAction(${b.id},'complete')">✓ Complete</button>` : ''}
        ${b.status !== 'offline' && !canResume ? `<button onclick="barberAction(${b.id},'skip')">⟳ Skip</button>` : ''}
        ${canBreak ? `<button onclick="barberAction(${b.id},'break')">⏸ Break</button>` : ''}
        ${canResume ? `<button onclick="barberAction(${b.id},'resume')">▶ Resume</button>` : ''}
        ${!hasCurrent ? `<button onclick="barberAction(${b.id},'offline')">${b.status==='offline'?'Online':'Offline'}</button>` : ''}
        <button class="delete-btn" onclick="barberAction(${b.id},'delete')">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ========================================
// MODULE 5 & 6 — ACTIVE CUSTOMERS
// ========================================

function renderActiveCustomers() {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const active = queue.filter(q => q.status === 'active');
  const grid = document.getElementById('active-grid');
  const empty = document.getElementById('active-empty');

  if (!active.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = active.map(q => {
    const barber = barbers.find(b => b.id === q.barberID);
    const startTime = new Date(q.startTime);
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 60000);
    const startStr = startTime.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});

    return `<div class="active-card">
      <div class="ac-token-row">
        <div class="ac-token">${escHtml(q.token)}</div>
        <div class="ac-status"><div class="status-dot"></div>Serving</div>
      </div>
      <div class="ac-name">${escHtml(q.name)}</div>
      <div class="ac-barber">Stylist: ${barber ? escHtml(barber.name) : 'N/A'}</div>
      <div class="ac-details">
        <div class="ac-detail"><span class="ac-detail-label">Chair</span><span class="ac-detail-value">${barber ? escHtml(barber.chair) : '—'}</span></div>
        <div class="ac-detail"><span class="ac-detail-label">Start Time</span><span class="ac-detail-value">${startStr}</span></div>
        <div class="ac-detail"><span class="ac-detail-label">Duration</span><span class="ac-detail-value">${elapsed} min</span></div>
        <div class="ac-detail"><span class="ac-detail-label">Phone</span><span class="ac-detail-value">${escHtml(q.phone)}</span></div>
      </div>
      <div class="ac-actions">
        <button class="btn-gold" onclick="openBillingForCustomer(${q.id}, ${barber ? barber.id : 'null'})">Complete & Bill</button>
        <button class="btn-outline" onclick="skipQueueEntry(${q.id})">Skip</button>
      </div>
    </div>`;
  }).join('');
}

function skipQueueEntry(qid) {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const qi = queue.findIndex(q => q.id === qid);
  if (qi === -1) return;

  const barberID = queue[qi].barberID;
  queue[qi].status = 'waiting';
  queue[qi].barberID = null;
  queue[qi].startTime = null;

  if (barberID) {
    const bi = barbers.findIndex(b => b.id === barberID);
    if (bi !== -1) { barbers[bi].status = 'available'; barbers[bi].currentCustomer = null; }
  }

  dbSet(DB_KEYS.queue, queue);
  dbSet(DB_KEYS.barbers, barbers);

  if (barberID) assignNextCustomerToBarber(barberID);

  renderActiveCustomers();
  updateBadges();
}

// ========================================
// MODULE 7 — BILLING SYSTEM
// ========================================

const SERVICES = [
  { name: 'Haircut', price: 200 },
  { name: 'Beard Trim', price: 100 },
  { name: 'Hair Wash', price: 150 },
  { name: 'Facial', price: 400 },
  { name: 'Massage', price: 350 },
  { name: 'Hair Color', price: 800 },
  { name: 'Smoothening', price: 1500 },
  { name: 'Keratin', price: 2000 },
  { name: 'Shaving', price: 80 },
  { name: 'Spa', price: 1200 },
  { name: 'Custom', price: 0 },
];

function openBillingForCustomer(queueId, barberId) {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const qEntry = queue.find(q => q.id === queueId);
  if (!qEntry) return showToast('error', 'Customer not found');

  const barber = barbers.find(b => b.id === (barberId || qEntry.barberID));

  state.activeBillCustomer = { queue: qEntry, barber };
  state.selectedPayment = null;

  // Detect membership
  const customers = dbGet(DB_KEYS.customers);
  const customer = customers.find(c => c.phone === qEntry.phone);
  const membership = customer ? getMembershipLevel(customer.lifetimeSpend) : null;
  const autoDisc = getMembershipDiscount(membership);

  // Reset bill form
  document.getElementById('bill-disc-pct').value = autoDisc;
  document.getElementById('bill-disc-flat').value = 0;
  document.getElementById('bill-tips').value = 0;
  document.getElementById('bill-coupon').value = '';
  document.getElementById('bill-gst').checked = dbGetObj(DB_KEYS.settings, {}).gstDefault || false;
  document.getElementById('split-payment-detail').classList.add('hidden');

  // Customer info
  const infoEl = document.getElementById('bill-customer-info');
  infoEl.innerHTML = `
    <div class="bci-item"><span class="bci-label">Token</span><span class="bci-value" style="color:var(--gold)">${escHtml(qEntry.token)}</span></div>
    <div class="bci-item"><span class="bci-label">Customer</span><span class="bci-value">${escHtml(qEntry.name)}</span></div>
    <div class="bci-item"><span class="bci-label">Phone</span><span class="bci-value">${escHtml(qEntry.phone)}</span></div>
    <div class="bci-item"><span class="bci-label">Barber</span><span class="bci-value">${barber ? escHtml(barber.name) : 'N/A'}</span></div>
    ${membership ? `<div class="bci-item"><span class="bci-label">Membership</span><span class="bci-value" style="color:var(--gold)">${membership}</span></div>` : ''}
  `;

  // Service lines
  document.getElementById('service-lines').innerHTML = '';
  addServiceLine();

  calcBillTotal();

  // Remove highlight from pay buttons
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));

  openModal('modal-billing');
}

function openNewBillModal() {
  const queue = dbGet(DB_KEYS.queue);
  const waiting = queue.filter(q => q.status === 'waiting' || q.status === 'active');
  if (!waiting.length) return showToast('info', 'No customers in queue');
  openBillingForCustomer(waiting[0].id, waiting[0].barberID);
}

function addServiceLine() {
  const container = document.getElementById('service-lines');
  const lineId = Date.now();
  const opts = SERVICES.map(s => `<option value="${s.name}" data-price="${s.price}">${s.name}</option>`).join('');
  const line = document.createElement('div');
  line.className = 'service-line';
  line.dataset.id = lineId;
  line.innerHTML = `
    <select class="svc-name" onchange="onServiceChange(this,${lineId})">${opts}</select>
    <input class="qty form-input" type="number" min="1" value="1" onchange="calcBillTotal()">
    <input class="price form-input" type="number" min="0" value="${SERVICES[0].price}" onchange="calcBillTotal()">
    <input class="custom-name form-input" type="text" placeholder="Custom name" style="display:none" onchange="calcBillTotal()">
    <span class="service-line-total">₹${SERVICES[0].price}</span>
    <button class="remove-service" onclick="removeServiceLine(${lineId})">✕</button>
  `;
  container.appendChild(line);
}

function onServiceChange(select, lineId) {
  const line = document.querySelector(`.service-line[data-id="${lineId}"]`);
  const opt = select.options[select.selectedIndex];
  const price = parseFloat(opt.dataset.price) || 0;
  const priceInput = line.querySelector('.price');
  const customInput = line.querySelector('.custom-name');
  priceInput.value = price;
  customInput.style.display = select.value === 'Custom' ? 'block' : 'none';
  calcBillTotal();
}

function removeServiceLine(lineId) {
  const line = document.querySelector(`.service-line[data-id="${lineId}"]`);
  if (line) line.remove();
  calcBillTotal();
}

function calcBillTotal() {
  let subtotal = 0;
  const lines = document.querySelectorAll('.service-line');
  lines.forEach(line => {
    const qty = parseFloat(line.querySelector('.qty')?.value || 1) || 1;
    const price = parseFloat(line.querySelector('.price')?.value || 0) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    const totalEl = line.querySelector('.service-line-total');
    if (totalEl) totalEl.textContent = '₹' + lineTotal.toFixed(0);
  });

  const discPct = parseFloat(document.getElementById('bill-disc-pct')?.value || 0) || 0;
  const discFlat = parseFloat(document.getElementById('bill-disc-flat')?.value || 0) || 0;
  const tips = parseFloat(document.getElementById('bill-tips')?.value || 0) || 0;
  const gst = document.getElementById('bill-gst')?.checked;

  let discount = (subtotal * discPct / 100) + discFlat;
  discount = Math.min(discount, subtotal);
  let afterDisc = subtotal - discount;
  let gstAmt = gst ? afterDisc * 0.18 : 0;
  let total = afterDisc + gstAmt + tips;

  // Coupon code check
  const settings = dbGetObj(DB_KEYS.settings);
  document.getElementById('bill-subtotal').textContent = '₹' + subtotal.toFixed(2);
  document.getElementById('bill-discount-show').textContent = '-₹' + discount.toFixed(2);
  document.getElementById('gst-row').style.display = gst ? 'flex' : 'none';
  document.getElementById('bill-gst-show').textContent = '₹' + gstAmt.toFixed(2);
  document.getElementById('bill-tips-show').textContent = '₹' + tips.toFixed(2);
  document.getElementById('bill-total').textContent = '₹' + total.toFixed(2);
}

function applyCoupon() {
  const code = document.getElementById('bill-coupon').value.trim().toUpperCase();
  const coupons = dbGet(DB_KEYS.coupons, [
    { code: 'SALEEM10', discount: 10, type: 'pct' },
    { code: 'SALEEM50', discount: 50, type: 'flat' },
  ]);
  const coupon = coupons.find(c => c.code === code);
  if (!coupon) return showToast('error', 'Invalid coupon code');
  if (coupon.type === 'pct') {
    document.getElementById('bill-disc-pct').value = coupon.discount;
  } else {
    document.getElementById('bill-disc-flat').value = coupon.discount;
  }
  calcBillTotal();
  showToast('success', `Coupon applied: ${coupon.discount}${coupon.type === 'pct' ? '%' : '₹'} off`);
}

function selectPayment(mode) {
  state.selectedPayment = mode;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  event.target.classList.add('selected');
  document.getElementById('split-payment-detail').classList.toggle('hidden', mode !== 'split');
}

function completePayment() {
  if (!state.selectedPayment) return showToast('error', 'Please select a payment method');
  if (!state.activeBillCustomer) return showToast('error', 'No active customer');

  const lines = document.querySelectorAll('.service-line');
  const services = [];
  lines.forEach(line => {
    const nameEl = line.querySelector('.svc-name');
    const qtyEl = line.querySelector('.qty');
    const priceEl = line.querySelector('.price');
    const customEl = line.querySelector('.custom-name');
    let name = nameEl?.value || '';
    if (name === 'Custom' && customEl) name = customEl.value || 'Custom';
    const qty = parseInt(qtyEl?.value || 1);
    const price = parseFloat(priceEl?.value || 0);
    services.push({ name, qty, price });
  });

  const subtotal = services.reduce((s, svc) => s + svc.qty * svc.price, 0);
  const discPct = parseFloat(document.getElementById('bill-disc-pct').value || 0) || 0;
  const discFlat = parseFloat(document.getElementById('bill-disc-flat').value || 0) || 0;
  const tips = parseFloat(document.getElementById('bill-tips').value || 0) || 0;
  const gstOn = document.getElementById('bill-gst').checked;
  const discount = Math.min((subtotal * discPct / 100) + discFlat, subtotal);
  const afterDisc = subtotal - discount;
  const gstAmt = gstOn ? afterDisc * 0.18 : 0;
  const total = afterDisc + gstAmt + tips;

  const { queue: qEntry, barber } = state.activeBillCustomer;
  const invoiceNo = generateInvoiceNo();
  const now = new Date();

  // Update queue entry
  const queue = dbGet(DB_KEYS.queue);
  const qi = queue.findIndex(q => q.id === qEntry.id);
  if (qi !== -1) {
    queue[qi].status = 'completed';
    queue[qi].endTime = now.toISOString();
    queue[qi].invoiceNo = invoiceNo;
    queue[qi].total = total;
  }
  dbSet(DB_KEYS.queue, queue);

  // Update barber
  if (barber) {
    const barbers = dbGet(DB_KEYS.barbers);
    const bi = barbers.findIndex(b => b.id === barber.id);
    if (bi !== -1) {
      barbers[bi].status = 'available';
      barbers[bi].currentCustomer = null;
      barbers[bi].revenue = (barbers[bi].revenue || 0) + total;
      barbers[bi].served = (barbers[bi].served || 0) + 1;
    }
    dbSet(DB_KEYS.barbers, barbers);
    // Assign next customer to this barber
    setTimeout(() => assignNextCustomerToBarber(barber.id), 100);
  }

  // Save invoice
  const invoice = {
    id: Date.now(),
    invoiceNo,
    token: qEntry.token,
    customerId: qEntry.id,
    customerName: qEntry.name,
    phone: qEntry.phone,
    barberName: barber ? barber.name : 'N/A',
    services,
    subtotal, discount, gstAmt, tips, total,
    paymentMode: state.selectedPayment,
    createdAt: now.toISOString(),
  };
  const invoices = dbGet(DB_KEYS.invoices);
  invoices.push(invoice);
  dbSet(DB_KEYS.invoices, invoices);

  // Update CRM
  updateCustomerCRM(qEntry, total, services, barber);

  // Save receipt data
  const customers = dbGet(DB_KEYS.customers);
  const cust = customers.find(c => c.phone === qEntry.phone);
  localStorage.setItem('saleem_current_receipt', JSON.stringify({
    customerName: qEntry.name,
    phone: qEntry.phone,
    token: qEntry.token,
    barberName: barber ? barber.name : 'N/A',
    invoiceNo,
    services,
    discount, gst: gstAmt, tips, total,
    paymentMode: state.selectedPayment,
    membership: cust ? getMembershipLevel(cust.lifetimeSpend) : null,
  }));

  closeModal('modal-billing');
  state.activeBillCustomer = null;

  showToast('success', `Payment of ₹${total.toFixed(2)} received!`);
  addNotification('💰', 'Payment Success', `${invoiceNo} — ${qEntry.name} — ₹${total.toFixed(2)}`);
  updateBadges();

  if (state.currentPage === 'billing') renderInvoices();
  if (state.currentPage === 'dashboard') renderDashboard();
  if (state.currentPage === 'active') renderActiveCustomers();
  if (state.currentPage === 'barbers') renderBarbers();
}

function printReceipt() {
  // Save current receipt data first
  if (!state.activeBillCustomer) return;
  const { queue: qEntry, barber } = state.activeBillCustomer;
  const lines = document.querySelectorAll('.service-line');
  const services = [];
  lines.forEach(line => {
    const nameEl = line.querySelector('.svc-name');
    const customEl = line.querySelector('.custom-name');
    const qtyEl = line.querySelector('.qty');
    const priceEl = line.querySelector('.price');
    let name = nameEl?.value || '';
    if (name === 'Custom' && customEl) name = customEl.value || 'Custom';
    services.push({ name, qty: parseInt(qtyEl?.value||1), price: parseFloat(priceEl?.value||0) });
  });
  const subtotal = services.reduce((s, svc) => s + svc.qty * svc.price, 0);
  const discPct = parseFloat(document.getElementById('bill-disc-pct').value || 0) || 0;
  const discFlat = parseFloat(document.getElementById('bill-disc-flat').value || 0) || 0;
  const tips = parseFloat(document.getElementById('bill-tips').value || 0) || 0;
  const gstOn = document.getElementById('bill-gst').checked;
  const discount = Math.min((subtotal * discPct / 100) + discFlat, subtotal);
  const gstAmt = gstOn ? (subtotal - discount) * 0.18 : 0;
  const total = subtotal - discount + gstAmt + tips;
  localStorage.setItem('saleem_current_receipt', JSON.stringify({
    customerName: qEntry.name, phone: qEntry.phone, token: qEntry.token,
    barberName: barber ? barber.name : 'N/A',
    invoiceNo: 'PREVIEW', services, discount, gst: gstAmt, tips, total,
    paymentMode: state.selectedPayment || 'Pending',
  }));
  window.open('receipt.html', '_blank');
}

function renderInvoices() {
  const invoices = dbGet(DB_KEYS.invoices).slice(-20).reverse();
  const el = document.getElementById('recent-invoices');
  if (!invoices.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(245,245,245,0.3);">No invoices yet</div>';
    return;
  }
  el.innerHTML = invoices.map(inv => `
    <div class="invoice-item">
      <div class="inv-no">${escHtml(inv.invoiceNo)}</div>
      <div class="inv-info">
        <div class="inv-customer">${escHtml(inv.customerName)}</div>
        <div class="inv-meta">${escHtml(inv.token)} &nbsp;•&nbsp; ${escHtml(inv.barberName)} &nbsp;•&nbsp; ${formatDateTime(inv.createdAt)}</div>
      </div>
      <div class="inv-amount">₹${inv.total.toFixed(2)}</div>
      <div class="inv-actions">
        <span class="badge" style="background:rgba(39,174,96,0.15);color:var(--green)">${capitalize(inv.paymentMode)}</span>
        <button class="btn-sm" onclick="viewReceipt('${inv.invoiceNo}')">🖨</button>
      </div>
    </div>
  `).join('');
}

function viewReceipt(invoiceNo) {
  const invoices = dbGet(DB_KEYS.invoices);
  const inv = invoices.find(i => i.invoiceNo === invoiceNo);
  if (!inv) return;
  localStorage.setItem('saleem_current_receipt', JSON.stringify({
    customerName: inv.customerName, phone: inv.phone, token: inv.token,
    barberName: inv.barberName, invoiceNo: inv.invoiceNo,
    services: inv.services, discount: inv.discount,
    gst: inv.gstAmt, tips: inv.tips, total: inv.total,
    paymentMode: inv.paymentMode,
  }));
  window.open('receipt.html', '_blank');
}

// ========================================
// MODULE 9 & 10 — CRM & MEMBERSHIP
// ========================================

function getMembershipLevel(spend) {
  if (spend >= 20000) return 'VIP';
  if (spend >= 10000) return 'Platinum';
  if (spend >= 5000) return 'Gold';
  if (spend >= 1000) return 'Silver';
  return null;
}

function getMembershipDiscount(level) {
  return { 'VIP': 15, 'Platinum': 10, 'Gold': 5, 'Silver': 2 }[level] || 0;
}

function updateCustomerCRM(qEntry, total, services, barber) {
  const customers = dbGet(DB_KEYS.customers);
  const idx = customers.findIndex(c => c.phone === qEntry.phone);
  const now = new Date().toISOString();
  const serviceNames = services.map(s => s.name).join(', ');

  if (idx !== -1) {
    customers[idx].visits++;
    customers[idx].lifetimeSpend += total;
    customers[idx].lastVisit = now;
    if (barber) customers[idx].favoriteBarber = barber.name;
    customers[idx].history = customers[idx].history || [];
    customers[idx].history.push({ date: now, services: serviceNames, amount: total, barber: barber?.name, invoiceNo: qEntry.invoiceNo });
  } else {
    customers.push({
      id: Date.now(),
      name: qEntry.name,
      phone: qEntry.phone,
      visits: 1,
      lifetimeSpend: total,
      firstVisit: now,
      lastVisit: now,
      favoriteBarber: barber ? barber.name : '',
      favoriteServices: serviceNames,
      history: [{ date: now, services: serviceNames, amount: total, barber: barber?.name }],
    });
  }
  dbSet(DB_KEYS.customers, customers);
}

function renderCRM() {
  filterCRM();
  const customers = dbGet(DB_KEYS.customers);
  const lifetimeTotal = customers.reduce((s, c) => s + c.lifetimeSpend, 0);
  const vips = customers.filter(c => getMembershipLevel(c.lifetimeSpend) === 'VIP' || getMembershipLevel(c.lifetimeSpend) === 'Platinum').length;
  document.getElementById('crm-total-c').textContent = customers.length;
  document.getElementById('crm-vip-c').textContent = vips;
  document.getElementById('crm-lifetime').textContent = '₹' + lifetimeTotal.toFixed(0);
}

function filterCRM(search) {
  const q = (search || document.getElementById('crm-search')?.value || '').toLowerCase();
  const customers = dbGet(DB_KEYS.customers);
  const filtered = q ? customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : customers;
  const tbody = document.getElementById('crm-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:rgba(245,245,245,0.3);">No customers found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const membership = getMembershipLevel(c.lifetimeSpend);
    const badge = membership ? `<span class="badge badge-${membership.toLowerCase() === 'gold' ? 'gold2' : membership.toLowerCase()}">${membership}</span>` : '—';
    return `<tr>
      <td><span class="font-bold">${escHtml(c.name)}</span></td>
      <td>${escHtml(c.phone)}</td>
      <td>${c.visits}</td>
      <td style="color:var(--gold)">₹${c.lifetimeSpend.toFixed(0)}</td>
      <td>${c.lastVisit ? formatDate(c.lastVisit) : '—'}</td>
      <td>${badge}</td>
      <td>${c.favoriteBarber ? escHtml(c.favoriteBarber) : '—'}</td>
      <td><button class="btn-sm" onclick="viewCustomerDetail('${c.phone}')">View</button></td>
    </tr>`;
  }).join('');
}

function viewCustomerDetail(phone) {
  const customers = dbGet(DB_KEYS.customers);
  const c = customers.find(cu => cu.phone === phone);
  if (!c) return;
  const membership = getMembershipLevel(c.lifetimeSpend);

  const body = document.getElementById('customer-detail-body');
  const history = (c.history || []).slice(-10).reverse();

  body.innerHTML = `
    <div class="customer-profile">
      <div class="cp-header">
        <div class="cp-avatar">${c.name[0].toUpperCase()}</div>
        <div>
          <div class="cp-name">${escHtml(c.name)}</div>
          <div class="cp-phone">${escHtml(c.phone)}</div>
          ${membership ? `<span class="badge badge-${membership.toLowerCase() === 'gold' ? 'gold2' : membership.toLowerCase()}" style="margin-top:6px;display:inline-block">${membership} Member</span>` : ''}
        </div>
      </div>
      <div class="cp-stats">
        <div class="cp-stat"><div class="cp-stat-val">${c.visits}</div><div class="cp-stat-label">Total Visits</div></div>
        <div class="cp-stat"><div class="cp-stat-val">₹${c.lifetimeSpend.toFixed(0)}</div><div class="cp-stat-label">Lifetime Spend</div></div>
        <div class="cp-stat"><div class="cp-stat-val">₹${c.visits ? (c.lifetimeSpend / c.visits).toFixed(0) : 0}</div><div class="cp-stat-label">Avg per Visit</div></div>
      </div>
      <div class="cp-history">
        <h3>Visit History</h3>
        ${history.length ? history.map(h => `
          <div class="cp-history-item">
            <span class="cp-history-date">${formatDate(h.date)}</span>
            <span class="cp-history-services">${escHtml(h.services)}</span>
            <span class="cp-history-amount">₹${h.amount.toFixed(0)}</span>
          </div>
        `).join('') : '<p style="color:rgba(245,245,245,0.4);font-size:0.85rem">No history yet</p>'}
      </div>
    </div>`;
  openModal('modal-customer-detail');
}

// ========================================
// MODULE 11 — APPOINTMENTS
// ========================================

function openAppointmentModal() {
  ['appt-name','appt-phone','appt-services','appt-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('appt-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('appt-time').value = '10:00';

  const barbers = dbGet(DB_KEYS.barbers);
  const sel = document.getElementById('appt-barber');
  sel.innerHTML = '<option value="">Any Barber</option>' +
    barbers.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');

  openModal('modal-appointment');
}

function bookAppointment() {
  const name = document.getElementById('appt-name').value.trim();
  const phone = document.getElementById('appt-phone').value.trim();
  const date = document.getElementById('appt-date').value;
  const time = document.getElementById('appt-time').value;

  if (!name || !phone || !date || !time) return showToast('error', 'Name, phone, date and time are required');

  const barberID = document.getElementById('appt-barber').value;
  const barbers = dbGet(DB_KEYS.barbers);
  const barber = barbers.find(b => String(b.id) === barberID);

  const appt = {
    id: Date.now(),
    name, phone, date, time,
    barberID, barberName: barber ? barber.name : 'Any',
    services: document.getElementById('appt-services').value,
    notes: document.getElementById('appt-notes').value,
    status: 'upcoming',
    createdAt: new Date().toISOString(),
  };

  const appts = dbGet(DB_KEYS.appointments);
  appts.push(appt);
  dbSet(DB_KEYS.appointments, appts);
  closeModal('modal-appointment');
  showToast('success', `Appointment booked for ${name} on ${date} at ${time}`);
  renderAppointments();
}

function renderAppointments() {
  const appts = dbGet(DB_KEYS.appointments);
  const today = new Date().toISOString().split('T')[0];
  let filtered = appts;

  if (state.apptFilter === 'today') filtered = appts.filter(a => a.date === today);
  else if (state.apptFilter === 'upcoming') filtered = appts.filter(a => a.date >= today);

  filtered = filtered.sort((a, b) => `${a.date}T${a.time}` > `${b.date}T${b.time}` ? 1 : -1);
  const el = document.getElementById('appointments-list');

  if (!filtered.length) {
    el.innerHTML = '<div style="text-align:center;padding:3rem;color:rgba(245,245,245,0.3);">No appointments found</div>';
    return;
  }

  el.innerHTML = filtered.map(a => `
    <div class="appt-card">
      <div class="appt-time-box">
        <div class="appt-time">${a.time}</div>
        <div class="appt-date">${formatDate(a.date)}</div>
      </div>
      <div class="appt-info">
        <div class="appt-name">${escHtml(a.name)}</div>
        <div class="appt-meta">
          <span>📞 ${escHtml(a.phone)}</span>
          <span>✂ ${escHtml(a.barberName)}</span>
          ${a.services ? `<span>🔧 ${escHtml(a.services)}</span>` : ''}
        </div>
      </div>
      <div class="appt-actions">
        <button class="btn-sm" onclick="convertApptToWalkin(${a.id})">Convert to Walk-in</button>
        <button class="btn-sm" onclick="cancelAppt(${a.id})" style="color:var(--red)">Cancel</button>
      </div>
    </div>
  `).join('');
}

function filterAppts(filter) {
  state.apptFilter = filter;
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['today','upcoming','all'][i] === filter);
  });
  renderAppointments();
}

function convertApptToWalkin(apptId) {
  const appts = dbGet(DB_KEYS.appointments);
  const appt = appts.find(a => a.id === apptId);
  if (!appt) return;

  const token = generateToken();
  const entry = {
    id: Date.now(),
    token,
    name: appt.name,
    phone: appt.phone,
    notes: `Appointment: ${appt.services || ''}`,
    type: 'returning',
    status: 'waiting',
    arrivalTime: new Date().toISOString(),
    startTime: null, endTime: null,
    barberID: null,
    preferredBarber: appt.barberID || null,
  };

  const queue = dbGet(DB_KEYS.queue);
  queue.push(entry);
  dbSet(DB_KEYS.queue, queue);

  // Mark appointment done
  const ai = appts.findIndex(a => a.id === apptId);
  appts[ai].status = 'completed';
  dbSet(DB_KEYS.appointments, appts);

  autoAssignCustomer(entry);
  showToast('success', `${appt.name} added to queue as ${token}`);
  renderAppointments();
  updateBadges();
}

function cancelAppt(apptId) {
  if (!confirm('Cancel this appointment?')) return;
  const appts = dbGet(DB_KEYS.appointments);
  const ai = appts.findIndex(a => a.id === apptId);
  if (ai !== -1) { appts[ai].status = 'cancelled'; }
  dbSet(DB_KEYS.appointments, appts);
  renderAppointments();
  showToast('info', 'Appointment cancelled');
}

// ========================================
// MODULE 12 — DASHBOARD
// ========================================

function renderDashboard() {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const invoices = dbGet(DB_KEYS.invoices);
  const today = new Date().toISOString().split('T')[0];

  const todayInvoices = invoices.filter(inv => inv.createdAt.startsWith(today));
  const todayRevenue = todayInvoices.reduce((s, inv) => s + inv.total, 0);

  const todayQueue = queue.filter(q => q.arrivalTime && q.arrivalTime.startsWith(today));
  const waiting = queue.filter(q => q.status === 'waiting').length;
  const active = queue.filter(q => q.status === 'active').length;
  const completed = todayQueue.filter(q => q.status === 'completed').length;
  const available = barbers.filter(b => b.status === 'available').length;

  const topBarber = barbers.reduce((top, b) => (!top || b.revenue > top.revenue) ? b : top, null);

  const completedToday = todayQueue.filter(q => q.status === 'completed' && q.startTime && q.endTime);
  const avgTime = completedToday.length
    ? Math.round(completedToday.reduce((s, q) =>
        s + (new Date(q.endTime) - new Date(q.startTime)) / 60000, 0) / completedToday.length)
    : null;

  document.getElementById('dash-revenue').textContent = '₹' + todayRevenue.toFixed(0);
  document.getElementById('dash-customers').textContent = todayQueue.length;
  document.getElementById('dash-waiting').textContent = waiting;
  document.getElementById('dash-active').textContent = active;
  document.getElementById('dash-completed').textContent = completed;
  document.getElementById('dash-available').textContent = available;
  document.getElementById('dash-top-barber').textContent = topBarber ? topBarber.name : '—';
  document.getElementById('dash-avg-time').textContent = avgTime !== null ? avgTime + ' min' : '—';

  // Active mini list
  const activeQueue = queue.filter(q => q.status === 'active');
  const dashList = document.getElementById('dash-active-list');
  if (!activeQueue.length) {
    dashList.innerHTML = '<div style="text-align:center;padding:1.5rem;color:rgba(245,245,245,0.3);font-size:0.85rem">No active customers</div>';
  } else {
    dashList.innerHTML = activeQueue.map(q => {
      const barber = barbers.find(b => b.id === q.barberID);
      return `<div class="active-mini-item">
        <div class="ami-token">${escHtml(q.token)}</div>
        <div class="ami-name">${escHtml(q.name)}</div>
        <div class="ami-barber">${barber ? escHtml(barber.name) : 'N/A'}</div>
        <div class="ami-chair">${barber ? escHtml(barber.chair) : '—'}</div>
      </div>`;
    }).join('');
  }

  // Top services
  const svcCount = {};
  todayInvoices.forEach(inv => {
    inv.services.forEach(s => { svcCount[s.name] = (svcCount[s.name] || 0) + 1; });
  });
  const topSvcs = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxSvc = topSvcs[0]?.[1] || 1;
  const svcEl = document.getElementById('top-services-list');
  svcEl.innerHTML = topSvcs.length ? topSvcs.map(([name, count], i) => `
    <div class="top-list-item">
      <span class="top-list-rank">${i+1}</span>
      <span class="top-list-name">${escHtml(name)}</span>
      <div class="top-list-bar"><div class="top-list-bar-fill" style="width:${(count/maxSvc*100)}%"></div></div>
      <span class="top-list-val">${count}x</span>
    </div>`) .join('')
    : '<div style="text-align:center;padding:1rem;color:rgba(245,245,245,0.3);">No data yet</div>';

  // Weekly chart
  drawWeeklyChart(invoices);
}

function drawWeeklyChart(invoices) {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.offsetWidth || 400;
  canvas.height = 180;

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const data = days.map(day => {
    return invoices.filter(inv => inv.createdAt.startsWith(day)).reduce((s, inv) => s + inv.total, 0);
  });

  const max = Math.max(...data, 1);
  const W = canvas.width, H = canvas.height;
  const padL = 40, padR = 15, padT = 15, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(245,245,245,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }

  // Bars
  const barW = Math.min(40, chartW / days.length - 8);
  data.forEach((val, i) => {
    const x = padL + (i / (days.length - 1)) * chartW;
    const barH = (val / max) * chartH;
    const y = padT + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#d4af37');
    grad.addColorStop(1, 'rgba(212,175,55,0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - barW/2, y, barW, barH, 4) : ctx.rect(x - barW/2, y, barW, barH);
    ctx.fill();

    // Day label
    const day = new Date(days[i]).toLocaleDateString('en-IN', { weekday: 'short' });
    ctx.fillStyle = 'rgba(245,245,245,0.5)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(day, x, H - 8);
  });
}

// ========================================
// MODULE 2 — QUEUE RENDERING
// ========================================

function renderQueue() {
  filterQueue();
  updateQueueStats();
}

function updateQueueStats() {
  const queue = dbGet(DB_KEYS.queue);
  const today = new Date().toISOString().split('T')[0];
  const todayQ = queue.filter(q => q.arrivalTime && q.arrivalTime.startsWith(today));
  document.getElementById('q-total').textContent = todayQ.length;
  document.getElementById('q-waiting').textContent = todayQ.filter(q => q.status === 'waiting').length;
  document.getElementById('q-active').textContent = todayQ.filter(q => q.status === 'active').length;
  document.getElementById('q-completed').textContent = todayQ.filter(q => q.status === 'completed').length;
}

function filterQueue() {
  const search = (document.getElementById('queue-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('queue-filter-status')?.value || 'all';
  const typeF = document.getElementById('queue-filter-type')?.value || 'all';
  const barbers = dbGet(DB_KEYS.barbers);

  let queue = dbGet(DB_KEYS.queue);
  const today = new Date().toISOString().split('T')[0];
  queue = queue.filter(q => q.arrivalTime && q.arrivalTime.startsWith(today));
  queue = queue.filter(q => {
    if (statusF !== 'all' && q.status !== statusF) return false;
    if (typeF !== 'all' && q.type !== typeF) return false;
    if (search && !q.name.toLowerCase().includes(search) && !q.token.toLowerCase().includes(search) && !q.phone.includes(search)) return false;
    return true;
  });
  // Sort: waiting first, then active, then completed
  queue.sort((a, b) => {
    const order = { waiting: 0, active: 1, completed: 2 };
    return (order[a.status] || 0) - (order[b.status] || 0);
  });

  const list = document.getElementById('queue-list');
  if (!queue.length) {
    list.innerHTML = '<div style="text-align:center;padding:3rem;color:rgba(245,245,245,0.3);grid-column:1/-1">No customers in queue</div>';
    return;
  }

  const notifyLog = dbGet(DB_KEYS.notifyLog);

  list.innerHTML = queue.map(q => {
    const barber = barbers.find(b => b.id === q.barberID);
    const arrTime = new Date(q.arrivalTime).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});
    const waitMins = Math.floor((Date.now() - new Date(q.arrivalTime)) / 60000);
    const isActive = q.status === 'active';
    const isWaiting = q.status === 'waiting';
    const isCompleted = q.status === 'completed';
    const wasNotified = notifyLog.some(n => n.queueId === q.id);

    return `<div class="queue-card status-${q.status} type-${q.type}">
      <div class="qc-token">${escHtml(q.token)}</div>
      <div class="qc-info">
        <div class="qc-name">${escHtml(q.name)} ${q.type === 'vip' ? '<span class="badge badge-vip">VIP</span>' : ''} ${q.type === 'returning' ? '<span class="badge badge-returning">Returning</span>' : ''}</div>
        <div class="qc-meta">
          <span>📞 ${escHtml(q.phone)}</span>
          <span>🕐 ${arrTime} (${waitMins}min ago)</span>
          ${isActive && barber ? `<span>✂ ${escHtml(barber.name)} — ${escHtml(barber.chair)}</span>` : ''}
          ${q.notes ? `<span>📝 ${escHtml(q.notes)}</span>` : ''}
          ${wasNotified ? `<span class="notified-pill">📲 Notified</span>` : ''}
        </div>
      </div>
      <div class="qc-badges">
        <span class="badge badge-${q.status}">${capitalize(q.status)}</span>
      </div>
      <div class="qc-actions">
        ${isWaiting ? `<button onclick="autoAssignCustomer(${JSON.stringify(q).replace(/"/g,'&quot;')})">Assign</button>` : ''}
        ${isActive ? `<button class="bill-btn" onclick="openBillingForCustomer(${q.id}, ${barber ? barber.id : 'null'})">Bill</button>` : ''}
        ${isActive ? `<button class="notify-queue-btn" onclick="openNotifyModal(${q.id})" title="Send WhatsApp/SMS">📲</button>` : ''}
        ${isCompleted && q.invoiceNo ? `<button onclick="viewReceipt('${q.invoiceNo}')">🖨 Receipt</button>` : ''}
        ${!isCompleted ? `<button class="cancel-btn" onclick="removeFromQueue(${q.id})">Remove</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function removeFromQueue(qid) {
  if (!confirm('Remove this customer from queue?')) return;
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const qi = queue.findIndex(q => q.id === qid);
  if (qi === -1) return;
  const q = queue[qi];
  if (q.barberID) {
    const bi = barbers.findIndex(b => b.id === q.barberID);
    if (bi !== -1) { barbers[bi].status = 'available'; barbers[bi].currentCustomer = null; }
    dbSet(DB_KEYS.barbers, barbers);
  }
  queue.splice(qi, 1);
  dbSet(DB_KEYS.queue, queue);
  renderQueue();
  updateBadges();
}

// ========================================
// MODULE 13 — ANALYTICS
// ========================================

function renderAnalytics() {
  const invoices = dbGet(DB_KEYS.invoices);
  const barbers = dbGet(DB_KEYS.barbers);
  const period = document.getElementById('analytics-period')?.value || 'weekly';

  // Revenue chart
  drawRevenueChart(invoices, period);
  drawCustomerChart(invoices, period);

  // Service popularity
  const svcCount = {};
  invoices.forEach(inv => inv.services.forEach(s => { svcCount[s.name] = (svcCount[s.name] || 0) + 1; }));
  const topSvcs = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSvc = topSvcs[0]?.[1] || 1;
  const svcEl = document.getElementById('service-popularity-list');
  svcEl.innerHTML = topSvcs.length ? topSvcs.map(([name, count], i) => `
    <div class="top-list-item">
      <span class="top-list-rank">${i+1}</span>
      <span class="top-list-name">${escHtml(name)}</span>
      <div class="top-list-bar"><div class="top-list-bar-fill" style="width:${(count/maxSvc*100)}%"></div></div>
      <span class="top-list-val">${count}</span>
    </div>`).join('')
    : '<div style="text-align:center;padding:2rem;color:rgba(245,245,245,0.3);">No data yet</div>';

  // Barber leaderboard
  const sortedBarbers = [...barbers].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const leaderEl = document.getElementById('barber-leaderboard');
  const rankSymbols = ['🥇', '🥈', '🥉'];
  leaderEl.innerHTML = sortedBarbers.length ? sortedBarbers.map((b, i) => `
    <div class="leader-item">
      <div class="leader-rank ${i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : ''}">${rankSymbols[i] || (i+1)}</div>
      <div class="leader-info">
        <div class="leader-name">${escHtml(b.name)} — ${escHtml(b.chair)}</div>
        <div class="leader-served">${b.served || 0} customers served</div>
      </div>
      <div class="leader-revenue">₹${(b.revenue || 0).toFixed(0)}</div>
    </div>`).join('')
    : '<div style="text-align:center;padding:2rem;color:rgba(245,245,245,0.3);">No barbers yet</div>';
}

function drawRevenueChart(invoices, period) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement?.offsetWidth || 800;
  canvas.height = 280;

  let labels = [], data = [];
  const now = new Date();

  if (period === 'daily') {
    for (let i = 23; i >= 0; i--) {
      const h = (now.getHours() - i + 24) % 24;
      labels.push(h + ':00');
      data.push(invoices.filter(inv => {
        const d = new Date(inv.createdAt);
        return d.toDateString() === now.toDateString() && d.getHours() === h;
      }).reduce((s, inv) => s + inv.total, 0));
    }
  } else if (period === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' }));
      data.push(invoices.filter(inv => inv.createdAt.startsWith(d.toISOString().split('T')[0])).reduce((s, inv) => s + inv.total, 0));
    }
  } else if (period === 'monthly') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.getDate());
      data.push(invoices.filter(inv => inv.createdAt.startsWith(d.toISOString().split('T')[0])).reduce((s, inv) => s + inv.total, 0));
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('en-IN', { month: 'short' }));
      data.push(invoices.filter(inv => {
        const di = new Date(inv.createdAt);
        return di.getFullYear() === d.getFullYear() && di.getMonth() === d.getMonth();
      }).reduce((s, inv) => s + inv.total, 0));
    }
  }

  const max = Math.max(...data, 1);
  const W = canvas.width, H = canvas.height;
  const padL = 50, padR = 15, padT = 20, padB = 40;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(245,245,245,0.05)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = 'rgba(245,245,245,0.3)';
    ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText('₹' + Math.round(max * (4 - i) / 4), padL - 5, y + 4);
  }

  // Area fill
  const points = data.map((val, i) => ({ x: padL + (i / (data.length - 1)) * chartW, y: padT + chartH - (val / max) * chartH }));
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(212,175,55,0.3)');
  grad.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.beginPath();
  ctx.moveTo(points[0].x, padT + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padT + chartH);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2.5;
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Dots
  points.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37'; ctx.fill();
    ctx.strokeStyle = '#0f0f0f'; ctx.lineWidth = 2; ctx.stroke();
  });

  // Labels
  ctx.fillStyle = 'rgba(245,245,245,0.4)'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
  const step = Math.ceil(labels.length / 10);
  labels.forEach((l, i) => {
    if (i % step === 0) ctx.fillText(l, padL + (i / (labels.length - 1)) * chartW, H - 8);
  });
}

function drawCustomerChart(invoices, period) {
  const canvas = document.getElementById('customer-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement?.offsetWidth || 400;
  canvas.height = 220;

  let labels = [], data = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
    data.push(invoices.filter(inv => inv.createdAt.startsWith(d.toISOString().split('T')[0])).length);
  }

  const max = Math.max(...data, 1);
  const W = canvas.width, H = canvas.height;
  const padL = 30, padR = 10, padT = 15, padB = 25;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);
  const barW = Math.min(30, chartW / data.length - 6);
  data.forEach((val, i) => {
    const x = padL + ((i + 0.5) / data.length) * chartW;
    const barH = (val / max) * chartH;
    const y = padT + chartH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
    grad.addColorStop(0, 'rgba(39,174,96,0.8)');
    grad.addColorStop(1, 'rgba(39,174,96,0.1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - barW/2, y, barW, barH, 4) : ctx.rect(x - barW/2, y, barW, barH);
    ctx.fill();
    ctx.fillStyle = 'rgba(245,245,245,0.4)'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
    ctx.fillText(labels[i], x, H - 5);
  });
}

// ========================================
// MODULE 15 — INVENTORY
// ========================================

function openAddInventoryModal() {
  ['inv-name'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('inv-stock').value = 0;
  document.getElementById('inv-min').value = 5;
  openModal('modal-inventory');
}

function addInventoryItem() {
  const name = document.getElementById('inv-name').value.trim();
  if (!name) return showToast('error', 'Product name is required');
  const item = {
    id: Date.now(),
    name,
    category: document.getElementById('inv-cat').value,
    stock: parseInt(document.getElementById('inv-stock').value) || 0,
    minStock: parseInt(document.getElementById('inv-min').value) || 5,
  };
  const inv = dbGet(DB_KEYS.inventory);
  inv.push(item);
  dbSet(DB_KEYS.inventory, inv);
  closeModal('modal-inventory');
  showToast('success', `${name} added to inventory`);
  renderInventory();
}

function renderInventory() {
  const inv = dbGet(DB_KEYS.inventory);
  const alerts = document.getElementById('inventory-alerts');
  const tbody = document.getElementById('inventory-tbody');

  const lowStock = inv.filter(i => i.stock <= i.minStock);
  alerts.innerHTML = lowStock.map(i =>
    `<div class="inv-alert">⚠ <strong>${escHtml(i.name)}</strong> — Low stock: ${i.stock} units remaining (min: ${i.minStock})</div>`
  ).join('');

  if (!lowStock.length) {
    const notifDot = document.getElementById('notif-dot');
  }

  if (!inv.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:rgba(245,245,245,0.3);">No inventory items</td></tr>`;
    return;
  }

  tbody.innerHTML = inv.map(i => {
    const isLow = i.stock <= i.minStock;
    return `<tr>
      <td><span class="font-bold">${escHtml(i.name)}</span></td>
      <td>${escHtml(i.category)}</td>
      <td style="${isLow ? 'color:var(--red)' : ''}">${i.stock}</td>
      <td>${i.minStock}</td>
      <td>${isLow ? '<span class="badge" style="background:rgba(231,76,60,0.15);color:var(--red)">Low Stock</span>' : '<span class="badge" style="background:rgba(39,174,96,0.15);color:var(--green)">OK</span>'}</td>
      <td>
        <button class="btn-sm" onclick="updateInventoryStock(${i.id}, 1)">+</button>
        <button class="btn-sm" onclick="updateInventoryStock(${i.id}, -1)" style="margin:0 4px">−</button>
        <button class="btn-sm" onclick="deleteInventoryItem(${i.id})" style="color:var(--red)">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function updateInventoryStock(id, delta) {
  const inv = dbGet(DB_KEYS.inventory);
  const i = inv.findIndex(item => item.id === id);
  if (i !== -1) { inv[i].stock = Math.max(0, inv[i].stock + delta); }
  dbSet(DB_KEYS.inventory, inv);
  renderInventory();
}

function deleteInventoryItem(id) {
  if (!confirm('Delete this item?')) return;
  const inv = dbGet(DB_KEYS.inventory).filter(i => i.id !== id);
  dbSet(DB_KEYS.inventory, inv);
  renderInventory();
}

// ========================================
// MODULE 16 — EXPENSES
// ========================================

function openAddExpenseModal() {
  ['exp-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
  openModal('modal-expense');
}

function addExpense() {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!amount || amount <= 0) return showToast('error', 'Valid amount is required');
  const exp = {
    id: Date.now(),
    category: document.getElementById('exp-cat').value,
    description: document.getElementById('exp-desc').value.trim(),
    amount,
    date: document.getElementById('exp-date').value,
    createdAt: new Date().toISOString(),
  };
  const expenses = dbGet(DB_KEYS.expenses);
  expenses.push(exp);
  dbSet(DB_KEYS.expenses, expenses);
  closeModal('modal-expense');
  showToast('success', 'Expense added');
  renderExpenses();
}

function renderExpenses() {
  const expenses = dbGet(DB_KEYS.expenses);
  const invoices = dbGet(DB_KEYS.invoices);
  const today = new Date().toISOString().split('T')[0];

  const totalRevenue = invoices.reduce((s, inv) => s + inv.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = totalRevenue - totalExpenses;

  document.getElementById('exp-revenue').textContent = '₹' + totalRevenue.toFixed(0);
  document.getElementById('exp-total').textContent = '₹' + totalExpenses.toFixed(0);
  document.getElementById('exp-profit').textContent = '₹' + profit.toFixed(0);

  const tbody = document.getElementById('expense-tbody');
  if (!expenses.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:rgba(245,245,245,0.3);">No expenses added</td></tr>`;
    return;
  }
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = sorted.map(e => `<tr>
    <td><span class="badge" style="background:rgba(52,152,219,0.1);color:var(--blue)">${escHtml(e.category)}</span></td>
    <td>${escHtml(e.description || '—')}</td>
    <td style="color:var(--red);font-weight:700">₹${e.amount.toFixed(2)}</td>
    <td>${formatDate(e.date)}</td>
    <td><button class="btn-sm" onclick="deleteExpense(${e.id})" style="color:var(--red)">✕</button></td>
  </tr>`).join('');
}

function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  dbSet(DB_KEYS.expenses, dbGet(DB_KEYS.expenses).filter(e => e.id !== id));
  renderExpenses();
}

// ========================================
// MODULE 17 — EMPLOYEES
// ========================================

function openAddEmployeeModal() {
  ['emp-name','emp-phone'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('emp-salary').value = '';
  document.getElementById('emp-commission').value = 0;
  document.getElementById('emp-join').value = new Date().toISOString().split('T')[0];
  openModal('modal-employee');
}

function addEmployee() {
  const name = document.getElementById('emp-name').value.trim();
  if (!name) return showToast('error', 'Name is required');
  const emp = {
    id: Date.now(),
    name,
    role: document.getElementById('emp-role').value,
    salary: parseFloat(document.getElementById('emp-salary').value) || 0,
    commission: parseFloat(document.getElementById('emp-commission').value) || 0,
    phone: document.getElementById('emp-phone').value.trim(),
    joinDate: document.getElementById('emp-join').value,
    attendance: [],
  };
  const employees = dbGet(DB_KEYS.employees);
  employees.push(emp);
  dbSet(DB_KEYS.employees, employees);
  closeModal('modal-employee');
  showToast('success', `${name} added`);
  renderEmployees();
}

function renderEmployees() {
  const employees = dbGet(DB_KEYS.employees);
  const grid = document.getElementById('employees-grid');
  if (!employees.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:rgba(245,245,245,0.3);">No employees added</div>`;
    return;
  }
  grid.innerHTML = employees.map(e => `
    <div class="employee-card">
      <div class="emp-avatar">${e.name[0].toUpperCase()}</div>
      <div class="emp-name">${escHtml(e.name)}</div>
      <div class="emp-role">${escHtml(e.role)}</div>
      <div class="emp-details">
        <div class="emp-detail"><span class="emp-detail-label">Phone</span><span class="emp-detail-value">${escHtml(e.phone || '—')}</span></div>
        <div class="emp-detail"><span class="emp-detail-label">Salary</span><span class="emp-detail-value">₹${e.salary.toFixed(0)}</span></div>
        <div class="emp-detail"><span class="emp-detail-label">Commission</span><span class="emp-detail-value">${e.commission}%</span></div>
        <div class="emp-detail"><span class="emp-detail-label">Joined</span><span class="emp-detail-value">${formatDate(e.joinDate)}</span></div>
      </div>
      <div class="emp-actions">
        <button class="btn-sm" onclick="deleteEmployee(${e.id})" style="color:var(--red)">Remove</button>
      </div>
    </div>`).join('');
}

function deleteEmployee(id) {
  if (!confirm('Remove employee?')) return;
  dbSet(DB_KEYS.employees, dbGet(DB_KEYS.employees).filter(e => e.id !== id));
  renderEmployees();
}

// ========================================
// MODULE 20 — SETTINGS
// ========================================

function renderSettings() {
  const settings = dbGetObj(DB_KEYS.settings, {});
  document.getElementById('set-name').value = settings.name || 'SALEEM Executive Grooming Lounge';
  document.getElementById('set-address').value = settings.address || '';
  document.getElementById('set-phone').value = settings.phone || '';
  document.getElementById('set-email').value = settings.email || '';
  document.getElementById('set-gst').value = settings.gstNumber || '';
  document.getElementById('set-hours').value = settings.hours || '9:00 AM - 9:00 PM';
  document.getElementById('set-gst-rate').value = settings.gstRate || 18;
  document.getElementById('set-gst-default').checked = settings.gstDefault || false;
  document.getElementById('set-currency').value = settings.currency || '₹';
  // Notification settings
  document.getElementById('set-auto-notify').checked = settings.autoNotify || false;
  document.getElementById('set-notif-template').value = settings.notifTemplate || DEFAULT_NOTIF_TEMPLATE;
  renderNotifLog();
}

function saveSettings() {
  const settings = {
    name: document.getElementById('set-name').value.trim(),
    address: document.getElementById('set-address').value.trim(),
    phone: document.getElementById('set-phone').value.trim(),
    email: document.getElementById('set-email').value.trim(),
    gstNumber: document.getElementById('set-gst').value.trim(),
    hours: document.getElementById('set-hours').value.trim(),
    gstRate: parseFloat(document.getElementById('set-gst-rate').value) || 18,
    gstDefault: document.getElementById('set-gst-default').checked,
    currency: document.getElementById('set-currency').value.trim() || '₹',
    autoNotify: document.getElementById('set-auto-notify').checked,
    notifTemplate: document.getElementById('set-notif-template').value.trim() || DEFAULT_NOTIF_TEMPLATE,
  };
  dbSet(DB_KEYS.settings, settings);
  document.getElementById('topbar-salon-name').textContent = settings.name || 'SALEEM';
  showToast('success', 'Settings saved');
}

function resetNotifTemplate() {
  document.getElementById('set-notif-template').value = DEFAULT_NOTIF_TEMPLATE;
  showToast('info', 'Template reset to default');
}

function renderNotifLog() {
  const log = dbGet(DB_KEYS.notifyLog);
  const el = document.getElementById('notif-log-list');
  if (!el) return;
  if (!log.length) {
    el.innerHTML = '<div class="notif-log-empty">No notifications sent yet today</div>';
    return;
  }
  // Show newest first, max 20
  const recent = [...log].reverse().slice(0, 20);
  el.innerHTML = recent.map(n => {
    const t = new Date(n.time).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
    const channelIcon = n.channel === 'whatsapp' ? '💬' : n.channel === 'sms' ? '📱' : '✓';
    return `<div class="notif-log-item">
      <span class="nl-token">${escHtml(n.token)}</span>
      <span class="nl-name">${escHtml(n.name)}</span>
      <span class="nl-phone">${escHtml(n.phone)}</span>
      <span class="nl-channel">${channelIcon} ${n.channel || 'manual'}</span>
      <span class="nl-time">${t}</span>
    </div>`;
  }).join('');
}

function clearNotifLog() {
  if (!confirm('Clear all notification history?')) return;
  dbSet(DB_KEYS.notifyLog, []);
  renderNotifLog();
  showToast('info', 'Notification log cleared');
}

// ========================================
// MODULE 21 — WHATSAPP & SMS NOTIFICATIONS
// ========================================

let _notifyCurrentQueueId = null;

function buildNotifMessage(qEntry, barber) {
  const settings = dbGetObj(DB_KEYS.settings, {});
  const template = settings.notifTemplate || DEFAULT_NOTIF_TEMPLATE;
  const salonName = settings.name || 'SALEEM Executive Grooming Lounge';
  return template
    .replace(/\{name\}/g, qEntry.name || '')
    .replace(/\{token\}/g, qEntry.token || '')
    .replace(/\{barber\}/g, barber ? barber.name : '')
    .replace(/\{chair\}/g, barber ? barber.chair : '')
    .replace(/\{salon\}/g, salonName);
}

function openNotifyModal(queueId) {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const qEntry = queue.find(q => q.id === queueId);
  if (!qEntry) { showToast('error', 'Customer not found in queue'); return; }
  const barber = barbers.find(b => b.id === qEntry.barberID);

  _notifyCurrentQueueId = queueId;

  // Populate the strip
  const strip = document.getElementById('notify-strip');
  strip.innerHTML = `
    <div class="ns-token">${escHtml(qEntry.token)}</div>
    <div class="ns-info">
      <div class="ns-name">${escHtml(qEntry.name)}</div>
      <div class="ns-detail">${barber ? `✂ ${escHtml(barber.name)} · ${escHtml(barber.chair)}` : '(no barber assigned)'}</div>
    </div>
    <div class="ns-type-badge badge-${qEntry.type}">${capitalize(qEntry.type)}</div>`;

  // Build and fill message
  const msg = buildNotifMessage(qEntry, barber);
  document.getElementById('notify-message-preview').value = msg;

  // Phone field
  const rawPhone = (qEntry.phone || '').replace(/\D/g, '').slice(-10);
  document.getElementById('notify-phone-input').value = rawPhone;

  // Check if already notified
  const log = dbGet(DB_KEYS.notifyLog);
  const prev = log.filter(n => n.queueId === queueId);
  const alreadySent = document.getElementById('notify-already-sent');
  const sentTime = document.getElementById('notify-sent-time');
  if (prev.length) {
    alreadySent.classList.remove('hidden');
    const last = prev[prev.length - 1];
    sentTime.textContent = `via ${last.channel} at ${new Date(last.time).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}`;
  } else {
    alreadySent.classList.add('hidden');
  }

  openModal('modal-notify');
}

function _getNotifyPhone() {
  return (document.getElementById('notify-phone-input').value || '').replace(/\D/g, '');
}

function _logNotification(channel) {
  const queueId = _notifyCurrentQueueId;
  if (!queueId) return;
  const queue = dbGet(DB_KEYS.queue);
  const qEntry = queue.find(q => q.id === queueId);
  if (!qEntry) return;
  const log = dbGet(DB_KEYS.notifyLog);
  log.push({
    id: Date.now(),
    queueId,
    name: qEntry.name,
    phone: _getNotifyPhone(),
    token: qEntry.token,
    channel,
    time: new Date().toISOString(),
  });
  dbSet(DB_KEYS.notifyLog, log);
  // Update already-sent indicator
  const alreadySent = document.getElementById('notify-already-sent');
  const sentTime = document.getElementById('notify-sent-time');
  if (alreadySent) {
    alreadySent.classList.remove('hidden');
    sentTime.textContent = `via ${channel} at ${new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}`;
  }
  // Refresh queue/active view if visible to show notified pill
  if (state.currentPage === 'queue') filterQueue();
  if (state.currentPage === 'active') renderActiveCustomers();
}

function sendViaWhatsApp() {
  const phone = _getNotifyPhone();
  if (!phone || phone.length < 10) {
    showToast('error', 'Please enter a valid 10-digit phone number');
    return;
  }
  const msg = document.getElementById('notify-message-preview').value;
  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  _logNotification('whatsapp');
  showToast('success', 'WhatsApp opened — message ready to send!');
}

function sendViaSMS() {
  const phone = _getNotifyPhone();
  if (!phone || phone.length < 10) {
    showToast('error', 'Please enter a valid 10-digit phone number');
    return;
  }
  const msg = document.getElementById('notify-message-preview').value;
  // SMS URI — works on mobile/desktop
  const url = `sms:+91${phone}?body=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  _logNotification('sms');
  showToast('success', 'SMS app opened — message ready to send!');
}

function copyNotifMessage() {
  const msg = document.getElementById('notify-message-preview').value;
  navigator.clipboard.writeText(msg).then(() => {
    showToast('success', 'Message copied to clipboard!');
    _logNotification('copy');
  }).catch(() => {
    showToast('error', 'Could not copy — try selecting and copying manually');
  });
}

function markAsNotified() {
  _logNotification('manual');
  showToast('success', 'Marked as notified');
  closeModal('modal-notify');
  if (state.currentPage === 'queue') filterQueue();
  if (state.currentPage === 'active') renderActiveCustomers();
}

// ========================================
// MODULE 22 — BACKUP & RESTORE
// ========================================

function exportData() {
  const backup = {};
  Object.entries(DB_KEYS).forEach(([key, dbKey]) => {
    try { backup[key] = JSON.parse(localStorage.getItem(dbKey) || 'null'); } catch {}
  });
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saleem-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('success', 'Backup exported successfully');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      Object.entries(DB_KEYS).forEach(([key, dbKey]) => {
        if (data[key] !== undefined && data[key] !== null) {
          localStorage.setItem(dbKey, JSON.stringify(data[key]));
        }
      });
      showToast('success', 'Data restored successfully. Refreshing...');
      setTimeout(() => location.reload(), 1500);
    } catch {
      showToast('error', 'Invalid backup file');
    }
  };
  reader.readAsText(file);
}

function resetSystem() {
  if (!confirm('⚠ This will DELETE all data permanently. Are you absolutely sure?')) return;
  if (!confirm('Last chance! This cannot be undone. Confirm reset?')) return;
  Object.values(DB_KEYS).forEach(key => localStorage.removeItem(key));
  showToast('info', 'System reset. Refreshing...');
  setTimeout(() => location.reload(), 1500);
}

// ========================================
// MODULE 22 — SEARCH
// ========================================

function globalSearch(q) {
  const resEl = document.getElementById('search-results');
  if (!q || q.length < 2) { resEl.classList.remove('show'); return; }

  const customers = dbGet(DB_KEYS.customers);
  const barbers = dbGet(DB_KEYS.barbers);
  const queue = dbGet(DB_KEYS.queue);
  const invoices = dbGet(DB_KEYS.invoices);
  const ql = q.toLowerCase();

  const results = [];

  customers.filter(c => c.name.toLowerCase().includes(ql) || c.phone.includes(ql)).slice(0, 3).forEach(c =>
    results.push({ type: 'Customer', name: c.name, sub: c.phone, action: `viewCustomerDetail('${c.phone}')` }));

  barbers.filter(b => b.name.toLowerCase().includes(ql)).slice(0, 2).forEach(b =>
    results.push({ type: 'Barber', name: b.name, sub: b.chair + ' — ' + capitalize(b.status), action: `navigate('barbers')` }));

  queue.filter(q2 => q2.token.toLowerCase().includes(ql) || q2.name.toLowerCase().includes(ql)).slice(0, 3).forEach(q2 =>
    results.push({ type: 'Token', name: q2.token + ' — ' + q2.name, sub: capitalize(q2.status), action: `navigate('queue')` }));

  invoices.filter(inv => inv.invoiceNo.toLowerCase().includes(ql) || inv.customerName.toLowerCase().includes(ql)).slice(0, 2).forEach(inv =>
    results.push({ type: 'Invoice', name: inv.invoiceNo, sub: inv.customerName + ' — ₹' + inv.total.toFixed(0), action: `viewReceipt('${inv.invoiceNo}')` }));

  if (!results.length) { resEl.classList.remove('show'); return; }

  resEl.innerHTML = results.map(r => `
    <div class="search-result-item" onclick="${r.action};document.getElementById('global-search').value='';document.getElementById('search-results').classList.remove('show')">
      <div class="search-result-type">${r.type}</div>
      <div class="search-result-name">${escHtml(r.name)}</div>
      <div class="search-result-sub">${escHtml(r.sub)}</div>
    </div>`).join('');
  resEl.classList.add('show');
}

// ========================================
// MODULE 23 — NOTIFICATIONS
// ========================================

function addNotification(icon, title, msg) {
  const notifs = dbGet(DB_KEYS.notifications);
  notifs.unshift({ id: Date.now(), icon, title, msg, time: new Date().toISOString(), read: false });
  if (notifs.length > 50) notifs.pop();
  dbSet(DB_KEYS.notifications, notifs);
  document.getElementById('notif-dot').classList.add('show');
  renderNotifications();
}

function renderNotifications() {
  const notifs = dbGet(DB_KEYS.notifications).slice(0, 10);
  const el = document.getElementById('notif-list');
  if (!notifs.length) {
    el.innerHTML = '<div class="notif-empty">No notifications</div>';
    return;
  }
  el.innerHTML = notifs.map(n => `
    <div class="notif-item">
      <div class="notif-icon">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-title">${escHtml(n.title)}</div>
        <div class="notif-msg">${escHtml(n.msg)}</div>
        <div class="notif-time">${formatDateTime(n.time)}</div>
      </div>
    </div>`).join('');
}

function toggleNotifications() {
  const panel = document.getElementById('notification-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    document.getElementById('notif-dot').classList.remove('show');
    renderNotifications();
  }
}

function clearNotifications() {
  dbSet(DB_KEYS.notifications, []);
  document.getElementById('notification-panel').classList.remove('open');
  document.getElementById('notif-dot').classList.remove('show');
}

// ========================================
// BADGE UPDATES
// ========================================

function updateBadges() {
  const queue = dbGet(DB_KEYS.queue);
  const today = new Date().toISOString().split('T')[0];
  const todayQ = queue.filter(q => q.arrivalTime && q.arrivalTime.startsWith(today));
  const waiting = todayQ.filter(q => q.status === 'waiting').length;
  const active = todayQ.filter(q => q.status === 'active').length;

  const qBadge = document.getElementById('queue-badge');
  const aBadge = document.getElementById('active-badge');
  if (qBadge) { qBadge.textContent = waiting; qBadge.style.display = waiting ? 'inline' : 'none'; }
  if (aBadge) { aBadge.textContent = active; aBadge.style.display = active ? 'inline' : 'none'; }
}

// ========================================
// MODAL HELPERS
// ========================================

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
  // Close notification panel if clicking outside
  const notifBtn = document.querySelector('.notification-btn');
  const notifPanel = document.getElementById('notification-panel');
  if (notifPanel && !notifPanel.contains(e.target) && !notifBtn?.contains(e.target)) {
    notifPanel.classList.remove('open');
  }
  // Close search results
  const searchBox = document.querySelector('.search-box');
  const searchRes = document.getElementById('search-results');
  if (searchRes && !searchBox?.contains(e.target) && !searchRes.contains(e.target)) {
    searchRes.classList.remove('show');
  }
});

// ========================================
// TOAST NOTIFICATIONS
// ========================================

function showToast(type, msg) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✕', info: '◈' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '●'}</span><span class="toast-msg">${escHtml(msg)}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fadeout'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ========================================
// CLOCK
// ========================================

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.getElementById('sidebar-time');
  if (el) el.textContent = timeStr;
}

// ========================================
// UTILITY HELPERS
// ========================================

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

// ========================================
// SEED DEMO DATA (first load)
// ========================================

function seedDemoData() {
  if (localStorage.getItem('saleem_seeded')) return;

  // Settings
  dbSet(DB_KEYS.settings, {
    name: 'SALEEM Executive Grooming Lounge',
    address: '123 Premium Mall, MG Road, Bengaluru - 560001',
    phone: '+91 98765 43210',
    email: 'contact@saleemgrooming.com',
    gstNumber: '29ABCDE1234F1Z5',
    hours: '9:00 AM - 9:00 PM',
    gstRate: 18,
    gstDefault: false,
    currency: '₹',
  });

  // Barbers
  const barbers = [
    { id: 1001, name: 'Saleem Khan', chair: 'Chair 1', experience: 8, specialization: 'Hair Cut, Beard, Styling', status: 'available', currentCustomer: null, revenue: 12400, served: 62 },
    { id: 1002, name: 'Ravi Kumar', chair: 'Chair 2', experience: 5, specialization: 'Color, Keratin, Smoothening', status: 'available', currentCustomer: null, revenue: 9800, served: 49 },
    { id: 1003, name: 'Aslam Sheikh', chair: 'Chair 3', experience: 3, specialization: 'Shave, Beard, Facial', status: 'available', currentCustomer: null, revenue: 6200, served: 31 },
  ];
  dbSet(DB_KEYS.barbers, barbers);

  // Customers
  const customers = [
    { id: 2001, name: 'Arjun Sharma', phone: '9876543210', visits: 12, lifetimeSpend: 14400, firstVisit: '2024-01-15T10:00:00Z', lastVisit: '2025-05-20T11:00:00Z', favoriteBarber: 'Saleem Khan', favoriteServices: 'Haircut, Beard Trim', history: [] },
    { id: 2002, name: 'Vikram Singh', phone: '9845678901', visits: 6, lifetimeSpend: 5400, firstVisit: '2024-06-10T09:00:00Z', lastVisit: '2025-05-10T14:00:00Z', favoriteBarber: 'Ravi Kumar', favoriteServices: 'Hair Color, Facial', history: [] },
    { id: 2003, name: 'Rahul Patel', phone: '9712345678', visits: 3, lifetimeSpend: 1800, firstVisit: '2024-11-01T10:30:00Z', lastVisit: '2025-04-15T12:00:00Z', favoriteBarber: 'Aslam Sheikh', favoriteServices: 'Haircut', history: [] },
  ];
  dbSet(DB_KEYS.customers, customers);

  // Inventory
  const inventory = [
    { id: 3001, name: 'Premium Shampoo', category: 'Shampoo', stock: 12, minStock: 5 },
    { id: 3002, name: 'Styling Wax', category: 'Wax', stock: 3, minStock: 5 },
    { id: 3003, name: 'Hair Gel', category: 'Gel', stock: 8, minStock: 4 },
    { id: 3004, name: 'Beard Cream', category: 'Cream', stock: 2, minStock: 5 },
    { id: 3005, name: 'Color Dye (Black)', category: 'Color Products', stock: 15, minStock: 6 },
  ];
  dbSet(DB_KEYS.inventory, inventory);

  // Historical invoices (for analytics)
  const invoices = [];
  const days = 30;
  let invCount = 1;
  for (let i = days; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dayRevenue = Math.floor(Math.random() * 8) + 2;
    for (let j = 0; j < dayRevenue; j++) {
      invoices.push({
        id: Date.now() + invCount,
        invoiceNo: 'INV-' + String(invCount).padStart(4, '0'),
        token: 'T-' + String(invCount).padStart(3, '0'),
        customerId: 2001 + (j % 3),
        customerName: ['Arjun Sharma', 'Vikram Singh', 'Rahul Patel'][j % 3],
        phone: ['9876543210', '9845678901', '9712345678'][j % 3],
        barberName: ['Saleem Khan', 'Ravi Kumar', 'Aslam Sheikh'][j % 3],
        services: [
          [{ name: 'Haircut', qty: 1, price: 200 }, { name: 'Beard Trim', qty: 1, price: 100 }],
          [{ name: 'Hair Color', qty: 1, price: 800 }],
          [{ name: 'Facial', qty: 1, price: 400 }, { name: 'Massage', qty: 1, price: 350 }],
        ][j % 3],
        subtotal: [300, 800, 750][j % 3],
        discount: 0, gstAmt: 0, tips: [50, 100, 0][j % 3],
        total: [350, 900, 750][j % 3],
        paymentMode: ['cash', 'upi', 'card'][j % 3],
        createdAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10 + j, 0, 0).toISOString(),
      });
      invCount++;
    }
  }
  dbSet(DB_KEYS.invoices, invoices);
  dbSet(DB_KEYS.invoiceCounter, { count: invCount });
  dbSet(DB_KEYS.tokenCounter, { count: invCount });

  // Appointments
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const day2 = new Date(); day2.setDate(day2.getDate() + 2);
  dbSet(DB_KEYS.appointments, [
    { id: 4001, name: 'Karan Mehta', phone: '9900112233', date: tomorrow.toISOString().split('T')[0], time: '11:00', barberName: 'Saleem Khan', barberID: 1001, services: 'Haircut, Beard', notes: 'Regular customer', status: 'upcoming', createdAt: new Date().toISOString() },
    { id: 4002, name: 'Amit Verma', phone: '9811223344', date: day2.toISOString().split('T')[0], time: '14:30', barberName: 'Ravi Kumar', barberID: 1002, services: 'Hair Color', notes: '', status: 'upcoming', createdAt: new Date().toISOString() },
  ]);

  // Expenses
  dbSet(DB_KEYS.expenses, [
    { id: 5001, category: 'Rent', description: 'Monthly shop rent', amount: 15000, date: new Date().toISOString().split('T')[0].substring(0, 7) + '-01', createdAt: new Date().toISOString() },
    { id: 5002, category: 'Electricity', description: 'Electricity bill', amount: 3200, date: new Date().toISOString().split('T')[0].substring(0, 7) + '-05', createdAt: new Date().toISOString() },
    { id: 5003, category: 'Products', description: 'Monthly stock purchase', amount: 8000, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
  ]);

  // Employees
  dbSet(DB_KEYS.employees, [
    { id: 6001, name: 'Saleem Khan', role: 'Barber', salary: 20000, commission: 10, phone: '9876543210', joinDate: '2020-03-15', attendance: [] },
    { id: 6002, name: 'Priya Sharma', role: 'Receptionist', salary: 15000, commission: 0, phone: '9123456780', joinDate: '2021-06-01', attendance: [] },
  ]);

  localStorage.setItem('saleem_seeded', '1');
}

// ========================================
// INIT
// ========================================

function init() {
  seedDemoData();
  updateClock();
  setInterval(updateClock, 1000);
  // Auto-refresh active view every 30s
  setInterval(() => {
    if (state.currentPage === 'active') renderActiveCustomers();
    if (state.currentPage === 'barbers') renderBarbers();
    if (state.currentPage === 'dashboard') renderDashboard();
    updateBadges();
  }, 30000);

  // Load settings into topbar
  const settings = dbGetObj(DB_KEYS.settings, {});
  const name = settings.name || 'SALEEM';
  document.getElementById('topbar-salon-name').textContent = name.split(' ')[0] || 'SALEEM';

  navigate('dashboard');
  updateBadges();
}

document.addEventListener('DOMContentLoaded', init);
