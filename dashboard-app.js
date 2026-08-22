/* ═══════════════════════════════════════════════════════════════
   Neo Integrations — Client Dashboard Application Logic
   Router · Renderers · Animations · Interactions
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  /* ── Auth Guard ──────────────────────────────────────────── */
  const authRaw = sessionStorage.getItem('neo_auth') || localStorage.getItem('neo_auth');
  let auth = null;
  try { auth = authRaw ? JSON.parse(authRaw) : null; } catch(e) {}
  if (!auth || !auth.token || auth.exp < Date.now()) {
    window.location.replace('login.html');
    return;
  }

  // Populate user info
  const avatarInitials = auth.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const topbarAvatar = document.getElementById('topbar-avatar');
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarAvatar) sidebarAvatar.textContent = avatarInitials;
  if (topbarAvatar) topbarAvatar.textContent = avatarInitials;
  if (sidebarUsername) sidebarUsername.textContent = auth.user.name;

  /* ── DOM Refs ────────────────────────────────────────────── */
  const contentEl   = document.getElementById('dash-content');
  const titleEl     = document.getElementById('topbar-title');
  const sidebar     = document.getElementById('dash-sidebar');
  const overlay     = document.getElementById('sidebar-overlay');
  const hamburger   = document.getElementById('topbar-hamburger');
  const drawerEl    = document.getElementById('lead-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerClose = document.getElementById('drawer-close');
  const drawerBody  = document.getElementById('drawer-body');
  const drawerName  = document.getElementById('drawer-lead-name');
  const drawerMeta  = document.getElementById('drawer-lead-meta');
  const drawerTabs  = document.getElementById('drawer-tabs');

  /* ── Data refs ───────────────────────────────────────────── */
  const D = DashboardData;

  /* ── State ───────────────────────────────────────────────── */
  let currentSection = 'overview';
  let leadSortKey = 'capturedRaw';
  let leadSortDir = 'desc';
  let leadFilterStatus = 'all';
  let leadFilterSource = 'all';
  let leadSearchQuery = '';
  let visitFilterStatus = 'all';

  /* ── Section Titles ──────────────────────────────────────── */
  const TITLES = {
    overview: 'Overview',
    leads: 'Lead Management',
    visits: 'Site Visits',
    followups: 'Follow-up Sequences',
    escalations: 'Escalation Queue',
    team: 'Team Performance',
    channels: 'Channel Analytics',
    briefing: 'Daily Briefing',
    aihealth: 'AI & NeoIntegration Health',
    settings: 'Settings & Integrations',
  };

  /* ── Utilities ───────────────────────────────────────────── */
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function escAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function statusClass(status) {
    const map = {
      'New': 's-new', 'Qualified': 's-qualified', 'Hot': 's-hot',
      'Visit Booked': 's-visit-booked', 'Follow-up': 's-follow-up',
      'Cold': 's-cold', 'Closed': 's-closed',
    };
    return map[status] || 's-new';
  }

  function scoreClass(score) {
    if (score >= 70) return 'score-high';
    if (score >= 40) return 'score-med';
    return 'score-low';
  }

  function sourceColor(source) {
    const map = { 'WhatsApp':'#25D366','Instagram':'#E1306C','Facebook':'#1877F2','Website':'#6366F1','Email':'#8B5CF6','Manual':'#64748B' };
    return map[source] || '#64748B';
  }

  function sparklineSVG(data, color, w, h) {
    if (!data || !data.length) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => ({
      x: (i / Math.max(data.length - 1, 1)) * w,
      y: h - ((v - min) / range) * (h * 0.7) - h * 0.12,
    }));
    let d = 'M ' + pts[0].x + ' ' + pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      const mid = (pts[i - 1].x + pts[i].x) / 2;
      d += ' C ' + mid + ' ' + pts[i - 1].y + ', ' + mid + ' ' + pts[i].y + ', ' + pts[i].x + ' ' + pts[i].y;
    }
    const gid = 'sp' + color.replace('#', '') + String(w) + String(h);
    return `<svg viewBox="0 0 ${w} ${h}" class="kpi-sparkline" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${gid}edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
          <stop offset="12%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="88%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <mask id="${gid}m"><rect width="${w}" height="${h}" fill="url(#${gid}edge)"/></mask>
      </defs>
      <g mask="url(#${gid}m)">
        <path class="spark-fill" d="${d} L ${w} ${h} L 0 ${h} Z" fill="url(#${gid})"/>
        <path class="spark-line" pathLength="100" d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>`;
  }

  function initials(name) {
    return String(name || '')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  /* ── Count-Up Animation ──────────────────────────────────── */
  function countUp(el, target, duration) {
    if (!el) return;
    const end = Number(target);
    if (!Number.isFinite(end)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(target).includes('.') ? end.toFixed(1) : String(Math.round(end));
      return;
    }
    el.textContent = '0';
    duration = duration || 780;
    const start = performance.now();
    const isFloat = String(target).includes('.');
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      const val = eased * end;
      el.textContent = isFloat ? val.toFixed(1) : String(Math.round(val));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = isFloat ? end.toFixed(1) : String(Math.round(end));
    }
    requestAnimationFrame(step);
  }

  /* ── Staggered Row Animation ─────────────────────────────── */
  function applyRowStagger() {
    if (contentEl.querySelector('.leads-table')) return;
    const rows = contentEl.querySelectorAll('.data-table tbody tr');
    rows.forEach((row, i) => {
      row.style.animationDelay = `${i * 0.02}s`;
    });
  }

  function shortCaptured(s) {
    return String(s || '').replace(/\s20\d{2}\s/, ' · ').replace(/\b0(\d:)/, '$1');
  }

  /* ── SLA Timer ───────────────────────────────────────────── */
  let slaIntervals = [];
  function clearSLATimers() {
    slaIntervals.forEach(id => clearInterval(id));
    slaIntervals = [];
  }

  function startSLATimers() {
    clearSLATimers();
    const timers = contentEl.querySelectorAll('.sla-timer[data-minutes]');
    timers.forEach(el => {
      let totalSec = parseInt(el.dataset.minutes) * 60;
      const update = () => {
        totalSec++;
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (m >= 30) el.classList.add('critical');
      };
      update();
      slaIntervals.push(setInterval(update, 1000));
    });
  }

  /* ══════════════════════════════════════════════════════════
     SECTION RENDERERS
     ══════════════════════════════════════════════════════════ */

  /* ── KPI Overview ────────────────────────────────────────── */
  function renderOverview() {
    const K = D.MOCK_KPIS;
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Operations Overview</h1>
            <p class="section-header-sub"><span class="live-dot" aria-hidden="true"></span>Live snapshot of your sales pipeline</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-top">
              <div class="kpi-label">Total Leads Today</div>
              <span class="kpi-delta up">↑ 12%</span>
            </div>
            <div class="kpi-value" data-countup="${K.totalLeads.today}">${K.totalLeads.today}</div>
            ${sparklineSVG(K.sparklines.leadsWeekly, '#6e79f2', 240, 40)}
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <div class="kpi-label">New Last 24h</div>
              <span class="kpi-delta up">↑ 8%</span>
            </div>
            <div class="kpi-value" data-countup="${K.newLast24h.total}">${K.newLast24h.total}</div>
            ${sparklineSVG(K.sparklines.leadsWeekly, '#9aa2ff', 240, 40)}
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <div class="kpi-label">Hot Leads</div>
              <span class="kpi-delta warn">Needs attention</span>
            </div>
            <div class="kpi-value" data-countup="${K.hotLeads}" style="color: var(--dash-amber);">${K.hotLeads}</div>
            ${sparklineSVG(K.sparklines.hotWeekly, '#f5a524', 240, 40)}
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <div class="kpi-label">Unattended Escalations</div>
              <span class="kpi-delta down">Respond now</span>
            </div>
            <div class="kpi-value" data-countup="${K.unattendedEscalations}" style="color: var(--dash-red);">${K.unattendedEscalations}</div>
            ${sparklineSVG(K.sparklines.hotWeekly, '#f87171', 240, 40)}
          </div>
        </div>

        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Lead Sources — Last 24 Hours</span>
            <span class="dash-card-action" onclick="DashApp.navigate('channels')">View all channels →</span>
          </div>
          <div class="source-grid">
            ${K.newLast24h.bySrc.map((s, i) => {
              const max = Math.max(...K.newLast24h.bySrc.map((x) => x.count));
              return `
              <div class="source-item" style="--d:${i * 45}ms">
                <div class="source-row">
                  <div class="source-icon" style="background: ${s.color}22; color: ${s.color};">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${s.color}" stroke-width="1.5">${sourceIconPath(s.icon)}</svg>
                  </div>
                  <div class="source-meta">
                    <div class="source-name">${esc(s.source)}</div>
                    <div class="source-count" data-countup="${s.count}">${s.count}</div>
                  </div>
                </div>
                <div class="source-bar" aria-hidden="true"><i style="width:${(s.count / max) * 100}%;background:${s.color}"></i></div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="wide-grid-2">
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Site Visits</span>
              <span class="dash-card-action" onclick="DashApp.navigate('visits')">View all →</span>
            </div>
            <div class="visit-metrics">
              <div>
                <div class="visit-metric-val" data-countup="${K.siteVisits.today}">${K.siteVisits.today}</div>
                <div class="visit-metric-label">Today</div>
              </div>
              <div>
                <div class="visit-metric-val" data-countup="${K.siteVisits.week}">${K.siteVisits.week}</div>
                <div class="visit-metric-label">This Week</div>
              </div>
            </div>
            <div class="visit-list">
              ${D.MOCK_VISITS.slice(0, 3).map(v => `
                <div class="visit-item">
                  <div class="visit-time">${esc(v.time)}</div>
                  <div class="visit-info">
                    <div class="visit-lead" title="${escAttr(v.leadName)}">${esc(v.leadName)}</div>
                    <div class="visit-prop" title="${escAttr(v.property)}">${esc(v.property)}</div>
                  </div>
                  <span class="visit-status ${v.status}" title="${escAttr(v.status)}">${esc(v.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="dash-card rt-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Avg Response Time</span>
              <span class="kpi-delta up">↓ ${Math.abs(K.avgResponseTime.delta)}%</span>
            </div>
            <div class="rt-layout">
              <div class="rt-ring" style="--rt:${Math.round((1 - Math.min(K.avgResponseTime.seconds / 90, 0.92)) * 100)}">
                <svg viewBox="0 0 80 80" aria-hidden="true">
                  <circle class="rt-track" cx="40" cy="40" r="31"></circle>
                  <circle class="rt-arc" pathLength="100" cx="40" cy="40" r="31"></circle>
                </svg>
                <div class="rt-ring-label"><strong data-countup="42">42</strong><span>s</span></div>
              </div>
              <div class="rt-copy">
                <p class="gauge-sublabel">Lead capture → First Ira reply</p>
                <p class="rt-hint">Median across every channel · last 24 hours</p>
              </div>
            </div>
            ${sparklineSVG(K.sparklines.responseWeekly, '#6e79f2', 320, 44)}
          </div>
        </div>

        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Conversion Funnel — This Month</span>
          </div>
          <div class="funnel-row">
            ${K.funnel.map((s, i) => `
              <div class="funnel-stage" style="--h:${Math.max(28, s.pct)}%;--d:${i * 70}ms">
                <div class="funnel-bar">
                  <div class="funnel-count" data-countup="${s.count}">${s.count}</div>
                </div>
                <div class="funnel-meta">
                  <div class="funnel-label">${esc(s.stage)}</div>
                  <div class="funnel-pct">${s.pct}%</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Follow-up Health + Escalations Quick View -->
        <div class="wide-grid-2">
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Follow-up Sequence Health</span>
              <span class="dash-card-action" onclick="DashApp.navigate('followups')">Details →</span>
            </div>
            <div class="donut-wrap">
              ${donutSVG(K.followUpHealth.activeInDrip, K.followUpHealth.cold)}
              <div class="donut-legend">
                <div class="donut-legend-item"><span class="donut-legend-dot" style="background:var(--dash-accent);"></span> Active in drip: <strong style="color:var(--dash-text);margin-left:4px;">${K.followUpHealth.activeInDrip}</strong></div>
                <div class="donut-legend-item"><span class="donut-legend-dot" style="background:var(--dash-text-4);"></span> Gone cold: <strong style="color:var(--dash-text);margin-left:4px;">${K.followUpHealth.cold}</strong></div>
              </div>
            </div>
          </div>
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Active Escalations</span>
              <span class="dash-card-action" onclick="DashApp.navigate('escalations')">View queue →</span>
            </div>
            ${D.MOCK_ESCALATIONS.slice(0, 2).map(e => `
              <div class="escalation-item ${e.priority}">
                <div class="escalation-info">
                  <div class="escalation-name" title="${escAttr(e.leadName)}">${esc(e.leadName)}</div>
                  <div class="escalation-reason" title="${escAttr(e.reason)}">${esc(e.reason)}</div>
                </div>
                <div class="escalation-sla">
                  <div class="sla-timer${e.slaMinutes < 10 ? ' critical' : ''}" data-minutes="${e.slaMinutes}">00:00</div>
                  <div class="sla-label">Elapsed</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Trigger count-up animations
    contentEl.querySelectorAll('[data-countup]').forEach(el => {
      countUp(el, parseFloat(el.dataset.countup));
    });

    startSLATimers();
  }

  /* ── Lead Management Table ───────────────────────────────── */
  function renderLeads() {
    let leads = [...D.MOCK_LEADS];

    // Filter
    if (leadFilterStatus !== 'all') leads = leads.filter(l => l.status === leadFilterStatus);
    if (leadFilterSource !== 'all') leads = leads.filter(l => l.source === leadFilterSource);
    if (leadSearchQuery) {
      const q = leadSearchQuery.toLowerCase();
      leads = leads.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.email.toLowerCase().includes(q));
    }

    // Sort
    leads.sort((a, b) => {
      let va = a[leadSortKey], vb = b[leadSortKey];
      if (typeof va === 'number') return leadSortDir === 'asc' ? va - vb : vb - va;
      va = String(va); vb = String(vb);
      return leadSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    contentEl.innerHTML = `
      <div class="dash-section leads-page">
        <div class="table-container leads-table-wrap">
          <div class="table-toolbar">
            <div class="table-filters" role="tablist">
              <button class="table-filter-btn ${leadFilterStatus==='all'?'active':''}" data-filter-status="all">All</button>
              ${['New','Qualified','Hot','Visit Booked','Follow-up','Cold','Closed'].map(s =>
                `<button class="table-filter-btn ${leadFilterStatus===s?'active':''}" data-filter-status="${s}">${s}</button>`
              ).join('')}
            </div>
            <div class="table-toolbar-right">
              <div class="table-search">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Filter this list…" id="lead-search" value="${esc(leadSearchQuery)}" />
              </div>
              <div class="table-count"><strong>${leads.length}</strong></div>
            </div>
          </div>
          <div class="table-scroll">
            <table class="data-table leads-table" id="leads-table">
              <colgroup>
                <col class="col-name" />
                <col class="col-source" />
                <col class="col-captured" />
                <col class="col-status" />
                <col class="col-score" />
                <col class="col-budget" />
                <col class="col-loc" />
                <col class="col-type" />
                <col class="col-time" />
                <col class="col-rep" />
                <col class="col-fu" />
              </colgroup>
              <thead>
                <tr>
                  <th class="${leadSortKey==='name'?'sorted':''}${leadSortDir==='desc'?' desc':''}" data-sort="name">Name <span class="th-sort-icon">▲</span></th>
                  <th class="${leadSortKey==='source'?'sorted':''}${leadSortDir==='desc'?' desc':''}" data-sort="source">Source <span class="th-sort-icon">▲</span></th>
                  <th class="${leadSortKey==='capturedRaw'?'sorted':''}${leadSortDir==='desc'?' desc':''}" data-sort="capturedRaw">Captured <span class="th-sort-icon">▲</span></th>
                  <th class="${leadSortKey==='status'?'sorted':''}${leadSortDir==='desc'?' desc':''}" data-sort="status">Status <span class="th-sort-icon">▲</span></th>
                  <th class="${leadSortKey==='score'?'sorted':''}${leadSortDir==='desc'?' desc':''}" data-sort="score">Score <span class="th-sort-icon">▲</span></th>
                  <th data-sort="budget">Budget</th>
                  <th data-sort="location">Location</th>
                  <th data-sort="propertyType">Type</th>
                  <th data-sort="timeline">Timeline</th>
                  <th data-sort="assignedRep">Rep</th>
                  <th data-sort="nextFollowUpRaw">Next</th>
                </tr>
              </thead>
              <tbody>
                ${leads.length === 0 ? `
                  <tr>
                    <td colspan="11">
                      <div class="os-empty">
                        <strong>No leads match</strong>
                        Try another status or search.
                      </div>
                    </td>
                  </tr>` : ''}
                ${leads.map(l => `
                  <tr data-lead-id="${l.id}" class="lead-row">
                    <td title="${escAttr(l.name + ' · ' + l.phone)}">
                      <div class="lead-name-cell">
                        <span class="lead-avatar">${esc(initials(l.name))}</span>
                        <div class="lead-name-text">
                          <span class="lead-name-primary" title="${escAttr(l.name)}">${esc(l.name)}</span>
                          <span class="lead-name-phone" title="${escAttr(l.phone)}">${esc(l.phone)}</span>
                        </div>
                      </div>
                    </td>
                    <td title="${escAttr(l.source)}">
                      <span class="source-tag">
                        <span class="source-tag-dot" style="background:${sourceColor(l.source)};"></span>
                        ${esc(l.source)}
                      </span>
                    </td>
                    <td class="cell-meta cell-captured" title="${escAttr(shortCaptured(l.captured))}">${esc(shortCaptured(l.captured))}</td>
                    <td title="${escAttr(l.status)}"><span class="status-pill ${statusClass(l.status)}"><i></i>${esc(l.status)}</span></td>
                    <td title="${escAttr(String(l.score))}"><span class="score-badge ${scoreClass(l.score)}">${l.score}</span></td>
                    <td class="cell-meta" title="${escAttr(l.budget)}">${esc(l.budget)}</td>
                    <td class="cell-meta" title="${escAttr(l.location)}">${esc(l.location)}</td>
                    <td class="cell-meta" title="${escAttr(l.propertyType)}">${esc(l.propertyType)}</td>
                    <td class="cell-meta" title="${escAttr(l.timeline)}">${esc(l.timeline)}</td>
                    <td class="cell-meta" title="${escAttr(l.assignedRep)}">${esc(l.assignedRep)}</td>
                    <td title="${escAttr(l.nextFollowUp)}">
                      <div class="cell-next">
                        <span class="cell-meta">${esc(l.nextFollowUp)}</span>
                        <button class="row-open" type="button" title="Open lead" onclick="event.stopPropagation();DashApp.openLead('${l.id}')">
                          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    applyRowStagger();

    // Event: sort
    contentEl.querySelectorAll('.data-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (leadSortKey === key) leadSortDir = leadSortDir === 'asc' ? 'desc' : 'asc';
        else { leadSortKey = key; leadSortDir = 'asc'; }
        renderLeads();
      });
    });

    // Event: filter status
    contentEl.querySelectorAll('[data-filter-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        leadFilterStatus = btn.dataset.filterStatus;
        renderLeads();
      });
    });

    // Event: search
    const searchInput = document.getElementById('lead-search');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        leadSearchQuery = searchInput.value;
        renderLeads();
      }, 250));
    }

    // Event: row click
    contentEl.querySelectorAll('.lead-row').forEach(row => {
      row.addEventListener('click', () => DashApp.openLead(row.dataset.leadId));
    });
  }

  /* ── Site Visits ─────────────────────────────────────────── */
  function leadIdForName(name) {
    const lead = D.MOCK_LEADS.find(l => l.name === name);
    return lead ? lead.id : '';
  }

  function splitVisitProp(property) {
    const i = String(property).indexOf(',');
    if (i === -1) return { type: property, loc: '' };
    return { type: property.slice(0, i).trim(), loc: property.slice(i + 1).trim() };
  }

  function renderVisits() {
    const all = D.MOCK_VISITS;
    const visits = visitFilterStatus === 'all' ? all : all.filter(v => v.status === visitFilterStatus);
    const groups = [];
    const seen = new Set();
    ['Today', 'Tomorrow'].forEach(label => {
      const items = visits.filter(v => v.date === label);
      if (items.length) { groups.push({ label, items }); seen.add(label); }
    });
    visits.forEach(v => {
      if (seen.has(v.date)) return;
      const existing = groups.find(g => g.label === v.date);
      if (existing) existing.items.push(v);
      else groups.push({ label: v.date, items: [v] });
      seen.add(v.date);
    });

    const countFor = (s) => all.filter(v => s === 'all' || v.status === s).length;
    const pendingRemind = all.filter(v => !v.reminderSent).length;
    const spark = D.MOCK_KPIS.sparklines.visitsWeekly;

    const rowHTML = (v, last) => {
      const prop = splitVisitProp(v.property);
      const leadId = leadIdForName(v.leadName);
      return `
        <button type="button" class="vs-row${last ? ' is-last' : ''}" data-lead-id="${esc(leadId)}" ${leadId ? '' : 'disabled'}>
          <div class="vs-time">
            <i class="vs-rail" aria-hidden="true"></i>
            <span>${esc(v.time)}</span>
          </div>
          <div class="vs-avatar">${esc(initials(v.leadName))}</div>
          <div class="vs-body">
            <div class="vs-name" title="${escAttr(v.leadName)}">${esc(v.leadName)}</div>
            <div class="vs-meta">
              <span>${esc(prop.type)}</span>
              ${prop.loc ? `<span>${esc(prop.loc)}</span>` : ''}
            </div>
          </div>
          <div class="vs-rep" title="${escAttr(v.rep)}">
            <span class="vs-rep-av">${esc(initials(v.rep))}</span>
            <span>${esc(v.rep)}</span>
          </div>
          <div class="vs-flags">
            <span class="visit-status ${v.status}" title="${escAttr(v.status)}">${esc(v.status)}</span>
            <span class="vs-remind ${v.reminderSent ? 'is-on' : 'is-off'}">${v.reminderSent ? 'Reminded' : 'No reminder'}</span>
          </div>
        </button>`;
    };

    contentEl.innerHTML = `
      <div class="dash-section visits-page">
        <div class="vs-metrics">
          <div class="vs-metric">
            <div class="vs-metric-top">
              <span class="vs-metric-label">Today</span>
              <span class="vs-metric-hint">On the board</span>
            </div>
            <div class="vs-metric-val" data-countup="${D.MOCK_KPIS.siteVisits.today}">${D.MOCK_KPIS.siteVisits.today}</div>
          </div>
          <div class="vs-metric">
            <div class="vs-metric-top">
              <span class="vs-metric-label">This week</span>
              <span class="vs-metric-hint">7-day volume</span>
            </div>
            <div class="vs-metric-val" data-countup="${D.MOCK_KPIS.siteVisits.week}">${D.MOCK_KPIS.siteVisits.week}</div>
            ${sparklineSVG(spark, '#6e79f2', 200, 28)}
          </div>
          <div class="vs-metric">
            <div class="vs-metric-top">
              <span class="vs-metric-label">Confirmation</span>
              <span class="vs-metric-hint">${pendingRemind} reminders open</span>
            </div>
            <div class="vs-metric-val is-good">83%</div>
            <div class="vs-rate" aria-hidden="true"><i style="width:83%"></i></div>
          </div>
        </div>

        <div class="vs-board">
          <div class="vs-toolbar">
            <div class="table-filters" role="tablist">
              ${[
                ['all', 'All'],
                ['confirmed', 'Confirmed'],
                ['pending', 'Pending'],
                ['rescheduled', 'Rescheduled'],
              ].map(([key, label]) => `
                <button class="table-filter-btn ${visitFilterStatus===key?'active':''}" data-visit-filter="${key}">${label} <em>${countFor(key)}</em></button>
              `).join('')}
            </div>
            <div class="vs-toolbar-count">${visits.length} scheduled</div>
          </div>
          ${visits.length === 0 ? `
            <div class="os-empty">
              <strong>No visits in this filter</strong>
              Switch status to see the rest of the board.
            </div>` : groups.map(g => `
            <div class="vs-group">
              <div class="vs-group-h">
                <span>${esc(g.label)}</span>
                <i>${g.items.length}</i>
              </div>
              <div class="vs-rows">
                ${g.items.map((v, i) => rowHTML(v, i === g.items.length - 1)).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    `;

    contentEl.querySelectorAll('[data-countup]').forEach(el => countUp(el, parseFloat(el.dataset.countup)));
    contentEl.querySelectorAll('[data-visit-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        visitFilterStatus = btn.dataset.visitFilter;
        renderVisits();
      });
    });
    contentEl.querySelectorAll('.vs-row[data-lead-id]').forEach(row => {
      if (!row.dataset.leadId) return;
      row.addEventListener('click', () => DashApp.openLead(row.dataset.leadId));
    });
  }

  /* ── Follow-up Sequences ─────────────────────────────────── */
  function renderFollowups() {
    const F = D.MOCK_FOLLOWUPS;
    const maxActive = Math.max(...F.days.map(d => d.active));
    const totalActive = F.days.reduce((n, d) => n + d.active, 0);
    const totalReplied = F.days.reduce((n, d) => n + d.replied, 0);
    const replyRate = totalActive ? Math.round((totalReplied / totalActive) * 100) : 0;
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Follow-up Sequence Tracker</h1>
            <p class="section-header-sub">14-day drip pipeline — leads approaching Day 14 highlighted</p>
          </div>
        </div>
        <div class="fu-metrics">
          <div class="vs-metric">
            <div class="vs-metric-top"><span class="vs-metric-label">In sequence</span><span class="vs-metric-hint">across 14 days</span></div>
            <div class="vs-metric-val">${totalActive}</div>
          </div>
          <div class="vs-metric">
            <div class="vs-metric-top"><span class="vs-metric-label">Replied</span><span class="vs-metric-hint">total responses</span></div>
            <div class="vs-metric-val">${totalReplied}</div>
          </div>
          <div class="vs-metric">
            <div class="vs-metric-top"><span class="vs-metric-label">Reply rate</span><span class="vs-metric-hint">${F.approachingDay14.length} need a decision</span></div>
            <div class="vs-metric-val is-good">${replyRate}%</div>
            <div class="vs-rate"><i style="width:${replyRate}%;"></i></div>
          </div>
        </div>

        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Active Leads per Day</span>
            <span class="fu-legend">
              <span class="fu-key"><i class="k-run"></i>Day 1–11</span>
              <span class="fu-key"><i class="k-warn"></i>Day 12–14 · decision window</span>
            </span>
          </div>
          <div class="followup-pipeline">
            ${F.days.map((d, i) => `
              <div class="followup-bar${d.day >= 12 ? ' warning' : ''}" style="height:${Math.max(8, (d.active/maxActive)*100)}%;--d:${i * 45}ms;" title="Day ${d.day}: ${d.active} active, ${d.replied} replied">
                <span class="followup-bar-val">${d.active}</span>
                <div class="followup-bar-label">D${d.day}</div>
              </div>
            `).join('')}
          </div>
          <div style="height:28px;"></div>
        </div>
        <div class="dash-card">
          <div class="dash-card-header">
            <span class="dash-card-title">Approaching Day 14 — Needs Decision</span>
            <span class="status-pill s-hot">Action Required</span>
          </div>
          ${F.approachingDay14.map(l => `
            <div class="escalation-item high">
              <div class="escalation-info">
                <div class="escalation-name" title="${escAttr(l.leadName)}">${esc(l.leadName)}</div>
                <div class="escalation-reason" title="${escAttr('Day ' + l.currentDay + ' · Last reply: ' + l.lastReply)}">Day ${l.currentDay} · Last reply: ${esc(l.lastReply)}</div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="table-filter-btn" style="font-size:11px;padding:4px 10px;">Restart</button>
                <button class="table-filter-btn" style="font-size:11px;padding:4px 10px;border-color:var(--dash-red);color:var(--dash-red);">Stop</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Escalation Queue ────────────────────────────────────── */
  function renderEscalations() {
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Escalation Queue</h1>
            <p class="section-header-sub">Leads flagged for human attention — SLA timers are live</p>
          </div>
        </div>
        <div class="dash-card">
          ${D.MOCK_ESCALATIONS.map(e => `
            <div class="escalation-item ${e.priority}">
              <div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;">
                <div class="escalation-name" title="${escAttr(e.leadName)}">${esc(e.leadName)}</div>
                <div class="escalation-reason" title="${escAttr(e.reason)}">${esc(e.reason)}</div>
                <div style="display:flex;gap:6px;margin-top:4px;">
                  <span class="status-pill s-escalation" style="font-size:10px;padding:1px 8px;">${esc(e.priority)}</span>
                  <span class="source-tag" style="font-size:11px;"><span class="source-tag-dot" style="background:${sourceColor(e.channel)};"></span>${esc(e.channel)}</span>
                </div>
              </div>
              <div class="escalation-sla">
                <div class="sla-timer${e.slaMinutes < 10 ? ' critical' : ''}" data-minutes="${e.slaMinutes}">00:00</div>
                <div class="sla-label">Elapsed</div>
              </div>
              <div class="escalation-rep">
                <div style="font-size:13px;color:var(--dash-text);font-weight:500;">${esc(e.assignedRep)}</div>
                <div style="font-size:11px;color:var(--dash-text-3);">Assigned</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    startSLATimers();
  }

  /* ── Team Performance ────────────────────────────────────── */
  function renderTeam() {
    const bestConv = Math.max(...D.MOCK_REPS.map(r => r.conversionRate));
    const maxLoad = Math.max(...D.MOCK_REPS.map(r => r.leadsAssigned));
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Team Performance</h1>
            <p class="section-header-sub">Sales rep metrics and workload</p>
          </div>
        </div>
        <div class="team-grid">
          ${D.MOCK_REPS.map((r, i) => {
            const initials = r.name.split(' ').map(w => w[0]).join('');
            const convPct = Math.min(100, (r.conversionRate / bestConv) * 100);
            const loadPct = Math.min(100, (r.leadsAssigned / maxLoad) * 100);
            return `
            <article class="team-card${r.conversionRate === bestConv ? ' is-top' : ''}">
              <header class="team-card-h">
                <div class="rep-avatar-sm">${esc(initials)}</div>
                <div class="team-card-id">
                  <div class="rep-name" title="${escAttr(r.name)}">${esc(r.name)}</div>
                  <div class="team-card-sub">${r.activeEscalations > 0
                    ? `<span class="team-flag">${r.activeEscalations} escalation${r.activeEscalations > 1 ? 's' : ''}</span>`
                    : '<span class="team-clear">No escalations</span>'}</div>
                </div>
                ${r.conversionRate === bestConv ? '<span class="team-top">Top</span>' : ''}
              </header>

              <div class="team-meter">
                <div class="team-meter-top"><span>Conversion</span><strong>${r.conversionRate}%</strong></div>
                <div class="team-meter-track"><i class="is-conv" style="--w:${convPct}%;--d:${i * 70}ms;"></i></div>
              </div>
              <div class="team-meter">
                <div class="team-meter-top"><span>Workload</span><strong>${r.leadsAssigned} leads</strong></div>
                <div class="team-meter-track"><i class="is-load" style="--w:${loadPct}%;--d:${i * 70 + 40}ms;"></i></div>
              </div>

              <div class="team-stats">
                <div class="team-stat"><b>${r.visitsBooked}</b><span>Visits booked</span></div>
                <div class="team-stat"><b>${r.avgResponseMin}m</b><span>Avg response</span></div>
              </div>
            </article>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  /* ── Channel Analytics ───────────────────────────────────── */
  function renderChannels() {
    const maxLeads = Math.max(...D.MOCK_CHANNELS.map(c => c.leads));
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Channel & Campaign Analytics</h1>
            <p class="section-header-sub">Lead volume and quality by source</p>
          </div>
        </div>
        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Lead Volume by Source</span>
          </div>
          <div class="channel-bars">
            ${D.MOCK_CHANNELS.map(c => `
              <div class="channel-bar-row">
                <div class="channel-bar-name" title="${escAttr(c.source)}">${esc(c.source)}</div>
                <div class="channel-bar-track">
                  <div class="channel-bar-fill" style="width:${(c.leads/maxLeads)*100}%;background:${c.color};"></div>
                </div>
                <div class="channel-bar-count">${c.leads}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="table-container">
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Source</th><th>Total Leads</th><th>Qualified</th><th>Hot</th><th>Junk</th><th>Hot:Junk</th><th>Cost/Lead</th>
                </tr>
              </thead>
              <tbody>
                ${D.MOCK_CHANNELS.map(c => `
                  <tr>
                    <td title="${escAttr(c.source)}"><span class="source-tag"><span class="source-tag-dot" style="background:${c.color};"></span>${esc(c.source)}</span></td>
                    <td style="font-weight:600;color:var(--dash-text);">${c.leads}</td>
                    <td>${c.qualified}</td>
                    <td style="color:var(--dash-amber);font-weight:600;">${c.hot}</td>
                    <td style="color:var(--dash-text-3);">${c.junk}</td>
                    <td><span class="score-badge ${c.hot/Math.max(c.junk,1) > 1 ? 'score-high':'score-med'}">${(c.hot/Math.max(c.junk,1)).toFixed(1)}</span></td>
                    <td>${c.costPerLead ? '₹' + Number(c.costPerLead).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    applyRowStagger();
  }

  /* ── Daily Briefing ──────────────────────────────────────── */
  function renderBriefing() {
    const B = D.MOCK_BRIEFING;
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Daily Briefing</h1>
            <p class="section-header-sub">Your 9 AM morning summary</p>
          </div>
        </div>
        <div class="dash-card briefing-card">
          <div class="briefing-header">
            <div class="briefing-date">${esc(B.date)}</div>
          </div>
          <div class="briefing-grid">
            <div class="briefing-stat">
              <div class="briefing-stat-val" data-countup="${B.newLeadsYesterday}">${B.newLeadsYesterday}</div>
              <div class="briefing-stat-label">New Leads Yesterday</div>
            </div>
            <div class="briefing-stat">
              <div class="briefing-stat-val" style="color:var(--dash-amber);" data-countup="${B.hotLeads}">${B.hotLeads}</div>
              <div class="briefing-stat-label">Hot Leads</div>
            </div>
            <div class="briefing-stat">
              <div class="briefing-stat-val" data-countup="${B.visitScheduled}">${B.visitScheduled}</div>
              <div class="briefing-stat-label">Visits Scheduled</div>
            </div>
            <div class="briefing-stat">
              <div class="briefing-stat-val" style="color:var(--dash-red);" data-countup="${B.escalationsPending}">${B.escalationsPending}</div>
              <div class="briefing-stat-label">Escalations Pending</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
            <div class="summary-item">
              <div class="summary-item-label">Top Source</div>
              <div class="summary-item-value">${esc(B.topSource)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">Avg Response Time</div>
              <div class="summary-item-value">${esc(B.avgResponseTime)}</div>
            </div>
          </div>
          <div style="margin-bottom:16px;">
            <div class="dt-label" style="margin-bottom:12px;">Notable Leads</div>
            <div class="briefing-notes">
              ${B.notableLeads.map(n => `
                <div class="briefing-note">
                  <div class="briefing-note-name" title="${escAttr(n.name)}">${esc(n.name)}</div>
                  <div class="briefing-note-text" title="${escAttr(n.note)}">${esc(n.note)}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="summary-item" style="border-left:3px solid var(--dash-green);">
            <div class="summary-item-label">Team Highlight</div>
            <div class="summary-item-value">${esc(B.teamHighlight)}</div>
          </div>
        </div>
      </div>
    `;
    contentEl.querySelectorAll('[data-countup]').forEach(el => countUp(el, parseFloat(el.dataset.countup)));
  }

  /* ── AI & NeoIntegration Health ──────────────────────────────── */
  function renderAIHealth() {
    const H = D.MOCK_AI_HEALTH;
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">AI & NeoIntegration Health</h1>
            <p class="section-header-sub">System performance and error monitoring</p>
          </div>
        </div>
        <div class="health-stat-grid">
          <div class="health-stat">
            <div class="health-stat-label">API Calls (24h)</div>
            <div class="health-stat-value" data-countup="${H.apiCalls24h}">${H.apiCalls24h}</div>
          </div>
          <div class="health-stat">
            <div class="health-stat-label">Token Cost (24h)</div>
            <div class="health-stat-value">${esc(H.tokenCost24h)}</div>
          </div>
          <div class="health-stat">
            <div class="health-stat-label">Error Rate</div>
            <div class="health-stat-value" style="color:${H.errorRate < 1 ? 'var(--dash-green)' : 'var(--dash-red)'};">${H.errorRate}%</div>
          </div>
          <div class="health-stat">
            <div class="health-stat-label">Avg Latency</div>
            <div class="health-stat-value">${esc(H.avgLatency)}</div>
          </div>
        </div>
        <div class="dash-card">
          <div class="dash-card-header">
            <span class="dash-card-title">Recent Errors & Issues</span>
            <span style="font-size:12px;color:var(--dash-text-3);">${H.flaggedResponses} flagged AI responses</span>
          </div>
          <div class="error-list">
            ${H.recentErrors.map(e => `
              <div class="error-item">
                <span class="error-type">${esc(e.type)}</span>
                <span class="error-detail">${esc(e.detail)}</span>
                <span class="error-time">${esc(e.time)}</span>
                ${e.resolved ? '<span class="error-resolved">✓ Resolved</span>' : '<button class="table-filter-btn" style="font-size:10px;padding:2px 8px;">Investigate</button>'}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    contentEl.querySelectorAll('[data-countup]').forEach(el => countUp(el, parseFloat(el.dataset.countup)));
  }

  /* ── Settings & Integrations ─────────────────────────────── */
  function renderSettings() {
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Settings & Integrations</h1>
            <p class="section-header-sub">Connection health and configuration</p>
          </div>
        </div>
        <div class="dash-card">
          <div class="dash-card-header">
            <span class="dash-card-title">Integration Status</span>
          </div>
          <div class="integration-list">
            ${D.MOCK_INTEGRATIONS.map(ig => `
              <div class="integration-item">
                <div class="integration-icon" style="background:${ig.status==='connected'?'var(--dash-green-dim)':ig.status==='warning'?'var(--dash-amber-dim)':'var(--dash-red-dim)'};">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${ig.status==='connected'?'var(--dash-green)':ig.status==='warning'?'var(--dash-amber)':'var(--dash-red)'}" stroke-width="1.5">${sourceIconPath(ig.icon)}</svg>
                </div>
                <div class="integration-info">
                  <div class="integration-name">${esc(ig.name)}</div>
                  <div class="integration-sync">Last sync: ${esc(ig.lastSync)}</div>
                </div>
                <div class="integration-status-dot ${ig.status}"></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="wide-grid-2">
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Business Hours</span>
            </div>
            <div class="summary-grid">
              <div class="summary-item"><div class="summary-item-label">Active Hours</div><div class="summary-item-value">9:00 AM – 8:00 PM</div></div>
              <div class="summary-item"><div class="summary-item-label">Auto-Reply</div><div class="summary-item-value" style="color:var(--dash-green);">Enabled</div></div>
              <div class="summary-item"><div class="summary-item-label">Weekend Mode</div><div class="summary-item-value">AI Only</div></div>
              <div class="summary-item"><div class="summary-item-label">Lead Score Threshold</div><div class="summary-item-value">≥ 60 = Hot</div></div>
            </div>
          </div>
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Knowledge Base</span>
            </div>
            <div class="summary-grid">
              <div class="summary-item"><div class="summary-item-label">Properties Loaded</div><div class="summary-item-value">24</div></div>
              <div class="summary-item"><div class="summary-item-label">Last Updated</div><div class="summary-item-value">2h ago</div></div>
              <div class="summary-item"><div class="summary-item-label">FAQ Entries</div><div class="summary-item-value">68</div></div>
              <div class="summary-item"><div class="summary-item-label">Pricing Tables</div><div class="summary-item-value">6 active</div></div>
            </div>
          </div>
        </div>
        <div class="dash-card">
          <div class="dash-card-header">
            <span class="dash-card-title">Support</span>
          </div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-item-label">Email</div>
              <div class="summary-item-value"><a href="mailto:info@neointegrations.com">Info@neointegrations.com</a></div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">Phone</div>
              <div class="summary-item-value"><a href="tel:+918789359477">+91 87893 59477</a></div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">LinkedIn</div>
              <div class="summary-item-value"><a href="https://www.linkedin.com/in/raj-aryan-aa43742a1" target="_blank" rel="noopener noreferrer">Raj Aryan</a></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Lead Detail Drawer ──────────────────────────────────── */
  function openLeadDrawer(leadId) {
    const lead = D.MOCK_LEADS.find(l => l.id === leadId);
    if (!lead) return;

    drawerName.textContent = lead.name;
    drawerMeta.innerHTML = `
      <span class="status-pill ${statusClass(lead.status)}">${esc(lead.status)}</span>
      <span class="score-badge ${scoreClass(lead.score)}">${lead.score}</span>
      <span class="source-tag" style="font-size:12px;"><span class="source-tag-dot" style="background:${sourceColor(lead.source)};"></span>${esc(lead.source)}</span>
      <span style="font-size:12px;color:var(--dash-text-3);">${esc(lead.id)}</span>
    `;

    // Default to conversation tab
    renderDrawerTab('conversation', leadId);
    drawerTabs.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'conversation'));

    // Open
    drawerEl.classList.add('open');
    drawerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLeadDrawer() {
    drawerEl.classList.remove('open');
    drawerOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderDrawerTab(tab, leadId) {
    const lead = D.MOCK_LEADS.find(l => l.id === leadId);
    if (!lead) return;

    if (tab === 'conversation') {
      const conv = D.MOCK_CONVERSATIONS[leadId];
      const ch = conv ? conv.channel : 'whatsapp';
      drawerBody.innerHTML = `
        <div class="chat-thread">
          <div class="chat-channel-label">${ch.toUpperCase()} CONVERSATION</div>
          ${conv ? conv.messages.map(m => `
            <div>
              <div class="chat-sender">${esc(m.sender)}</div>
              <div class="chat-bubble ${m.from === 'ira' ? 'outgoing ch-' + ch : 'incoming'}">
                ${esc(m.text)}
                <span class="chat-time">${esc(m.time)}</span>
              </div>
            </div>
          `).join('') : '<p style="color:var(--dash-text-3);text-align:center;padding:40px 0;">No conversation data available.</p>'}
        </div>
      `;
    }

    else if (tab === 'summary') {
      const s = D.MOCK_LEAD_SUMMARIES[leadId] || {};
      drawerBody.innerHTML = `
        <div style="margin-bottom:20px;text-align:center;">
          <svg viewBox="0 0 36 36" width="100" height="100" style="margin:0 auto;">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--dash-border)" stroke-width="2.5"/>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${(s.qualificationScore||0) >= 70 ? 'var(--dash-green)' : (s.qualificationScore||0) >= 40 ? 'var(--dash-amber)' : 'var(--dash-text-3)'}" stroke-width="2.5" stroke-dasharray="${s.qualificationScore||0}, 100" stroke-linecap="round"/>
            <text x="18" y="20.5" text-anchor="middle" fill="var(--dash-text)" style="font-size:10px;font-weight:700;font-family:Inter,sans-serif;">${s.qualificationScore||0}</text>
          </svg>
          <div style="font-size:13px;color:var(--dash-text-3);margin-top:8px;">Lead Score</div>
        </div>
        <div class="summary-grid">
          <div class="summary-item"><div class="summary-item-label">Budget</div><div class="summary-item-value">${esc(s.budget||lead.budget)}</div></div>
          <div class="summary-item"><div class="summary-item-label">Timeline</div><div class="summary-item-value">${esc(s.timeline||lead.timeline)}</div></div>
          <div class="summary-item"><div class="summary-item-label">Location</div><div class="summary-item-value">${esc(s.locationPref||lead.location)}</div></div>
          <div class="summary-item"><div class="summary-item-label">Property Type</div><div class="summary-item-value">${esc(s.propertyType||lead.propertyType)}</div></div>
          <div class="summary-item"><div class="summary-item-label">Use Type</div><div class="summary-item-value">${esc(s.useType||lead.useType)}</div></div>
          <div class="summary-item"><div class="summary-item-label">Financing</div><div class="summary-item-value">${esc(s.financing||'Unknown')}</div></div>
        </div>
        <div style="margin-top:16px;">
          <div class="dt-label" style="margin-bottom:8px;">Key Objections / Notes</div>
          ${(s.keyObjections||[]).map(o => `
            <div style="padding:8px 12px;background:var(--dash-surface);border:1px solid var(--dash-border);border-radius:6px;margin-bottom:6px;font-size:13px;color:var(--dash-text-2);">• ${esc(o)}</div>
          `).join('')}
        </div>
        <div style="margin-top:16px;">
          <div class="summary-item" style="border-left:3px solid var(--dash-accent);">
            <div class="summary-item-label">AI Confidence</div>
            <div class="summary-item-value">${s.aiConfidence||0}% — ${(s.aiConfidence||0) >= 80 ? 'High confidence' : (s.aiConfidence||0) >= 50 ? 'Moderate confidence' : 'Low confidence'}</div>
          </div>
        </div>
      `;
    }

    else if (tab === 'timeline') {
      const activities = D.MOCK_ACTIVITIES[leadId] || [];
      drawerBody.innerHTML = `
        <div class="timeline-list">
          ${activities.map(a => `
            <div class="timeline-item type-${a.type}">
              <div class="timeline-dot"></div>
              <div class="timeline-label">${esc(a.label)}</div>
              <div class="timeline-detail">${esc(a.detail)}</div>
              <div class="timeline-time">${esc(a.time)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    else if (tab === 'actions') {
      drawerBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label class="dt-label" style="display:block;margin-bottom:6px;">Update Status</label>
            <select style="width:100%;padding:10px 14px;background:var(--dash-bg);border:1px solid var(--dash-border-2);border-radius:8px;color:var(--dash-text);font-size:14px;outline:none;">
              ${D.STATUSES.map(s => `<option ${s === lead.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="dt-label" style="display:block;margin-bottom:6px;">Reassign Rep</label>
            <select style="width:100%;padding:10px 14px;background:var(--dash-bg);border:1px solid var(--dash-border-2);border-radius:8px;color:var(--dash-text);font-size:14px;outline:none;">
              ${D.REPS.map(r => `<option ${r === lead.assignedRep ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="dt-label" style="display:block;margin-bottom:6px;">Add Internal Note</label>
            <textarea style="width:100%;padding:10px 14px;background:var(--dash-bg);border:1px solid var(--dash-border-2);border-radius:8px;color:var(--dash-text);font-size:14px;outline:none;resize:vertical;min-height:80px;" placeholder="Type a note…"></textarea>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="login-btn" style="flex:1;padding:10px;">Save Changes</button>
            <button class="login-btn" style="flex:1;padding:10px;background:var(--dash-surface-2);border:1px solid var(--dash-border-2);">Mark Human-Handled</button>
          </div>
        </div>
      `;
    }
  }

  /* ── Helper: Source Icon Paths ────────────────────────────── */
  function sourceIconPath(icon) {
    const paths = {
      whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-width="1.5"/>',
      instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke-width="1.5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke-width="1.5"/>',
      facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke-width="1.5"/>',
      website: '<circle cx="12" cy="12" r="10" stroke-width="1.5"/><line x1="2" y1="12" x2="22" y2="12" stroke-width="1.5"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-width="1.5"/>',
      email: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke-width="1.5"/><polyline points="22 6 12 13 2 6" stroke-width="1.5"/>',
      manual: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-width="1.5"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="1.5"/>',
      sheets: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke-width="1.5"/><line x1="3" y1="15" x2="21" y2="15" stroke-width="1.5"/><line x1="9" y1="3" x2="9" y2="21" stroke-width="1.5"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="1.5"/><line x1="16" y1="2" x2="16" y2="6" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="6" stroke-width="1.5"/><line x1="3" y1="10" x2="21" y2="10" stroke-width="1.5"/>',
      slack: '<path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" stroke-width="1.5"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" stroke-width="1.5"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" stroke-width="1.5"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" stroke-width="1.5"/>',
    };
    return paths[icon] || paths.website;
  }

  /* ── Helper: Donut SVG ───────────────────────────────────── */
  function donutSVG(active, cold) {
    const total = active + cold;
    const activePct = (active / total) * 100;
    return `<svg viewBox="0 0 36 36" class="donut-svg" width="100" height="100">
      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--dash-border)" stroke-width="3"/>
      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--dash-accent)" stroke-width="3" stroke-dasharray="${activePct}, 100" stroke-linecap="round"/>
      <text x="18" y="19" text-anchor="middle" fill="var(--dash-text)" style="font-size:7px;font-weight:700;font-family:Inter,sans-serif;">${Math.round(activePct)}%</text>
      <text x="18" y="23.5" text-anchor="middle" fill="var(--dash-text-3)" style="font-size:3.5px;font-family:Inter,sans-serif;">active</text>
    </svg>`;
  }

  /* ── Helper: Debounce ────────────────────────────────────── */
  function debounce(fn, ms) {
    let t;
    return function() {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  /* ══════════════════════════════════════════════════════════
     ROUTER
     ══════════════════════════════════════════════════════════ */

  const RENDERERS = {
    overview: renderOverview,
    leads: renderLeads,
    visits: renderVisits,
    followups: renderFollowups,
    escalations: renderEscalations,
    team: renderTeam,
    channels: renderChannels,
    briefing: renderBriefing,
    aihealth: renderAIHealth,
    settings: renderSettings,
  };

  function moveNavPill() {
    const pill = document.getElementById('nav-pill');
    const active = sidebar.querySelector('.sidebar-nav-item.active');
    const nav = document.getElementById('sidebar-nav');
    if (!pill || !active || !nav) return;
    pill.style.opacity = '1';
    pill.style.transform = 'translateY(' + active.offsetTop + 'px)';
    pill.style.height = active.offsetHeight + 'px';
  }

  function playEnter() {
    const sec = contentEl.querySelector('.dash-section');
    if (!sec) return;
    sec.classList.remove('is-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => sec.classList.add('is-ready'));
    });
  }

  function navigate(section) {
    if (!RENDERERS[section]) section = 'overview';
    currentSection = section;
    clearSLATimers();

    // Update title
    titleEl.textContent = TITLES[section] || 'Dashboard';

    // Update sidebar active
    sidebar.querySelectorAll('.sidebar-nav-item[data-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });

    // Render section
    RENDERERS[section]();
    moveNavPill();
    playEnter();

    // Update hash
    if (window.location.hash !== '#' + section) {
      history.replaceState(null, '', '#' + section);
    }

    // Close mobile sidebar
    sidebar.classList.remove('mobile-open');
    overlay.style.opacity = '0';
    setTimeout(() => { if (!sidebar.classList.contains('mobile-open')) overlay.style.display = ''; }, 300);

    // Scroll to top
    contentEl.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ══════════════════════════════════════════════════════════
     OS CHROME — Share · Create · Command palette · Toasts
     ══════════════════════════════════════════════════════════ */

  const osOverlay = document.getElementById('os-overlay');
  const osShareSheet = document.getElementById('os-share-sheet');
  const osCreateSheet = document.getElementById('os-create-sheet');
  const osToast = document.getElementById('os-toast');
  const osCmd = document.getElementById('os-cmd');
  const osCmdOverlay = document.getElementById('os-cmd-overlay');
  const osCmdInput = document.getElementById('os-cmd-input');
  const osCmdList = document.getElementById('os-cmd-list');
  const osNotif = document.getElementById('os-notif');
  const osNotifList = document.getElementById('os-notif-list');
  let osToastTimer = null;
  let osCmdIndex = 0;
  let osCmdItems = [];
  let shareContext = { type: 'view', leadId: null };

  function toast(msg) {
    if (!osToast) return;
    osToast.textContent = msg;
    osToast.classList.add('is-on');
    clearTimeout(osToastTimer);
    osToastTimer = setTimeout(() => osToast.classList.remove('is-on'), 2400);
  }

  function closeSheets() {
    [osShareSheet, osCreateSheet].forEach((el) => {
      if (!el) return;
      el.classList.remove('is-on');
      el.setAttribute('aria-hidden', 'true');
    });
    if (osOverlay) osOverlay.classList.remove('is-on');
    if (!osCmd || !osCmd.classList.contains('is-on')) {
      document.body.style.overflow = drawerEl.classList.contains('open') ? 'hidden' : '';
    }
  }

  function openSheet(sheet) {
    closeCommand();
    closeNotif();
    closeSheets();
    if (osOverlay) osOverlay.classList.add('is-on');
    sheet.classList.add('is-on');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function fillLeadSelects() {
    const options = D.MOCK_LEADS.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
    const fu = document.getElementById('os-fu-lead');
    const vis = document.getElementById('os-v-lead');
    if (fu) fu.innerHTML = options;
    if (vis) vis.innerHTML = options;
  }

  function shareUrl(ctx) {
    const url = new URL(window.location.href);
    if (ctx.type === 'lead' && ctx.leadId) {
      url.hash = 'leads';
      url.searchParams.set('lead', ctx.leadId);
    }
    return url.toString();
  }

  function openShare(ctx) {
    shareContext = ctx || { type: 'view', leadId: null };
    const isLead = shareContext.type === 'lead' && shareContext.leadId;
    const title = document.getElementById('os-share-title');
    const note = document.getElementById('os-share-note');
    const link = document.getElementById('os-share-link');
    if (title) title.textContent = isLead ? 'Share this lead' : 'Share this view';
    if (note) {
      note.textContent = isLead
        ? 'Copy a deep link to this lead. Teammates with dashboard access land on the same record.'
        : 'Copy a live link or export the current operations snapshot.';
    }
    if (link) link.value = shareUrl(shareContext);
    openSheet(osShareSheet);
    if (link) { link.focus(); link.select(); }
  }

  function openCreate() {
    fillLeadSelects();
    openSheet(osCreateSheet);
    const first = document.getElementById('os-name');
    if (first) setTimeout(() => first.focus(), 80);
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 800);
  }

  function exportLeadsCSV() {
    const cols = ['id', 'name', 'phone', 'email', 'source', 'status', 'score', 'budget', 'location', 'propertyType', 'timeline', 'assignedRep'];
    const lines = [cols.join(',')].concat(
      D.MOCK_LEADS.map((l) => cols.map((c) => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(','))
    );
    downloadFile('neo-leads.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    toast('Leads CSV downloaded');
  }

  function exportOverview() {
    const K = D.MOCK_KPIS;
    const text = [
      'Neo Client OS — Overview snapshot',
      new Date().toLocaleString('en-IN'),
      '',
      `Total leads today: ${K.totalLeads.today}`,
      `New last 24h: ${K.newLast24h.total}`,
      `Hot leads: ${K.hotLeads}`,
      `Unattended escalations: ${K.unattendedEscalations}`,
      `Site visits today / week: ${K.siteVisits.today} / ${K.siteVisits.week}`,
      `Avg response time: ${K.avgResponseTime.label}`,
      '',
      'Sources (24h): ' + K.newLast24h.bySrc.map((s) => `${s.source} ${s.count}`).join(', '),
    ].join('\n');
    downloadFile('neo-overview.txt', text, 'text/plain;charset=utf-8');
    toast('Overview snapshot downloaded');
  }

  async function copyShareLink() {
    const link = document.getElementById('os-share-link');
    const value = link ? link.value : shareUrl(shareContext);
    try {
      await navigator.clipboard.writeText(value);
      toast('Link copied');
    } catch (e) {
      if (link) { link.select(); document.execCommand('copy'); toast('Link copied'); }
    }
  }

  function setCreateType(type) {
    document.querySelectorAll('[data-create-type]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.dataset.createType === type);
    });
    document.querySelectorAll('.os-create-pane').forEach((pane) => {
      pane.classList.toggle('is-on', pane.id === 'os-create-' + type);
    });
  }

  function nextLeadId() {
    const nums = D.MOCK_LEADS.map((l) => parseInt(String(l.id).replace(/\D/g, ''), 10)).filter(Boolean);
    return 'LD-' + (Math.max(2000, ...nums) + 1);
  }

  function handleCreateLead(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const source = form.source.value;
    const notes = form.notes.value.trim();
    const now = new Date();
    const id = nextLeadId();
    D.MOCK_LEADS.unshift({
      id,
      name,
      phone,
      email,
      source,
      captured: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      capturedRaw: now.toISOString(),
      status: 'New',
      score: 42,
      budget: '—',
      location: '—',
      propertyType: '—',
      timeline: 'Just exploring',
      useType: 'Self-use',
      assignedRep: D.REPS[0],
      lastContact: now.toISOString(),
      nextFollowUp: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      nextFollowUpRaw: now.toISOString(),
      notes,
    });
    form.reset();
    closeSheets();
    toast('Lead added — ' + name);
    navigate('leads');
    setTimeout(() => openLeadDrawer(id), 120);
  }

  function handleCreateFollowup(e) {
    e.preventDefault();
    const lead = D.MOCK_LEADS.find((l) => l.id === e.target.lead.value);
    if (!lead) return;
    D.MOCK_FOLLOWUPS.approachingDay14.unshift({
      leadName: lead.name,
      currentDay: Number(e.target.day.value) || 12,
      lastReply: e.target.note.value.trim() || 'Manual follow-up',
    });
    closeSheets();
    toast('Follow-up created for ' + lead.name);
    navigate('followups');
  }

  function handleCreateVisit(e) {
    e.preventDefault();
    const lead = D.MOCK_LEADS.find((l) => l.id === e.target.lead.value);
    if (!lead) return;
    D.MOCK_VISITS.unshift({
      id: 'SV-' + String(100 + D.MOCK_VISITS.length).padStart(3, '0'),
      leadName: lead.name,
      property: e.target.property.value.trim(),
      date: 'Today',
      time: e.target.time.value.trim(),
      rep: lead.assignedRep,
      status: e.target.status.value,
      reminderSent: false,
    });
    closeSheets();
    toast('Site visit scheduled');
    navigate('visits');
  }

  /* Command palette */
  function closeCommand() {
    if (!osCmd) return;
    osCmd.classList.remove('is-on');
    if (osCmdOverlay) osCmdOverlay.classList.remove('is-on');
    if (osCmdInput) osCmdInput.value = '';
    if (!osShareSheet.classList.contains('is-on') && !drawerEl.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function commandRows(query) {
    const q = (query || '').toLowerCase().trim();
    const nav = Object.keys(TITLES).map((key) => ({
      kind: 'view',
      id: key,
      label: TITLES[key],
      meta: 'View',
    }));
    const leads = D.MOCK_LEADS.map((l) => ({
      kind: 'lead',
      id: l.id,
      label: l.name,
      meta: l.source + ' · ' + l.status,
    }));
    return nav.concat(leads).filter((row) => {
      if (!q) return row.kind === 'view' || leads.indexOf(row) < 6;
      return row.label.toLowerCase().includes(q) || row.meta.toLowerCase().includes(q) || row.id.toLowerCase().includes(q);
    }).slice(0, 12);
  }

  function renderCommand(query) {
    osCmdItems = commandRows(query);
    osCmdIndex = 0;
    if (!osCmdItems.length) {
      osCmdList.innerHTML = '<div class="os-empty"><strong>Nothing found</strong>Try a lead name or a section.</div>';
      return;
    }
    osCmdList.innerHTML = osCmdItems.map((row, i) => `
      <button type="button" class="os-cmd-item${i === 0 ? ' is-active' : ''}" data-cmd-i="${i}">
        <span>${esc(row.label)}</span>
        <small>${esc(row.meta)}</small>
      </button>
    `).join('');
    osCmdList.querySelectorAll('.os-cmd-item').forEach((btn) => {
      btn.addEventListener('click', () => runCommand(Number(btn.dataset.cmdI)));
    });
  }

  function highlightCommand() {
    osCmdList.querySelectorAll('.os-cmd-item').forEach((el, i) => {
      el.classList.toggle('is-active', i === osCmdIndex);
      if (i === osCmdIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function runCommand(i) {
    const row = osCmdItems[i];
    if (!row) return;
    closeCommand();
    if (row.kind === 'view') navigate(row.id);
    else {
      navigate('leads');
      setTimeout(() => openLeadDrawer(row.id), 80);
    }
  }

  function openCommand() {
    closeSheets();
    closeNotif();
    if (osCmdOverlay) osCmdOverlay.classList.add('is-on');
    osCmd.classList.add('is-on');
    renderCommand('');
    document.body.style.overflow = 'hidden';
    setTimeout(() => osCmdInput && osCmdInput.focus(), 40);
  }

  function closeNotif() {
    if (osNotif) osNotif.classList.remove('is-on');
  }

  function renderNotifs() {
    if (!osNotifList) return;
    const items = [
      ...D.MOCK_ESCALATIONS.slice(0, 2).map((e) => ({
        title: e.leadName,
        detail: e.reason,
        go: () => { closeNotif(); navigate('escalations'); },
      })),
      ...D.MOCK_VISITS.filter((v) => v.status === 'pending').slice(0, 2).map((v) => ({
        title: v.leadName,
        detail: 'Visit pending · ' + v.time,
        go: () => { closeNotif(); navigate('visits'); },
      })),
    ];
    osNotifList.innerHTML = items.map((n, i) => `
      <button type="button" class="os-notif-item" data-n="${i}">
        <strong>${esc(n.title)}</strong>
        <span>${esc(n.detail)}</span>
      </button>
    `).join('');
    osNotifList.querySelectorAll('.os-notif-item').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        items[Number(btn.dataset.n)].go();
      });
    });
  }

  /* Wire OS chrome */
  document.getElementById('os-share-btn')?.addEventListener('click', () => openShare({ type: 'view' }));
  document.getElementById('os-create-btn')?.addEventListener('click', openCreate);
  document.getElementById('os-copy-link')?.addEventListener('click', copyShareLink);
  document.getElementById('os-export-csv')?.addEventListener('click', exportLeadsCSV);
  document.getElementById('os-export-overview')?.addEventListener('click', exportOverview);
  document.getElementById('os-create-lead')?.addEventListener('submit', handleCreateLead);
  document.getElementById('os-create-followup')?.addEventListener('submit', handleCreateFollowup);
  document.getElementById('os-create-visit')?.addEventListener('submit', handleCreateVisit);
  document.getElementById('drawer-share')?.addEventListener('click', () => {
    const lead = D.MOCK_LEADS.find((l) => l.name === drawerName.textContent);
    openShare({ type: 'lead', leadId: lead ? lead.id : null });
  });
  document.querySelectorAll('[data-os-close]').forEach((btn) => btn.addEventListener('click', closeSheets));
  osOverlay?.addEventListener('click', closeSheets);
  osCmdOverlay?.addEventListener('click', closeCommand);
  document.querySelectorAll('[data-create-type]').forEach((btn) => {
    btn.addEventListener('click', () => setCreateType(btn.dataset.createType));
  });
  document.getElementById('topbar-search')?.addEventListener('click', openCommand);
  document.getElementById('notif-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = osNotif.classList.toggle('is-on');
    if (open) renderNotifs();
  });
  document.addEventListener('click', (e) => {
    const nwrap = document.querySelector('.topbar-notif-wrap');
    if (osNotif && nwrap && !nwrap.contains(e.target)) closeNotif();
  });
  osCmdInput?.addEventListener('input', () => renderCommand(osCmdInput.value));

  /* ── Init ────────────────────────────────────────────────── */

  // Sidebar nav clicks
  sidebar.querySelectorAll('.sidebar-nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.section));
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('neo_auth');
    localStorage.removeItem('neo_auth');
    window.location.replace('login.html');
  });

  // Drawer close
  drawerClose.addEventListener('click', closeLeadDrawer);
  drawerOverlay.addEventListener('click', closeLeadDrawer);

  // Drawer tabs
  drawerTabs.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      drawerTabs.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const leadId = D.MOCK_LEADS.find(l => l.name === drawerName.textContent)?.id;
      if (leadId) renderDrawerTab(tab.dataset.tab, leadId);
    });
  });

  // Mobile sidebar
  hamburger.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('mobile-open');
    overlay.style.display = 'block';
    requestAnimationFrame(() => { overlay.style.opacity = isOpen ? '1' : '0'; });
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = '', 300);
  });

  /* ── Theme ───────────────────────────────────────────────── */
  const themeToggle = document.getElementById('theme-toggle');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
      themeToggle.title = theme === 'light' ? 'Switch to dark' : 'Switch to light';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f5f8' : '#09090b');
    try { localStorage.setItem('neo-theme', theme); } catch (e) { /* private mode */ }
  }

  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      toast(next === 'light' ? 'Light theme' : 'Dark theme');
    });
  }

  // Keyboard: ⌘K command palette · Escape closes overlays
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (osCmd.classList.contains('is-on')) closeCommand();
      else openCommand();
      return;
    }
    if (osCmd.classList.contains('is-on')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        osCmdIndex = Math.min(osCmdItems.length - 1, osCmdIndex + 1);
        highlightCommand();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        osCmdIndex = Math.max(0, osCmdIndex - 1);
        highlightCommand();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        runCommand(osCmdIndex);
        return;
      }
    }
    if (e.key === 'Escape') {
      if (osCmd.classList.contains('is-on')) { closeCommand(); return; }
      if (osShareSheet.classList.contains('is-on') || osCreateSheet.classList.contains('is-on')) { closeSheets(); return; }
      closeNotif();
      closeLeadDrawer();
    }
  });

  // Route from hash / shared lead link
  window.addEventListener('resize', moveNavPill);
  requestAnimationFrame(moveNavPill);

  const hash = window.location.hash.slice(1);
  const sharedLead = new URLSearchParams(window.location.search).get('lead');
  navigate(hash && RENDERERS[hash] ? hash : (sharedLead ? 'leads' : 'overview'));
  if (sharedLead && D.MOCK_LEADS.some((l) => l.id === sharedLead)) {
    setTimeout(() => openLeadDrawer(sharedLead), 200);
  }

  /* ── Public API for inline handlers ──────────────────────── */
  window.DashApp = {
    navigate,
    openLead: openLeadDrawer,
    openShare,
    openCreate,
    openCommand,
  };

})();
