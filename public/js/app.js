/* Oddslander — Shared Frontend Logic */

// ── Theme (before DOM to prevent flash) ─────────────────────────────────────
(function() {
  const t = localStorage.getItem('ol_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();

// ── Constants ────────────────────────────────────────────────────────────────
const API = '';

// ── Auth State ────────────────────────────────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('ol_user')); } catch { return null; }
}
function setUser(u) { localStorage.setItem('ol_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('ol_user'); }

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="material-icons-round" style="font-size:16px">${icons[type] || 'info'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'none'; toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function formatMatchDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `<span style="display:block;font-size:11px;color:var(--text-soft)">${date}</span><span style="display:block;font-size:12px;font-weight:700;color:var(--primary)">${time}</span>`;
}
function formatOdds(o) { return o ? parseFloat(o).toFixed(2) : 'N/A'; }
function timeAgo(dt) {
  const diff = (Date.now() - new Date(dt)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

// ── League Cache ──────────────────────────────────────────────────────────────
let _leagueCache = null, _leagueCacheAt = 0;
async function fetchLeagues() {
  if (_leagueCache && Date.now() - _leagueCacheAt < 300000) return _leagueCache;
  try {
    const r = await fetch('/api/leagues?grouped=true');
    const data = await r.json();
    _leagueCache = data.data?.leagues || data.leagues || {};
    _leagueCacheAt = Date.now();
    return _leagueCache;
  } catch {
    return { Europe: [
      { id: 1, name: 'Premier League', api_league_id: 39 },
      { id: 2, name: 'La Liga', api_league_id: 140 },
      { id: 3, name: 'Bundesliga', api_league_id: 78 },
      { id: 4, name: 'Serie A', api_league_id: 135 },
      { id: 5, name: 'Ligue 1', api_league_id: 61 },
      { id: 6, name: 'UCL', api_league_id: 2 },
    ]};
  }
}

// ── Stats Cache ───────────────────────────────────────────────────────────────
let _statsCache = null;
async function fetchStats() {
  if (_statsCache) return _statsCache;
  try {
    const r = await fetch('/api/predictions/stats');
    const data = await r.json();
    _statsCache = data.data || {};
    return _statsCache;
  } catch { return {}; }
}

// ── Social Links ──────────────────────────────────────────────────────────────
async function fetchSocialLinks() {
  try {
    const r = await fetch('/api/pages/social-links');
    const data = await r.json();
    return data.data?.links || {};
  } catch { return {}; }
}

// ── Confidence Bar HTML ───────────────────────────────────────────────────────
function buildConfidenceBar(score) {
  if (!score) return '';
  const cls = score >= 80 ? 'conf-high' : score >= 60 ? 'conf-med' : score >= 40 ? 'conf-low' : 'conf-poor';
  return `<div class="confidence-wrap ${cls}">
    <div class="confidence-label"><span>Confidence</span><span>${score}%</span></div>
    <div class="confidence-bar"><div class="confidence-fill" style="width:${score}%"></div></div>
  </div>`;
}

// ── Intelligence Score SVG ────────────────────────────────────────────────────
function buildIntelligenceGauge(score) {
  if (!score) return '';
  const r = 28, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#02f5a1' : score >= 60 ? '#99cc33' : score >= 40 ? '#faf92a' : '#ff4757';
  return `<div class="intelligence-score">
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5"/>
      <circle cx="36" cy="36" r="${r}" fill="none" stroke="${color}" stroke-width="5"
        stroke-dasharray="${fill} ${circ}" stroke-linecap="round"/>
    </svg>
    <div class="score-num" style="margin-top:-56px">${score}</div>
    <div class="score-label" style="margin-top:4px">AI Score</div>
  </div>`;
}

// ── Mega Acca Card ────────────────────────────────────────────────────────────
function buildAccaCard(p) {
  const lines = (p.analysis || '').split('\n').filter(l => /^\d+\./.test(l));
  const preview = lines.slice(0, 3);
  const remaining = lines.length - preview.length;
  return `<div class="prediction-card acca-card" data-id="${p.id}">
    <div style="text-align:center;margin-bottom:10px">
      <span class="badge badge-banker" style="background:linear-gradient(135deg,var(--primary),#00b4d8);font-size:11px">
        <span class="material-icons-round" style="font-size:12px;vertical-align:middle">auto_awesome</span>
        MEGA ACCUMULATOR
      </span>
    </div>
    <div class="prediction-header">
      <div class="league-tag"><span class="material-icons-round" style="font-size:18px">emoji_events</span><span>Multi-League</span></div>
      <div class="match-date">${formatMatchDate(p.match_date)}</div>
    </div>
    <div style="text-align:center;padding:14px 0 10px">
      <div style="font-size:36px;font-weight:900;color:var(--primary);line-height:1">${parseFloat(p.odds).toFixed(0)}x</div>
      <div style="font-size:12px;color:var(--text-soft);margin-top:2px">Combined Odds</div>
    </div>
    <div style="margin:0 0 12px;padding:10px 12px;background:rgba(2,245,161,0.06);border-radius:10px;border:1px solid rgba(2,245,161,0.12)">
      ${preview.map(l => `<div style="font-size:12px;color:var(--text-soft);padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04)">${escapeHtml(l)}</div>`).join('')}
      ${remaining > 0 ? `<div style="font-size:12px;color:var(--primary);margin-top:6px">+${remaining} more selections…</div>` : ''}
    </div>
    ${p.confidence_score ? buildConfidenceBar(p.confidence_score) : ''}
    <div class="prediction-footer">
      <span class="badge" style="background:rgba(173,223,241,0.1);color:var(--info)">Accumulator</span>
      <a href="/prediction/${escapeHtml(p.slug || p.id)}" class="btn btn-sm btn-outline">View Full Acca →</a>
    </div>
  </div>`;
}

// ── Team Form ────────────────────────────────────────────────────────────────
function buildFormDots(form, limit) {
  if (!form) return '';
  const chars = limit ? form.slice(0, limit).split('') : form.split('');
  return chars.map(r => {
    const bg = r === 'W' ? '#02f5a1' : r === 'L' ? '#ff4757' : '#faf92a';
    const fg = r === 'D' ? '#07191e' : r === 'L' ? '#fff' : '#07191e';
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${bg};color:${fg};font-size:9px;font-weight:800;line-height:1">${r}</span>`;
  }).join('');
}

// ── Live status helpers ───────────────────────────────────────────────────────
const LIVE_STATUS_SET = new Set(['1H','HT','2H','ET','BT','P','INT','LIVE']);
const FINISHED_STATUS_SET = new Set(['FT','AET','PEN','AWD','WO']);
const LIVE_STATUS_LABEL = { '1H':'1st Half','HT':'Half Time','2H':'2nd Half','ET':'Extra Time','BT':'Break','P':'Penalties','INT':'Interrupted','LIVE':'Live' };

function buildScoreDivider(p) {
  const hasScore = p.home_score !== null && p.home_score !== undefined &&
                   p.away_score !== null && p.away_score !== undefined;
  const isLive = hasScore && LIVE_STATUS_SET.has(p.fixture_status);
  const isFT   = hasScore && FINISHED_STATUS_SET.has(p.fixture_status);

  if (isLive) {
    const label = LIVE_STATUS_LABEL[p.fixture_status] || 'Live';
    const mins  = p.elapsed_minutes ? `${p.elapsed_minutes}'` : '';
    return `<div style="text-align:center">
      <div style="font-size:22px;font-weight:900;color:var(--primary);line-height:1">${p.home_score} - ${p.away_score}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:3px">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff4757;animation:livePulse 1s infinite"></span>
        <span style="font-size:10px;font-weight:700;color:#ff4757;text-transform:uppercase;letter-spacing:.5px">${label}${mins ? ' · '+mins : ''}</span>
      </div>
    </div>`;
  }
  if (isFT) {
    return `<div style="text-align:center">
      <div style="font-size:22px;font-weight:900;color:var(--text);line-height:1">${p.home_score} - ${p.away_score}</div>
      <div style="font-size:10px;font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">FT</div>
    </div>`;
  }
  return `<div class="vs-divider">VS</div>`;
}

// ── Prediction Card ───────────────────────────────────────────────────────────
function buildPredictionCard(p, isVip = false) {
  if (p.source === 'daily_special' && p.market === 'Accumulator') return buildAccaCard(p);
  const isLocked = p.is_vip && !isVip && (p.tip === '🔒 VIP Pick' || p.tip === 'VIP Pick');
  const isBanker = p.is_banker;
  const bookies = (() => { try { return JSON.parse(p.bookies_available || '[]'); } catch { return []; } })();
  const isLive = LIVE_STATUS_SET.has(p.fixture_status) && p.home_score !== null;
  const resultBadge = p.result !== 'pending'
    ? `<span class="badge badge-${p.result}">${p.result.toUpperCase()}</span>`
    : isLive ? `<span class="badge" style="background:rgba(255,71,87,0.15);color:#ff4757;border:1px solid rgba(255,71,87,0.3)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff4757;animation:livePulse 1s infinite;vertical-align:middle;margin-right:4px"></span>LIVE</span>` : '';

  return `<div class="prediction-card ${isBanker ? 'banker-card' : ''} ${p.is_vip && !isBanker ? 'vip-card' : ''}" data-id="${p.id}">
    ${isBanker ? '<div style="text-align:center;margin-bottom:10px"><span class="badge badge-banker"><span class="material-icons-round" style="font-size:12px;vertical-align:middle">star</span> BANKER OF THE DAY</span></div>' : ''}
    ${p.is_vip && !isBanker ? '<div style="text-align:right;margin-bottom:6px"><span class="badge badge-vip">VIP</span></div>' : ''}
    <div class="prediction-header">
      <div class="league-tag">
        ${p.league_logo ? `<img src="${escapeHtml(p.league_logo)}" alt="">` : '<span class="material-icons-round" style="font-size:18px">emoji_events</span>'}
        <span>${escapeHtml(p.league_name || 'Football')}</span>
      </div>
      <div class="match-date">${formatMatchDate(p.match_date)}</div>
    </div>
    <div class="teams-row">
      <div class="team">
        ${p.home_team_logo ? `<img src="${escapeHtml(p.home_team_logo)}" alt="${escapeHtml(p.home_team)}">` : '<span class="material-icons-round" style="font-size:28px">sports_soccer</span>'}
        <div class="team-name">${escapeHtml(p.home_team)}</div>
        ${p.home_form ? `<div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${buildFormDots(p.home_form)}</div>` : ''}
      </div>
      ${buildScoreDivider(p)}
      <div class="team">
        ${p.away_team_logo ? `<img src="${escapeHtml(p.away_team_logo)}" alt="${escapeHtml(p.away_team)}">` : '<span class="material-icons-round" style="font-size:28px">sports_soccer</span>'}
        <div class="team-name">${escapeHtml(p.away_team)}</div>
        ${p.away_form ? `<div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${buildFormDots(p.away_form)}</div>` : ''}
      </div>
    </div>
    <div class="prediction-tip">
      <div><div class="tip-label">Our Pick</div><div class="tip-value">${escapeHtml(p.tip)}</div></div>
      ${p.odds ? `<div><div class="tip-label">Odds</div><div class="odds-value">${formatOdds(p.odds)}</div></div>` : ''}
    </div>
    ${p.confidence_score ? buildConfidenceBar(p.confidence_score) : ''}
    ${bookies.length ? `<div class="bookie-tags">${bookies.slice(0,4).map(b => `<span class="bookie-tag"><span class="odds-live-dot"></span>${escapeHtml(b)}</span>`).join('')}</div>` : ''}
    <div class="prediction-footer">
      <div class="flex gap-1">${resultBadge}${p.market ? `<span class="badge" style="background:rgba(173,223,241,0.1);color:var(--info)">${escapeHtml(p.market)}</span>` : ''}</div>
      <a href="/prediction/${escapeHtml(p.slug || p.id)}" class="btn btn-sm btn-outline">View →</a>
    </div>
    ${isLocked ? `<div class="vip-overlay"><div class="lock-icon"><span class="material-icons-round" style="font-size:36px">lock</span></div><p>VIP Pick — Subscribe to unlock</p><a href="/pricing.html" class="btn btn-vip btn-sm">Unlock VIP</a></div>` : ''}
  </div>`;
}

// ── Banker Cards ──────────────────────────────────────────────────────────────
async function renderBankerCards(container) {
  if (!container) return;
  try {
    const r = await fetch('/api/predictions/bankers');
    const data = await r.json();
    const bankers = data.data?.predictions || [];
    if (!bankers.length) { container.style.display = 'none'; return; }
    container.innerHTML = `<h2 class="section-title"><span class="material-icons-round">star</span> <span>Banker of the Day</span></h2>
      <div class="grid-2">${bankers.map(p => buildPredictionCard(p, true)).join('')}</div>`;
  } catch { container.style.display = 'none'; }
}

// ── VIP Teaser ────────────────────────────────────────────────────────────────
async function renderVipTeaser(container) {
  if (!container) return;
  const user = getUser();
  const isVip = user?.role === 'vip' || user?.role === 'admin';
  try {
    const r = await fetch('/api/predictions?category=vip&limit=3&date=today');
    const data = await r.json();
    const picks = data.data?.predictions || [];
    if (!picks.length) { container.style.display = 'none'; return; }
    container.innerHTML = `<div class="flex-between mb-2">
      <h2 class="section-title mb-0"><span class="material-icons-round">lock</span> <span>VIP Picks</span></h2>
      ${!isVip ? '<a href="/pricing.html" class="btn btn-vip btn-sm">Unlock VIP</a>' : ''}
    </div>
    <div class="grid-3">${picks.map(p => buildPredictionCard(p, isVip)).join('')}</div>`;
  } catch { container.style.display = 'none'; }
}

// ── Recent Wins Sidebar ───────────────────────────────────────────────────────
async function loadRecentWins(containerId = 'recent-wins-list') {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const r = await fetch('/api/predictions/recent-wins');
    const data = await r.json();
    const wins = data.data?.wins || [];
    if (!wins.length) {
      el.innerHTML = '<p style="text-align:center;color:var(--text-soft);padding:32px 0;font-size:13px">No winning tips recorded yet.</p>';
      return;
    }
    const now = Date.now();
    const displayed = wins.slice(0, 10);
    el.innerHTML = displayed.map(w => {
      const matchMs   = new Date(w.match_date).getTime();
      const isJustWon = (now - matchMs) < 86400000;
      const hasScore  = w.home_score !== null && w.away_score !== null;
      const odds      = w.odds ? parseFloat(w.odds).toFixed(2) : null;
      const tip       = w.tip || w.market || '—';
      const matchDate = new Date(w.match_date);
      const dateLabel = matchDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      const timeLabel = matchDate.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
      const wonLabel  = isJustWon ? '⚡ Just Won' : 'WON 🏆';
      const homeLogo  = w.home_team_logo
        ? `<img src="${escapeHtml(w.home_team_logo)}" alt="${escapeHtml(w.home_team)}" class="rw-logo" onerror="this.style.display='none'">`
        : `<div class="rw-logo-fallback">${escapeHtml(w.home_team[0]||'?')}</div>`;
      const awayLogo  = w.away_team_logo
        ? `<img src="${escapeHtml(w.away_team_logo)}" alt="${escapeHtml(w.away_team)}" class="rw-logo" onerror="this.style.display='none'">`
        : `<div class="rw-logo-fallback">${escapeHtml(w.away_team[0]||'?')}</div>`;
      const homeForm  = w.home_form ? buildFormDots(w.home_form, 5) : '';
      const awayForm  = w.away_form ? buildFormDots(w.away_form, 5) : '';

      return `<a href="/prediction/${escapeHtml(w.slug)}" class="rw-card">
        <div class="rw-teams-row">
          <div class="rw-team rw-home">
            <span class="rw-team-name">${escapeHtml(w.home_team)}</span>
            <div class="rw-form">${homeForm}</div>
            ${homeLogo}
          </div>
          <div class="rw-score-block">
            ${hasScore
              ? `<span class="rw-score">${w.home_score} - ${w.away_score}</span>`
              : `<span class="rw-vs">VS</span>`}
          </div>
          <div class="rw-team rw-away">
            ${awayLogo}
            <div class="rw-form">${awayForm}</div>
            <span class="rw-team-name">${escapeHtml(w.away_team)}</span>
          </div>
          <div class="rw-won-badge ${isJustWon ? 'rw-just-won' : ''}">
            <span>${wonLabel}</span>
            <span class="rw-won-date">${dateLabel} · ${timeLabel}</span>
          </div>
        </div>
        <div class="rw-picks-row">
          ${odds ? `<span class="rw-pill rw-odds">Odds: <strong>${odds}</strong></span>` : ''}
          <span class="rw-pill rw-tip"><span class="rw-s">S</span> Tip: ${escapeHtml(tip)}</span>
        </div>
      </a>`;
    }).join('');
  } catch {
    el.innerHTML = '<p style="text-align:center;color:var(--text-soft);padding:24px 0;font-size:13px">Could not load wins.</p>';
  }
}

// ── Ticker ────────────────────────────────────────────────────────────────────
async function initTicker() {
  const wrap = document.querySelector('.ticker-track');
  if (!wrap) return;
  try {
    const r = await fetch('/api/predictions?date=today&limit=20');
    const data = await r.json();
    const preds = data.data?.predictions || [];
    if (!preds.length) { document.querySelector('.ticker-wrap')?.style && (document.querySelector('.ticker-wrap').style.display = 'none'); return; }
    const items = preds.map(p => {
      const cls = p.result === 'won' ? 'won' : p.result === 'lost' ? 'lost' : 'pending';
      return `<span class="ticker-item"><strong class="${cls}">${escapeHtml(p.home_team)} vs ${escapeHtml(p.away_team)}</strong> — ${escapeHtml(p.tip)}${p.odds ? ` @ ${formatOdds(p.odds)}` : ''}</span>`;
    });
    const html = items.join('') + items.join(''); // double for seamless loop
    wrap.innerHTML = `<span class="ticker-content">${html}</span>`;
  } catch {}
}

// ── Header ────────────────────────────────────────────────────────────────────
async function injectHeader() {
  const target = document.getElementById('header-placeholder');
  if (!target) return;
  target.className = 'site-header';
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const isVip = user?.role === 'vip';
  const currentPath = window.location.pathname;

  const navLinks = [
    ['/', 'Home'],
    ['/predictions.html', 'Predictions'],
    ['/bet-builder.html', 'Bet Builder'],
    ['/pricing.html', 'Subscription'],
    ['/blog.html', 'Blog'],
    ['/about.html', 'About Us'],
  ];

  const tipsActive = currentPath.startsWith('/predictions/') ? 'active' : '';
  const tipsDropdown = `
    <div class="nav-dropdown">
      <button class="nav-link nav-dropdown-btn ${tipsActive}">
        Tips <span class="material-icons-round" style="font-size:14px">expand_more</span>
      </button>
      <div class="nav-dropdown-menu">
        <a href="/predictions/over-25">Over 2.5 Goals</a>
        <a href="/predictions/btts">BTTS</a>
        <a href="/predictions/accumulator">Accumulator</a>
        <a href="/predictions/1x2">1X2 / Win-Draw-Win</a>
        <a href="/predictions/correct-score">Correct Score</a>
        <a href="/predictions/double-chance">Double Chance</a>
        <a href="/predictions/draw-no-bet">Draw No Bet</a>
      </div>
    </div>`;

  const navHtml = navLinks.map(([href, label]) => {
    const active = (href === '/' ? currentPath === '/' : currentPath.startsWith(href.replace('.html',''))) ? 'active' : '';
    return `<a href="${href}" class="nav-link ${active}">${label}</a>`;
  }).join('') + tipsDropdown;

  const authHtml = user
    ? `<div class="user-avatar">
        <span class="odlt-chip" id="nav-odlt-chip" title="ODLT Tokens" onclick="location.href='/dashboard.html#tokens'" style="cursor:pointer">
          <span class="material-icons-round" style="font-size:13px;color:var(--primary)">toll</span>
          <span id="nav-odlt-bal">…</span>
        </span>
        <button class="avatar-btn">
          <div class="avatar-circle">${escapeHtml(user.name?.[0]?.toUpperCase() || 'U')}</div>
          <span>${escapeHtml(user.name?.split(' ')[0] || 'Account')}</span>
          ${isVip ? '<span class="badge badge-vip" style="font-size:9px">VIP</span>' : ''}
          <span>▾</span>
        </button>
        <div class="avatar-dropdown" id="avatar-dropdown">
          <a href="/dashboard.html"><span class="material-icons-round" style="font-size:16px">analytics</span> Dashboard</a>
          <a href="/dashboard.html#tokens"><span class="material-icons-round" style="font-size:16px">toll</span> ODLT Tokens</a>
          ${isAdmin ? '<a href="/admin/dashboard.html"><span class="material-icons-round" style="font-size:16px">admin_panel_settings</span> Admin Panel</a>' : ''}
          <hr>
          <button id="logout-btn"><span class="material-icons-round" style="font-size:16px">logout</span> Logout</button>
        </div>
      </div>`
    : `<a href="/pricing.html#login" class="btn btn-ghost btn-sm">Login</a>
       <a href="/pricing.html#register" class="btn btn-primary btn-sm">Register</a>`;

  // Load ODLT balance into nav chip after render
  if (user) setTimeout(async () => {
    try {
      const r = await fetch('/api/tokens/balance');
      const d = await r.json();
      const el = document.getElementById('nav-odlt-bal');
      if (el && d.success) el.textContent = (d.data?.balance ?? 0).toLocaleString() + ' ODLT';
    } catch {}
  }, 400);

  // Mobile bottom nav items
  const mobNavItems = [
    { href: '/', icon: 'home', label: 'Home' },
    { href: '/predictions.html', icon: 'sports_soccer', label: 'Tips' },
    { href: '/bet-builder.html', icon: 'construction', label: 'Builder' },
    { href: '/pricing.html', icon: 'workspace_premium', label: 'VIP', cls: 'vip-tab' },
    { href: user ? '/dashboard.html' : '/pricing.html#login', icon: user ? 'account_circle' : 'login', label: user ? 'Account' : 'Login' },
  ];
  const mobNavHtml = mobNavItems.map(n => {
    const active = (n.href === '/' ? currentPath === '/' : currentPath.startsWith(n.href.replace('.html',''))) ? 'active' : '';
    return `<a href="${n.href}" class="mob-nav-item ${n.cls||''} ${active}">
      <span class="material-icons-round">${n.icon}</span>
      <span>${n.label}</span>
    </a>`;
  }).join('');

  target.innerHTML = `
    <div class="ticker-wrap">
      <div class="container"><div class="ticker-inner">
        <span class="ticker-label">LIVE</span>
        <div class="ticker-track"></div>
      </div></div>
    </div>
    <div class="container">
      <div class="header-inner">
        <a href="/" class="site-logo">
          <img src="/images/logo.png" alt="Oddslander" onerror="this.style.display='none'">
          <span>Oddslander</span>
        </a>
        <nav class="main-nav" id="main-nav">${navHtml}</nav>
        <div class="header-actions">
          <button class="theme-toggle" id="theme-toggle-btn" title="Toggle theme">
            <span class="material-icons-round" id="theme-icon">${localStorage.getItem('ol_theme') === 'light' ? 'dark_mode' : 'light_mode'}</span>
          </button>
          ${authHtml}
        </div>
      </div>
    </div>
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Mobile navigation">
      <div class="mobile-bottom-nav-inner">${mobNavHtml}</div>
    </nav>`;

  // Attach events
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
  const avatarBtn = document.querySelector('.avatar-btn');
  if (avatarBtn) avatarBtn.addEventListener('click', toggleAvatarMenu);
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  initTicker();

  // Tips dropdown toggle (click for mobile, hover handled by CSS)
  document.querySelector('.nav-dropdown-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelector('.nav-dropdown')?.classList.toggle('open');
  });

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-avatar')) {
      document.getElementById('avatar-dropdown')?.classList.remove('open');
    }
    if (!e.target.closest('.nav-dropdown')) {
      document.querySelector('.nav-dropdown')?.classList.remove('open');
    }
  });
}

function toggleAvatarMenu() {
  document.getElementById('avatar-dropdown')?.classList.toggle('open');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ol_theme', next);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = next === 'light' ? 'dark_mode' : 'light_mode';
}

function toggleMobileMenu() {
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.toggle('mobile-open');
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  clearUser();
  window.location.href = '/';
}

// ── Footer ────────────────────────────────────────────────────────────────────
async function injectFooter() {
  const target = document.getElementById('footer-placeholder');
  if (!target) return;

  const [links, backlinksRes] = await Promise.all([
    fetchSocialLinks(),
    fetch('/api/backlinks/public').then(r=>r.json()).catch(()=>({ data: { backlinks: [] } })),
  ]);

  const backlinks = backlinksRes?.data?.backlinks || [];

  const socialIcons = {
    social_twitter:  { icon: '𝕏', label: 'X' },
    social_telegram: { icon: '✈', label: 'Telegram' },
    social_facebook: { icon: 'f', label: 'Facebook' },
    social_whatsapp: { icon: '📱', label: 'WhatsApp' },
  };
  const socialHtml = Object.entries(links).filter(([,v])=>v).map(([k,v]) => {
    const s = socialIcons[k] || { icon: '🔗', label: k };
    return `<a href="${escapeHtml(v)}" target="_blank" rel="noopener" class="footer-social-icon" title="${s.label}">${s.icon}</a>`;
  }).join('');

  const settings = window._siteSettings || {};
  const email     = settings.contact_email    || '';
  const whatsapp  = links.social_whatsapp     || '';
  const telegram  = links.social_telegram     || '';

  const backlinksSection = backlinks.length ? `
    <div class="footer-backlinks-row">
      <span class="footer-backlinks-label">Partner Sites:</span>
      ${backlinks.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener nofollow" class="footer-backlink">${escapeHtml(l.keyword)}</a>`).join('')}
    </div>` : '';

  target.innerHTML = `<footer class="site-footer">
    <div class="footer-main">
      <div class="container">
        <div class="footer-grid-new">

          <div class="footer-brand-col">
            <img src="/images/logo.png" alt="Oddslander" class="footer-logo" onerror="this.style.display='none'">
            <p class="footer-desc">Oddslander is an online service that provides the most accurate football prediction, soccer betting tips as well as news to its users.</p>
            <div class="footer-socials">${socialHtml}</div>
          </div>

          <div class="footer-links-col">
            <h4 class="footer-col-title">Business Links</h4>
            <a href="/pricing.html">VIP Packages</a>
            <a href="/predictions.html">Recent Winning</a>
            <a href="/about.html">About Us</a>
            <a href="/blog.html">Partners</a>
            <a href="/contact.html">Contact us</a>
          </div>

          <div class="footer-links-col">
            <h4 class="footer-col-title">Other Links</h4>
            <a href="/blog.html">Blog</a>
            <a href="/about.html#disclaimer">Disclaimer</a>
            <a href="/privacy.html">Privacy Policy</a>
            <a href="/terms.html">Terms and Conditions</a>
            <a href="#" onclick="event.preventDefault();openCookiePreferences()">Cookie Preferences</a>
          </div>

          <div class="footer-links-col">
            <h4 class="footer-col-title">Contact</h4>
            ${email ? `<span class="footer-contact-item"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></span>` : ''}
            ${whatsapp ? `<span class="footer-contact-item"><strong>WhatsApp:</strong> <a href="${escapeHtml(whatsapp)}" target="_blank">${escapeHtml(whatsapp.replace('https://wa.me/',''))}</a></span>` : ''}
            ${telegram ? `<span class="footer-contact-item"><strong>Telegram:</strong> <a href="${escapeHtml(telegram)}" target="_blank">Join Channel</a></span>` : ''}
            <span class="footer-contact-item" style="margin-top:10px;display:block">
              <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-soft)">Textlink/Guestpost Placement:</strong><br>
              <a href="/contact.html" style="color:var(--primary);font-weight:600">Contact via Telegram</a>
            </span>
          </div>

        </div>
      </div>
    </div>

    ${backlinks.length ? `<div class="footer-backlinks-wrap"><div class="container">${backlinksSection}</div></div>` : ''}

    <div class="footer-bottom-bar">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} Oddslander &bull; For entertainment only. Please gamble responsibly.</p>
        <div class="footer-bottom-socials">${socialHtml}</div>
      </div>
    </div>
  </footer>`;
}

// ── Ads Renderer ─────────────────────────────────────────────────────────────
async function renderAds(position, container) {
  if (!container) return;
  try {
    const r = await fetch(`/api/ads/position/${encodeURIComponent(position)}`);
    if (!r.ok) return;
    const data = await r.json();
    const ads = data?.data?.ads || [];
    if (!ads.length) { container.style.display = 'none'; return; }

    container.innerHTML = ads.map(ad => {
      if (ad.type === 'code') {
        return `<div class="ad-slot ad-code" data-id="${ad.id}">${ad.code}</div>`;
      }
      if (ad.type === 'native') {
        return `<a class="ad-slot ad-native" href="${ad.link_url||'#'}" target="_blank" rel="nofollow noopener" data-id="${ad.id}" onclick="trackAdClick(${ad.id})">
          ${ad.image_url ? `<img src="${ad.image_url}" alt="${ad.alt_text||'Sponsored'}" class="ad-native-img">` : ''}
          <div class="ad-native-body">
            <span class="ad-label">Sponsored</span>
            <p class="ad-native-name">${ad.name}</p>
          </div>
        </a>`;
      }
      if (ad.type === 'link') {
        return `<a class="ad-slot ad-link" href="${ad.link_url||'#'}" target="_blank" rel="nofollow noopener" data-id="${ad.id}" onclick="trackAdClick(${ad.id})">
          <span class="ad-label">Ad</span> ${ad.name}
        </a>`;
      }
      // banner (default)
      const style = [ad.width ? `width:${ad.width}px` : '', ad.height ? `height:${ad.height}px` : ''].filter(Boolean).join(';');
      return `<a class="ad-slot ad-banner" href="${ad.link_url||'#'}" target="_blank" rel="nofollow noopener" data-id="${ad.id}" onclick="trackAdClick(${ad.id})">
        <img src="${ad.image_url}" alt="${ad.alt_text||ad.name}" style="${style}" loading="lazy">
      </a>`;
    }).join('');
  } catch {}
}

function trackAdClick(id) {
  fetch(`/api/ads/${id}/click`, { method: 'POST' }).catch(() => {});
}

// ── AdSense Inject ────────────────────────────────────────────────────────────
async function injectAdSense() {
  try {
    const r = await fetch('/api/admin/settings');
    const data = await r.json();
    const clientId = data.data?.settings?.adsense_client_id;
    if (clientId) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      s.crossOrigin = 'anonymous';
      document.head.appendChild(s);
    }
  } catch {}
}

// ── Page Init ─────────────────────────────────────────────────────────────────
async function initPage() {
  await injectHeader();
  await injectFooter();
  injectAdSense();

  // Fetch auth state from server to sync localStorage
  try {
    const r = await fetch('/api/auth/me');
    if (r.ok) {
      const data = await r.json();
      if (data.data?.user) setUser(data.data.user);
    } else if (r.status === 401) {
      clearUser();
    }
  } catch {}
}

// ── Prediction Grid ───────────────────────────────────────────────────────────
async function loadPredictions(params = {}, container, append = false) {
  if (!container) return;
  const user = getUser();
  const isVip = user?.role === 'vip' || user?.role === 'admin';
  const qs = new URLSearchParams({ date: 'today', limit: 20, ...params }).toString();

  if (!append) {
    container.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px"></div>`.repeat(4);
  }

  try {
    const r = await fetch(`/api/predictions?${qs}`);
    const data = await r.json();
    const preds = data.data?.predictions || [];
    const pagination = data.data?.pagination || {};

    if (!preds.length && !append) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon"><span class="material-icons-round" style="font-size:48px">sports_soccer</span></div><h3>No predictions yet</h3><p>Check back soon for today's tips</p></div>`;
      return pagination;
    }

    const html = preds.map(p => buildPredictionCard(p, isVip)).join('');
    if (append) container.insertAdjacentHTML('beforeend', html);
    else container.innerHTML = html;
    return pagination;
  } catch (err) {
    if (!append) container.innerHTML = `<p class="text-soft text-center" style="grid-column:1/-1">Failed to load predictions</p>`;
    return {};
  }
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

