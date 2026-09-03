/**
 * js/dashboard-live.js
 * Fetches real data from Supabase and patches window.DashboardData
 * with live values. The dashboard renders immediately with existing
 * mock data, then this refreshes every section that has real rows.
 *
 * Load order in dashboard.html (add BEFORE dashboard-app.js):
 *   <script src="js/supabase-client.js"></script>
 *   <script src="dashboard-data.js"></script>     ← keep, provides fallback
 *   <script src="js/dashboard-live.js"></script>  ← add this
 *   <script src="dashboard-app.js"></script>       ← keep, reads DashboardData
 *
 * Depends on: window.NeoSupabase (supabase-client.js)
 */
(function (global) {

  /* ── helpers ─────────────────────────────────────────────── */
  function getClientId() {
    try {
      var raw = localStorage.getItem('neo_auth');
      if (!raw) return null;
      var p = JSON.parse(raw);
      return (p.user && p.user.client_id) || null;
    } catch (_) { return null; }
  }

  function statusLabel(s) {
    var map = {
      'Follow-Up Running': 'Follow-up',
      'Needs Human Attention': 'Hot',
      'Visit Booked': 'Visit Booked',
      'Cold': 'Cold',
      'New': 'New',
    };
    return map[s] || s || 'New';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function fmtBudget(min, max) {
    if (!min && !max) return '—';
    function cr(v) { return v >= 1e7 ? (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr' : Math.round(v / 1e5) + 'L'; }
    if (!max || min === max) return '₹' + cr(min);
    return '₹' + cr(min) + '–' + cr(max);
  }

  /* ── source colour map ───────────────────────────────────── */
  var SRC_COLOR = {
    'WhatsApp':    '#25D366',
    'Instagram':   '#E1306C',
    'Facebook':    '#1877F2',
    'Website':     '#6366F1',
    'Email':       '#8B5CF6',
    'Manual':      '#64748B',
    'Voice Call':  '#F59E0B',
  };

  /* ── main ────────────────────────────────────────────────── */
  NeoSupabase.init(function (sb) {

    var clientId = getClientId();
    if (!clientId) {
      console.warn('[Neo] No client_id in session — showing mock data only');
      return;
    }

    Promise.all([
      sb.from('leads').select('*').eq('client_id', clientId),
      sb.from('site_visits').select('*, leads(full_name, phone)').eq('client_id', clientId).gte('scheduled_at', new Date(Date.now() - 7*86400000).toISOString()),
      sb.from('escalations').select('*, leads(full_name, phone)').eq('client_id', clientId).is('resolved_at', null),
      sb.from('conversations').select('lead_id').eq('client_id', clientId),
    ]).then(function (results) {
      var leadsRes  = results[0];
      var visitsRes = results[1];
      var escRes    = results[2];

      if (leadsRes.error) { console.error('[Neo] leads query', leadsRes.error); return; }

      var leads     = leadsRes.data  || [];
      var visits    = visitsRes.data || [];
      var escs      = escRes.data    || [];

      /* ── patch DashboardData methods ─────────────────────── */
      var _orig = global.DashboardData;

      /* getLeads() → Leads page */
      _orig._getLeadsLive = function () {
        return leads.map(function (r) {
          return {
            id:          r.lead_id,
            name:        r.full_name || '—',
            phone:       '+' + (r.phone || ''),
            source:      r.source || 'WhatsApp',
            capturedAt:  fmtDate(r.created_at),
            status:      statusLabel(r.status),
            score:       r.qualification_score || 0,
            budget:      fmtBudget(r.budget_min, r.budget_max),
            location:    r.preferred_location || '—',
            type:        r.property_type || '—',
            timeline:    r.timeline || '—',
            rep:         r.assigned_agent || '—',
          };
        });
      };

      /* getKPIs() → Overview page */
      var today = new Date(); today.setHours(0,0,0,0);
      var newToday  = leads.filter(function(l){ return new Date(l.created_at) >= today; });
      var hotLeads  = leads.filter(function(l){ return (l.qualification_score||0) >= 80; });
      var inDrip    = leads.filter(function(l){ return l.status === 'Follow-Up Running'; });
      var cold      = leads.filter(function(l){ return l.status === 'Cold'; });
      var visitBooked = leads.filter(function(l){ return l.status === 'Visit Booked'; });
      var closed    = leads.filter(function(l){ return l.status === 'Closed'; });

      /* source breakdown for today's leads */
      var srcCounts = {};
      newToday.forEach(function(l){ srcCounts[l.source] = (srcCounts[l.source]||0) + 1; });
      var bySrc = Object.keys(srcCounts).map(function(s){
        return { source: s, count: srcCounts[s], icon: s.toLowerCase().replace(' ',''), color: SRC_COLOR[s] || '#64748B' };
      }).sort(function(a,b){ return b.count - a.count; });

      _orig._getKPIsLive = function () {
        return {
          totalLeads: { today: newToday.length, week: leads.length, month: leads.length },
          newLast24h: { total: newToday.length, bySrc: bySrc },
          hotLeads:   hotLeads.length,
          unattendedEscalations: escs.length,
          siteVisits: {
            today: visits.filter(function(v){ return new Date(v.scheduled_at) >= today; }).length,
            week:  visits.length,
          },
          funnel: [
            { stage: 'Leads',        count: leads.length,       pct: 100 },
            { stage: 'Qualified',    count: hotLeads.length,    pct: leads.length ? +(hotLeads.length/leads.length*100).toFixed(1) : 0 },
            { stage: 'Visit Booked', count: visitBooked.length, pct: leads.length ? +(visitBooked.length/leads.length*100).toFixed(1) : 0 },
            { stage: 'Closed',       count: closed.length,      pct: leads.length ? +(closed.length/leads.length*100).toFixed(1) : 0 },
          ],
          followUpHealth: { activeInDrip: inDrip.length, cold: cold.length, total: inDrip.length + cold.length },
        };
      };

      /* getSiteVisits() → Site Visits page */
      _orig._getSiteVisitsLive = function () {
        return visits.map(function (v) {
          var lead = v.leads || {};
          var dt   = new Date(v.scheduled_at);
          return {
            id:       v.id,
            leadName: lead.full_name || '—',
            phone:    lead.phone ? '+' + lead.phone : '—',
            type:     v.property || '—',
            location: v.location || '—',
            rep:      '—',
            time:     dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),
            date:     dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),
            status:   v.status || 'Pending',
            reminded: v.reminder_sent ? 'Reminded' : 'No reminder',
          };
        });
      };

      /* getEscalations() → Escalations page */
      _orig._getEscalationsLive = function () {
        return escs.map(function (e) {
          var lead    = e.leads || {};
          var created = new Date(e.created_at);
          var elapsed = Math.floor((Date.now() - created.getTime()) / 60000); // minutes
          var hh = String(Math.floor(elapsed/60)).padStart(2,'0');
          var mm = String(elapsed % 60).padStart(2,'0');
          return {
            id:       e.id,
            leadName: lead.full_name || '—',
            phone:    lead.phone ? '+' + lead.phone : '—',
            reason:   e.reason || '—',
            priority: e.priority || 'high',
            channel:  e.channel || 'WhatsApp',
            rep:      '—',
            elapsed:  hh + ':' + mm,
          };
        });
      };

      /* channels breakdown */
      _orig._getChannelsLive = function () {
        var bySource = {};
        leads.forEach(function(l){
          var s = l.source || 'Manual';
          if (!bySource[s]) bySource[s] = { source: s, total: 0, hot: 0, junk: 0, color: SRC_COLOR[s]||'#64748B' };
          bySource[s].total++;
          if ((l.qualification_score||0) >= 80) bySource[s].hot++;
          if (l.is_junk) bySource[s].junk++;
        });
        return Object.values(bySource).sort(function(a,b){ return b.total - a.total; }).map(function(s){
          return {
            source:    s.source,
            total:     s.total,
            qualified: s.hot,
            hot:       s.hot,
            junk:      s.junk,
            ratio:     s.junk ? +(s.hot/s.junk).toFixed(1) : s.hot,
            color:     s.color,
          };
        });
      };

      /* Expose live overrides globally so dashboard-app.js can call them */
      global.DashboardLive = {
        getLeads:       _orig._getLeadsLive,
        getKPIs:        _orig._getKPIsLive,
        getSiteVisits:  _orig._getSiteVisitsLive,
        getEscalations: _orig._getEscalationsLive,
        getChannels:    _orig._getChannelsLive,
      };

      /* Dispatch event so dashboard-app.js can refresh the DOM */
      document.dispatchEvent(new CustomEvent('neo:live-data-ready', { detail: global.DashboardLive }));

      /* ── Realtime: patch + re-dispatch on any leads change ── */
      sb.channel('neo-leads-live')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'leads', filter: 'client_id=eq.' + clientId },
            function (payload) {
              /* update local array */
              var idx = leads.findIndex(function(l){ return l.lead_id === (payload.new||payload.old||{}).lead_id; });
              if (payload.eventType === 'INSERT') leads.push(payload.new);
              else if (payload.eventType === 'UPDATE' && idx >= 0) leads[idx] = payload.new;
              else if (payload.eventType === 'DELETE' && idx >= 0) leads.splice(idx, 1);
              document.dispatchEvent(new CustomEvent('neo:live-data-ready', { detail: global.DashboardLive }));
            })
        .subscribe();

      sb.channel('neo-visits-live')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'site_visits', filter: 'client_id=eq.' + clientId },
            function (payload) {
              var idx = visits.findIndex(function(v){ return v.id === (payload.new||payload.old||{}).id; });
              if (payload.eventType === 'INSERT') visits.push(payload.new);
              else if (payload.eventType === 'UPDATE' && idx >= 0) visits[idx] = payload.new;
              else if (payload.eventType === 'DELETE' && idx >= 0) visits.splice(idx, 1);
              document.dispatchEvent(new CustomEvent('neo:live-data-ready', { detail: global.DashboardLive }));
            })
        .subscribe();

      sb.channel('neo-escalations-live')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'escalations', filter: 'client_id=eq.' + clientId },
            function (payload) {
              var idx = escs.findIndex(function(e){ return e.id === (payload.new||payload.old||{}).id; });
              if (payload.eventType === 'INSERT') escs.push(payload.new);
              else if (payload.eventType === 'UPDATE' && idx >= 0) escs[idx] = payload.new;
              else if (payload.eventType === 'DELETE' && idx >= 0) escs.splice(idx, 1);
              document.dispatchEvent(new CustomEvent('neo:live-data-ready', { detail: global.DashboardLive }));
            })
        .subscribe();

    }).catch(function (ex) {
      console.error('[Neo] live data fetch failed', ex);
    });
  });

})(window);