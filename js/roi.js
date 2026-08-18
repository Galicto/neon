/* ═══════════════════════════════════════════════════════════════
   Neo Automations — Pricing ROI calculator
   Conservative leakage model. Assumptions are on-page.
   ═══════════════════════════════════════════════════════════════ */

(() => {
  const NEO_COVERAGE = 0.95;

  const INDUSTRIES = {
    realty: {
      leads: 120, leadsMin: 10, leadsMax: 1000, leadsStep: 10,
      value: 8000000, valueMin: 1000000, valueMax: 50000000, valueStep: 500000,
      close: 5,
    },
    clinic: {
      leads: 180, leadsMin: 20, leadsMax: 800, leadsStep: 10,
      value: 3500, valueMin: 500, valueMax: 50000, valueStep: 500,
      close: 22,
    },
    education: {
      leads: 80, leadsMin: 10, leadsMax: 600, leadsStep: 10,
      value: 45000, valueMin: 5000, valueMax: 300000, valueStep: 5000,
      close: 12,
    },
    agency: {
      leads: 60, leadsMin: 10, leadsMax: 500, leadsStep: 10,
      value: 150000, valueMin: 10000, valueMax: 2000000, valueStep: 10000,
      close: 10,
    },
  };

  const SPEED = {
    fast: 0.8,
    hour: 0.55,
    morning: 0.4,
    late: 0.25,
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);

  const el = {
    leads: $('roi-leads'),
    value: $('roi-value'),
    close: $('roi-close'),
    dispLeads: $('roi-disp-leads'),
    dispValue: $('roi-disp-value'),
    dispClose: $('roi-disp-close'),
    markValueMin: $('roi-mark-value-min'),
    markValueMid: $('roi-mark-value-mid'),
    markValueMax: $('roi-mark-value-max'),
    leak: $('roi-leak'),
    recoverable: $('roi-recoverable'),
    extraDeals: $('roi-extra-deals'),
    reachedNow: $('roi-reached-now'),
    reachedNeo: $('roi-reached-neo'),
    revNow: $('roi-rev-now'),
    revNeo: $('roi-rev-neo'),
    coverageNow: $('roi-coverage-now'),
    coverageNeo: $('roi-coverage-neo'),
  };

  if (!el.leads || !el.value || !el.close || !el.leak) return;

  let speed = 'morning';
  let tweenGen = 0;
  const last = { leak: 0, recoverable: 0, extraDeals: 0, revNow: 0, revNeo: 0 };

  function formatINR(n) {
    const sign = n < 0 ? '−' : '';
    const abs = Math.abs(n);
    if (abs >= 10000000) {
      const cr = abs / 10000000;
      return sign + '₹' + parseFloat((cr >= 10 ? cr.toFixed(1) : cr.toFixed(2))) + 'Cr';
    }
    if (abs >= 100000) {
      const L = abs / 100000;
      return sign + '₹' + parseFloat((L >= 10 ? L.toFixed(1) : L.toFixed(2))) + 'L';
    }
    return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
  }

  function formatDeal(n) {
    return formatINR(n);
  }

  function setFill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const v = Number(input.value);
    const pct = max === min ? 0 : ((v - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  function compute() {
    const leads = Number(el.leads.value);
    const value = Number(el.value.value);
    const close = Number(el.close.value) / 100;
    const coverageNow = SPEED[speed] ?? SPEED.morning;
    const coverageNeo = NEO_COVERAGE;

    const reachedNow = Math.round(leads * coverageNow);
    const reachedNeo = Math.round(leads * coverageNeo);
    const revNow = reachedNow * close * value;
    const revNeo = reachedNeo * close * value;
    const leak = Math.max(0, (leads - reachedNow) * close * value);
    const recoverable = Math.max(0, revNeo - revNow);
    const extraDeals = Math.max(0, (reachedNeo - reachedNow) * close);

    return {
      leads,
      value,
      closePct: Number(el.close.value),
      coverageNow,
      coverageNeo,
      reachedNow,
      reachedNeo,
      revNow,
      revNeo,
      leak,
      recoverable,
      extraDeals,
    };
  }

  function tweenNumber(from, to, duration, onFrame, onDone) {
    const gen = ++tweenGen;
    if (reducedMotion || duration <= 0) {
      onFrame(to);
      onDone?.();
      return;
    }
    const t0 = performance.now();
    function frame(now) {
      if (gen !== tweenGen) return;
      const t = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - t, 3);
      onFrame(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(frame);
      else onDone?.();
    }
    requestAnimationFrame(frame);
  }

  function apply(animate) {
    const d = compute();

    el.dispLeads.textContent = d.leads + ' / month';
    el.dispValue.textContent = formatDeal(d.value);
    el.dispClose.textContent = d.closePct + '%';

    el.leads.setAttribute('aria-valuetext', d.leads + ' leads per month');
    el.value.setAttribute('aria-valuetext', formatDeal(d.value));
    el.close.setAttribute('aria-valuetext', d.closePct + ' percent');

    el.reachedNow.textContent = String(d.reachedNow);
    el.reachedNeo.textContent = String(d.reachedNeo);
    if (el.coverageNow) el.coverageNow.textContent = Math.round(d.coverageNow * 100) + '%';
    if (el.coverageNeo) el.coverageNeo.textContent = Math.round(d.coverageNeo * 100) + '%';

    const extraLabel =
      d.extraDeals < 1
        ? d.extraDeals.toFixed(1)
        : d.extraDeals < 10
          ? d.extraDeals.toFixed(1)
          : String(Math.round(d.extraDeals));
    if (el.extraDeals) el.extraDeals.textContent = extraLabel;

    setFill(el.leads);
    setFill(el.value);
    setFill(el.close);

    const from = { ...last };
    const paint = (leak, rec, revNow, revNeo) => {
      el.leak.textContent = formatINR(leak);
      el.recoverable.textContent = formatINR(rec);
      el.revNow.textContent = formatINR(revNow);
      el.revNeo.textContent = formatINR(revNeo);
    };

    const commit = () => {
      last.leak = d.leak;
      last.recoverable = d.recoverable;
      last.extraDeals = d.extraDeals;
      last.revNow = d.revNow;
      last.revNeo = d.revNeo;
      paint(d.leak, d.recoverable, d.revNow, d.revNeo);
    };

    if (!animate) {
      commit();
      return;
    }

    tweenNumber(0, 1, 280, (p) => {
      paint(
        from.leak + (d.leak - from.leak) * p,
        from.recoverable + (d.recoverable - from.recoverable) * p,
        from.revNow + (d.revNow - from.revNow) * p,
        from.revNeo + (d.revNeo - from.revNeo) * p
      );
    }, commit);
  }

  function applyIndustry(key) {
    const spec = INDUSTRIES[key];
    if (!spec) return;

    el.leads.min = spec.leadsMin;
    el.leads.max = spec.leadsMax;
    el.leads.step = spec.leadsStep;
    el.leads.value = spec.leads;

    el.value.min = spec.valueMin;
    el.value.max = spec.valueMax;
    el.value.step = spec.valueStep;
    el.value.value = spec.value;

    el.close.value = spec.close;

    if (el.markValueMin) el.markValueMin.textContent = formatDeal(spec.valueMin);
    if (el.markValueMid) el.markValueMid.textContent = formatDeal((spec.valueMin + spec.valueMax) / 2);
    if (el.markValueMax) el.markValueMax.textContent = formatDeal(spec.valueMax) + '+';

    apply(true);
  }

  document.querySelectorAll('[data-roi-industry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-roi-industry]').forEach((b) => {
        b.classList.toggle('is-on', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      applyIndustry(btn.dataset.roiIndustry);
    });
  });

  document.querySelectorAll('[data-roi-speed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-roi-speed]').forEach((b) => {
        b.classList.toggle('is-on', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      speed = btn.dataset.roiSpeed;
      apply(true);
    });
  });

  ['leads', 'value', 'close'].forEach((key) => {
    el[key].addEventListener('input', () => apply(true));
  });

  applyIndustry('realty');
})();