// ─── Cookie Consent ──────────────────────────────────────────────────────────
(function () {
  const COOKIE_KEY = 'ol_cookie_consent';

  function getConsent() {
    try { return JSON.parse(localStorage.getItem(COOKIE_KEY)); } catch { return null; }
  }
  function saveConsent(analytics) {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ analytics, ts: Date.now() }));
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #ol-cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:var(--bg-card,#0d2233);border-top:1px solid rgba(2,245,161,0.18);padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 -4px 24px rgba(0,0,0,0.4)}
      #ol-cookie-banner p{margin:0;font-size:13px;color:var(--text-soft,#addff1);flex:1;min-width:200px}
      #ol-cookie-banner a{color:var(--primary,#02f5a1);text-decoration:underline}
      .ol-cb-btns{display:flex;gap:10px;flex-wrap:wrap}
      .ol-cb-btns button{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;white-space:nowrap}
      .ol-btn-manage{background:transparent;border:1px solid rgba(173,223,241,0.3)!important;color:var(--text,#e8f4f8)}
      .ol-btn-reject{background:rgba(173,223,241,0.08);color:var(--text-soft,#addff1)}
      .ol-btn-accept{background:var(--primary,#02f5a1);color:#07191e}
      #ol-cookie-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px}
      #ol-cookie-modal{background:var(--bg-card,#0d2233);border:1px solid rgba(2,245,161,0.18);border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.6)}
      #ol-cookie-modal .cm-head{padding:24px 24px 0;display:flex;align-items:center;gap:14px;border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:16px}
      #ol-cookie-modal .cm-head img{height:36px;object-fit:contain}
      #ol-cookie-modal .cm-head h2{margin:0;font-size:18px;font-weight:800;color:var(--text,#e8f4f8)}
      #ol-cookie-modal .cm-body{padding:20px 24px}
      #ol-cookie-modal .cm-body p{font-size:13px;color:var(--text-soft,#addff1);margin:0 0 16px;line-height:1.7}
      #ol-cookie-modal .cm-body a{color:var(--primary,#02f5a1)}
      .cm-cookie-row{border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 16px;margin-bottom:12px}
      .cm-cookie-row h4{margin:0 0 4px;font-size:14px;font-weight:700;color:var(--text,#e8f4f8);display:flex;justify-content:space-between;align-items:center}
      .cm-cookie-row p{margin:0;font-size:12px;color:var(--text-soft,#addff1);line-height:1.6}
      .cm-badge-on{font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;background:rgba(2,245,161,0.15);color:var(--primary,#02f5a1)}
      .cm-toggle{position:relative;width:40px;height:22px;flex-shrink:0}
      .cm-toggle input{opacity:0;width:0;height:0;position:absolute}
      .cm-toggle-slider{position:absolute;inset:0;border-radius:22px;background:rgba(255,255,255,0.1);cursor:pointer;transition:.3s}
      .cm-toggle input:checked+.cm-toggle-slider{background:var(--primary,#02f5a1)}
      .cm-toggle-slider::before{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;bottom:3px;left:3px;transition:.3s}
      .cm-toggle input:checked+.cm-toggle-slider::before{transform:translateX(18px)}
      #ol-cookie-modal .cm-footer{padding:16px 24px 24px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.07)}
      #ol-cookie-modal .cm-footer button{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;border:none}
    `;
    document.head.appendChild(s);
  }

  function showBanner() {
    const banner = document.createElement('div');
    banner.id = 'ol-cookie-banner';
    banner.innerHTML = `
      <p>We use cookies to keep Oddslander running and to improve your experience with personalised football tips. <a href="/privacy.html">Privacy Policy</a></p>
      <div class="ol-cb-btns">
        <button class="ol-btn-manage" id="ol-manage-btn">Manage Cookies</button>
        <button class="ol-btn-reject" id="ol-reject-btn">Reject Optional</button>
        <button class="ol-btn-accept" id="ol-accept-btn">Accept All</button>
      </div>`;
    document.body.appendChild(banner);
    document.getElementById('ol-accept-btn').addEventListener('click', () => { saveConsent(true); banner.remove(); });
    document.getElementById('ol-reject-btn').addEventListener('click', () => { saveConsent(false); banner.remove(); });
    document.getElementById('ol-manage-btn').addEventListener('click', () => { banner.remove(); showModal(); });
  }

  function showModal() {
    const overlay = document.createElement('div');
    overlay.id = 'ol-cookie-overlay';
    overlay.innerHTML = `
      <div id="ol-cookie-modal">
        <div class="cm-head">
          <img src="/images/logo.png" alt="Oddslander">
          <h2>Cookie Preferences</h2>
        </div>
        <div class="cm-body">
          <p>Oddslander uses cookies to deliver accurate football predictions, keep your account secure, and improve the tips we show you. Choose which cookies you're happy with below.</p>

          <div class="cm-cookie-row">
            <h4>Essential Cookies <span class="cm-badge-on">Always On</span></h4>
            <p>Required for the site to function — login sessions, security, and displaying predictions. These cannot be disabled.</p>
          </div>

          <div class="cm-cookie-row">
            <h4>Analytics Cookies
              <label class="cm-toggle"><input type="checkbox" id="cm-analytics-chk"><span class="cm-toggle-slider"></span></label>
            </h4>
            <p>Help us understand which predictions users find most useful, which leagues are most popular, and how to improve our intelligence engine's accuracy.</p>
          </div>

          <div class="cm-cookie-row">
            <h4>Personalisation Cookies
              <label class="cm-toggle"><input type="checkbox" id="cm-personal-chk"><span class="cm-toggle-slider"></span></label>
            </h4>
            <p>Remember your favourite leagues, preferred markets (e.g. Over/Under vs 1X2), and date filters so your predictions list is always relevant.</p>
          </div>

          <p style="font-size:12px;margin-top:4px">You can update these preferences at any time from the site footer. See our <a href="/privacy.html">Privacy Policy</a> for full details.</p>
        </div>
        <div class="cm-footer">
          <button id="cm-reject-btn" style="background:rgba(173,223,241,0.08);color:var(--text-soft,#addff1)">Reject Optional</button>
          <button id="cm-save-btn" style="background:rgba(2,245,161,0.12);color:var(--primary,#02f5a1)">Save Preferences</button>
          <button id="cm-accept-btn" style="background:var(--primary,#02f5a1);color:#07191e">Accept All</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const consent = getConsent();
    if (consent?.analytics) {
      document.getElementById('cm-analytics-chk').checked = true;
      document.getElementById('cm-personal-chk').checked = true;
    }

    document.getElementById('cm-accept-btn').addEventListener('click', () => { saveConsent(true); overlay.remove(); });
    document.getElementById('cm-reject-btn').addEventListener('click', () => { saveConsent(false); overlay.remove(); });
    document.getElementById('cm-save-btn').addEventListener('click', () => {
      const analytics = document.getElementById('cm-analytics-chk').checked || document.getElementById('cm-personal-chk').checked;
      saveConsent(analytics);
      overlay.remove();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  window.openCookiePreferences = showModal;

  injectStyles();
  if (!getConsent()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
    else showBanner();
  }
})();
