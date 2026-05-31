/* ========================================
   SALEEM TV DISPLAY — Live Queue Board
   Auto-refreshes every 5 seconds
======================================== */

'use strict';

const DB_KEYS = {
  queue: 'saleem_queue',
  barbers: 'saleem_barbers',
  settings: 'saleem_settings',
};

function dbGet(key, fallback = []) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function dbGetObj(key, fallback = {}) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('tv-time').textContent = timeStr;
  document.getElementById('tv-date').textContent = dateStr;
}

function renderNowServing() {
  const queue = dbGet(DB_KEYS.queue);
  const barbers = dbGet(DB_KEYS.barbers);
  const active = queue.filter(q => q.status === 'active');
  const el = document.getElementById('now-serving-cards');

  if (!active.length) {
    el.innerHTML = `<div class="serving-empty">
      <div class="empty-scissors">✂</div>
      <p>Welcoming Our Esteemed Guests</p>
    </div>`;
    return;
  }

  el.innerHTML = active.map(q => {
    const barber = barbers.find(b => b.id === q.barberID);
    const elapsed = q.startTime ? Math.floor((Date.now() - new Date(q.startTime).getTime()) / 60000) : 0;
    const typeTag = q.type === 'vip' ? `<span class="tqi-vip">VIP</span>` : '';
    return `<div class="serving-card">
      <div class="sc-token">${escHtml(q.token)}</div>
      <div class="sc-info">
        <div class="sc-name">${escHtml(q.name)}</div>
        <div class="sc-barber">Stylist: ${barber ? escHtml(barber.name) : 'N/A'} &nbsp;•&nbsp; ${elapsed} min</div>
      </div>
      <div class="sc-right">
        <div class="sc-chair">${barber ? escHtml(barber.chair) : '—'}</div>
        <div class="sc-status"><div class="sc-status-dot"></div>Serving</div>
      </div>
    </div>`;
  }).join('');
}

function renderQueue() {
  const queue = dbGet(DB_KEYS.queue);
  const waiting = queue.filter(q => q.status === 'waiting')
    .sort((a, b) => new Date(a.arrivalTime) - new Date(b.arrivalTime))
    .slice(0, 8);
  const active = queue.filter(q => q.status === 'active');
  const el = document.getElementById('tv-queue-list');

  document.getElementById('tv-waiting-count').textContent = waiting.length;
  document.getElementById('tv-active-count').textContent = active.length;

  if (!waiting.length) {
    el.innerHTML = '<div class="tv-queue-empty">Queue is empty</div>';
    return;
  }

  el.innerHTML = waiting.map((q, i) => {
    const arrTime = new Date(q.arrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `<div class="tv-queue-item">
      <div class="tqi-pos">${i + 1}</div>
      <div class="tqi-token">${escHtml(q.token)}</div>
      <div class="tqi-name">${escHtml(q.name)}</div>
      <div class="tqi-time">${arrTime}</div>
      ${q.type === 'vip' ? '<div class="tqi-vip">VIP</div>' : ''}
    </div>`;
  }).join('');
}

function updateMarquee() {
  const settings = dbGetObj(DB_KEYS.settings, {});
  const name = settings.name || 'SALEEM Luxury Salon';
  const hours = settings.hours || '9:00 AM - 9:00 PM';
  const phone = settings.phone || '';
  document.getElementById('marquee-text').textContent =
    `Welcome to ${name}  •  Premium Grooming Experience  •  Open: ${hours}  •  ${phone ? 'Call us: ' + phone + '  •  ' : ''}Please wait for your token to be called  •  Thank you for your patience  •  `;
}

function createParticles() {
  const container = document.getElementById('bg-particles');
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 15}s;
    `;
    container.appendChild(p);
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function refresh() {
  renderNowServing();
  renderQueue();
  updateMarquee();
}

// Init
createParticles();
updateClock();
setInterval(updateClock, 1000);
refresh();
setInterval(refresh, 5000);
