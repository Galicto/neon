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
    const stepX = w / (data.length - 1);
    const points = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h * 0.8 - h * 0.1}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="kpi-sparkline" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
    </svg>`;
  }

  /* ── Count-Up Animation ──────────────────────────────────── */
  function countUp(el, target, duration) {
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (el) el.textContent = target;
      return;
    }
    duration = duration || 1200;
    const start = performance.now();
    const isFloat = String(target).includes('.');
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      const val = eased * target;
      el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  /* ── Staggered Row Animation ─────────────────────────────── */
  function applyRowStagger() {
    const rows = contentEl.querySelectorAll('.data-table tbody tr');
    rows.forEach((row, i) => {
      row.style.animationDelay = `${i * 0.03}s`;
    });
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
            <p class="section-header-sub">Real-time snapshot of your sales pipeline</p>
          </div>
        </div>

        <!-- KPI Row 1 -->
        <div class="kpi-grid">
          <div class="kpi-card accent-glow">
            <div class="kpi-label">Total Leads Today</div>
            <div class="kpi-value" data-countup="${K.totalLeads.today}">0</div>
            <span class="kpi-delta up">↑ 12% vs yesterday</span>
            ${sparklineSVG(K.sparklines.leadsWeekly, '#6366F1', 100, 40)}
          </div>
          <div class="kpi-card">
            <div class="kpi-label">New Last 24h</div>
            <div class="kpi-value" data-countup="${K.newLast24h.total}">0</div>
            <span class="kpi-delta up">↑ 8%</span>
            ${sparklineSVG(K.sparklines.leadsWeekly, '#818CF8', 100, 40)}
          </div>
          <div class="kpi-card warn-glow">
            <div class="kpi-label">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--dash-amber)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
              Hot Leads
            </div>
            <div class="kpi-value" data-countup="${K.hotLeads}" style="color: var(--dash-amber);">0</div>
            <span class="kpi-delta up" style="background:var(--dash-amber-dim);color:var(--dash-amber);">Needs attention</span>
            ${sparklineSVG(K.sparklines.hotWeekly, '#F59E0B', 100, 40)}
          </div>
          <div class="kpi-card alert-glow">
            <div class="kpi-label">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--dash-red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Unattended Escalations
            </div>
            <div class="kpi-value" data-countup="${K.unattendedEscalations}" style="color: var(--dash-red);">0</div>
            <span class="kpi-delta down">Respond now</span>
          </div>
        </div>

        <!-- Source Breakdown -->
        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Lead Sources — Last 24 Hours</span>
            <span class="dash-card-action" onclick="DashApp.navigate('channels')">View all channels →</span>
          </div>
          <div class="source-grid">
            ${K.newLast24h.bySrc.map(s => `
              <div class="source-item">
                <div class="source-icon" style="background: ${s.color}15;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${s.color}" stroke-width="1.5">${sourceIconPath(s.icon)}</svg>
                </div>
                <div class="source-count" data-countup="${s.count}">0</div>
                <div class="source-name">${esc(s.source)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Row 3: Visits + Response Time -->
        <div class="wide-grid-2">
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title">Site Visits</span>
              <span class="dash-card-action" onclick="DashApp.navigate('visits')">View all →</span>
            </div>
            <div style="display:flex;gap:24px;margin-bottom:16px;">
              <div>
                <div style="font-size:32px;font-weight:700;color:var(--dash-text);" data-countup="${K.siteVisits.today}">0</div>
                <div style="font-size:12px;color:var(--dash-text-3);">Today</div>
              </div>
              <div>
                <div style="font-size:32px;font-weight:700;color:var(--dash-text);" data-countup="${K.siteVisits.week}">0</div>
                <div style="font-size:12px;color:var(--dash-text-3);">This Week</div>
              </div>
            </div>
            <div class="visit-list">
              ${D.MOCK_VISITS.slice(0, 3).map(v => `
                <div class="visit-item">
                  <div class="visit-time">${esc(v.time)}</div>
                  <div class="visit-info">
                    <div class="visit-lead">${esc(v.leadName)}</div>
                    <div class="visit-prop">${esc(v.property)}</div>
                  </div>
                  <span class="visit-status ${v.status}">${esc(v.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="dash-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div class="dash-card-header" style="width:100%;">
              <span class="dash-card-title">Avg Response Time</span>
              <span class="kpi-delta up">↓ ${Math.abs(K.avgResponseTime.delta)}% faster</span>
            </div>
            <div class="gauge-wrap" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;">
              <div class="gauge-big-num"><span data-countup="42">0</span><span class="gauge-unit">s</span></div>
              <div class="gauge-sublabel">Lead capture → First Ira reply</div>
            </div>
          </div>
        </div>

        <!-- Conversion Funnel -->
        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Conversion Funnel — This Month</span>
          </div>
          <div class="funnel-row">
            ${K.funnel.map((s, i) => `
              <div class="funnel-stage">
                <div class="funnel-count" data-countup="${s.count}">0</div>
                <div class="funnel-label">${esc(s.stage)}</div>
                <div class="funnel-pct">${s.pct}%</div>
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
              <div class="escalation-item ${e.priority}" style="margin-bottom:8px;">
                <div class="escalation-info">
                  <div class="escalation-name">${esc(e.leadName)}</div>
                  <div class="escalation-reason">${esc(e.reason)}</div>
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
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Lead Management</h1>
            <p class="section-header-sub">All leads across channels — click a row for full detail</p>
          </div>
        </div>

        <div class="table-container">
          <div class="table-toolbar">
            <div class="table-filters">
              <button class="table-filter-btn ${leadFilterStatus==='all'?'active':''}" data-filter-status="all">All Status</button>
              ${['New','Qualified','Hot','Visit Booked','Follow-up','Cold','Closed'].map(s =>
                `<button class="table-filter-btn ${leadFilterStatus===s?'active':''}" data-filter-status="${s}">${s}</button>`
              ).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="table-search">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search name, phone, email…" id="lead-search" value="${esc(leadSearchQuery)}" />
              </div>
              <div class="table-count"><strong>${leads.length}</strong> leads</div>
            </div>
          </div>
          <div class="table-scroll">
            <table class="data-table" id="leads-table">
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
                  <th data-sort="nextFollowUpRaw">Next F/U</th>
                  <th style="width:100px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${leads.map(l => `
                  <tr data-lead-id="${l.id}" class="lead-row">
                    <td>
                      <div class="lead-name-cell">
                        <span class="lead-name-primary">${esc(l.name)}</span>
                        <span class="lead-name-phone">${esc(l.phone)}</span>
                      </div>
                    </td>
                    <td>
                      <span class="source-tag">
                        <span class="source-tag-dot" style="background:${sourceColor(l.source)};"></span>
                        ${esc(l.source)}
                      </span>
                    </td>
                    <td style="font-size:12px;">${esc(l.captured)}</td>
                    <td><span class="status-pill ${statusClass(l.status)}">${esc(l.status)}</span></td>
                    <td><span class="score-badge ${scoreClass(l.score)}">${l.score}</span></td>
                    <td style="font-size:12px;">${esc(l.budget)}</td>
                    <td style="font-size:12px;">${esc(l.location)}</td>
                    <td style="font-size:12px;">${esc(l.propertyType)}</td>
                    <td style="font-size:12px;">${esc(l.timeline)}</td>
                    <td style="font-size:12px;">${esc(l.assignedRep)}</td>
                    <td style="font-size:12px;">${esc(l.nextFollowUp)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="row-action-btn" title="View conversation" onclick="event.stopPropagation();DashApp.openLead('${l.id}')">
                          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="row-action-btn" title="Mark handled" onclick="event.stopPropagation()">
                          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button class="row-action-btn" title="Reassign" onclick="event.stopPropagation()">
                          <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
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
  function renderVisits() {
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Site Visits</h1>
            <p class="section-header-sub">Scheduled property visits and tracking</p>
          </div>
        </div>
        <div class="kpi-grid" style="grid-template-columns: repeat(3,1fr);">
          <div class="kpi-card">
            <div class="kpi-label">Today</div>
            <div class="kpi-value" data-countup="${D.MOCK_KPIS.siteVisits.today}">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">This Week</div>
            <div class="kpi-value" data-countup="${D.MOCK_KPIS.siteVisits.week}">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Confirmation Rate</div>
            <div class="kpi-value" style="color:var(--dash-green);">83%</div>
          </div>
        </div>
        <div class="dash-card">
          <div class="dash-card-header">
            <span class="dash-card-title">Upcoming Visits</span>
          </div>
          <div class="visit-list">
            ${D.MOCK_VISITS.map(v => `
              <div class="visit-item">
                <div class="visit-time">${esc(v.time)}</div>
                <div class="visit-info">
                  <div class="visit-lead">${esc(v.leadName)}</div>
                  <div class="visit-prop">${esc(v.property)} · ${esc(v.date)} · Rep: ${esc(v.rep)}</div>
                </div>
                <span class="visit-status ${v.status}">${esc(v.status)}</span>
                <span style="font-size:11px;color:${v.reminderSent ? 'var(--dash-green)' : 'var(--dash-amber)'};">${v.reminderSent ? '✓ Reminded' : '⏳ Pending'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    contentEl.querySelectorAll('[data-countup]').forEach(el => countUp(el, parseFloat(el.dataset.countup)));
  }

  /* ── Follow-up Sequences ─────────────────────────────────── */
  function renderFollowups() {
    const F = D.MOCK_FOLLOWUPS;
    const maxActive = Math.max(...F.days.map(d => d.active));
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Follow-up Sequence Tracker</h1>
            <p class="section-header-sub">14-day drip pipeline — leads approaching Day 14 highlighted</p>
          </div>
        </div>
        <div class="dash-card wide-card-full">
          <div class="dash-card-header">
            <span class="dash-card-title">Active Leads per Day</span>
          </div>
          <div class="followup-pipeline">
            ${F.days.map(d => `
              <div class="followup-bar${d.day >= 12 ? ' warning' : ''}" style="height:${Math.max(8, (d.active/maxActive)*100)}%;" title="Day ${d.day}: ${d.active} active, ${d.replied} replied">
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
            <div class="escalation-item high" style="margin-bottom:8px;">
              <div class="escalation-info">
                <div class="escalation-name">${esc(l.leadName)}</div>
                <div class="escalation-reason">Day ${l.currentDay} · Last reply: ${esc(l.lastReply)}</div>
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
                <div class="escalation-name">${esc(e.leadName)}</div>
                <div class="escalation-reason">${esc(e.reason)}</div>
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
    contentEl.innerHTML = `
      <div class="dash-section">
        <div class="section-header">
          <div class="section-header-left">
            <h1 class="section-header-title">Team Performance</h1>
            <p class="section-header-sub">Sales rep metrics and workload</p>
          </div>
        </div>
        <div class="dash-card">
          ${D.MOCK_REPS.map(r => `
            <div class="rep-card">
              <div class="rep-avatar-sm">${r.name.split(' ').map(w=>w[0]).join('')}</div>
              <div class="rep-info">
                <div class="rep-name">${esc(r.name)}</div>
              </div>
              <div class="rep-stats">
                <div class="rep-stat"><div class="rep-stat-val">${r.leadsAssigned}</div><div class="rep-stat-label">Leads</div></div>
                <div class="rep-stat"><div class="rep-stat-val">${r.avgResponseMin}m</div><div class="rep-stat-label">Resp. Time</div></div>
                <div class="rep-stat"><div class="rep-stat-val">${r.visitsBooked}</div><div class="rep-stat-label">Visits</div></div>
                <div class="rep-stat"><div class="rep-stat-val" style="color:var(--dash-green);">${r.conversionRate}%</div><div class="rep-stat-label">Conv.</div></div>
                <div class="rep-stat"><div class="rep-stat-val" style="color:${r.activeEscalations > 0 ? 'var(--dash-amber)' : 'var(--dash-text-3)'};">${r.activeEscalations}</div><div class="rep-stat-label">Escalations</div></div>
              </div>
            </div>
          `).join('')}
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
                <div class="channel-bar-name">${esc(c.source)}</div>
                <div class="channel-bar-track">
                  <div class="channel-bar-fill" style="width:${(c.leads/maxLeads)*100}%;background:${c.color};">${c.leads}</div>
                </div>
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
                    <td><span class="source-tag"><span class="source-tag-dot" style="background:${c.color};"></span>${esc(c.source)}</span></td>
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
              <div class="briefing-stat-val" data-countup="${B.newLeadsYesterday}">0</div>
              <div class="briefing-stat-label">New Leads Yesterday</div>
            </div>
            <div class="briefing-stat">
              <div class="briefing-stat-val" style="color:var(--dash-amber);" data-countup="${B.hotLeads}">0</div>
              <div class="briefing-stat-label">Hot Leads</div>
            </div>
            <div class="briefing-stat">
              <div class="briefing-stat-val" data-countup="${B.visitScheduled}">0</div>
              <div class="briefing-stat-label">Visits Scheduled</div>
            </div>
            <div class="briefing-stat">
              <div class="briefing-stat-val" style="color:var(--dash-red);" data-countup="${B.escalationsPending}">0</div>
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
                  <div class="briefing-note-name">${esc(n.name)}</div>
                  <div class="briefing-note-text">${esc(n.note)}</div>
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
            <div class="health-stat-value" data-countup="${H.apiCalls24h}">0</div>
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
        <div class="dash-card" style="margin-bottom:16px;">
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
        <div class="dash-card" style="margin-top:16px;">
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

  // Keyboard shortcut: Cmd+K → focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (currentSection !== 'leads') navigate('leads');
      setTimeout(() => {
        const searchInput = document.getElementById('lead-search');
        if (searchInput) searchInput.focus();
      }, 100);
    }
    // Escape closes drawer
    if (e.key === 'Escape') closeLeadDrawer();
  });

  // Route from hash
  const hash = window.location.hash.slice(1);
  navigate(hash && RENDERERS[hash] ? hash : 'overview');

  /* ── Public API for inline handlers ──────────────────────── */
  window.DashApp = {
    navigate,
    openLead: openLeadDrawer,
  };

})();
