/**
 * Hero operating-system field.
 * Canvas 2D (no WebGL / no extra libs). Cursor-reactive on desktop,
 * auto-play on touch. Pauses off-screen. Respects reduced motion.
 */
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const JOURNEYS = [
  { from: "wa", to: "core", label: "WhatsApp lead", short: "WA in", time: "0.4s" },
  { from: "web", to: "core", label: "Qualified intent", short: "Qualified", time: "14s" },
  { from: "core", to: "cal", label: "Meeting booked", short: "Booked", time: "31s" },
  { from: "core", to: "crm", label: "CRM updated", short: "CRM sync", time: "41s" },
];

function readTheme(el) {
  const s = getComputedStyle(el);
  return {
    accent: s.getPropertyValue("--accent").trim() || "#8b7bff",
    accentGlow: s.getPropertyValue("--accent-glow").trim() || "rgba(139,123,255,0.28)",
    accentSurface: s.getPropertyValue("--accent-surface").trim() || "rgba(139,123,255,0.1)",
    text: s.getPropertyValue("--text-primary").trim() || "#e8eaf0",
    muted: s.getPropertyValue("--text-muted").trim() || "#868b9a",
    border: s.getPropertyValue("--border-strong").trim() || "#343947",
    card: s.getPropertyValue("--bg-card").trim() || "#12131a",
    success: s.getPropertyValue("--success").trim() || "#3ddc97",
    bg: s.getPropertyValue("--bg").trim() || "#08080b",
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function bezierPoint(t, a, b, c, d) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function controls(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) < 10) {
    return {
      c1: { x: a.x + dx * 0.4, y: a.y },
      c2: { x: a.x + dx * 0.6, y: b.y },
    };
  }
  return {
    c1: { x: a.x + dx * 0.5, y: a.y },
    c2: { x: a.x + dx * 0.5, y: b.y },
  };
}

function drawMark(ctx, x, y, size, color) {
  const s = size / 32;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  roundRect(ctx, 1.54, 2.28, 10.14, 10.14, 3.85);
  ctx.fill();
  roundRect(ctx, 12.14, 13.31, 9.89, 9.89, 3.76);
  ctx.fill();
  roundRect(ctx, 3.34, 22.08, 9.15, 9.15, 3.48);
  ctx.fill();
  roundRect(ctx, 22.06, 22.19, 8.65, 8.65, 3.29);
  ctx.fill();

  ctx.save();
  ctx.translate(11.85, 12.8);
  ctx.rotate((46.14 * Math.PI) / 180);
  roundRect(ctx, -7.56, -1.85, 15.13, 3.71, 1.85);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(12.5, 22.46);
  ctx.rotate((137.51 * Math.PI) / 180);
  roundRect(ctx, -6.22, -1.85, 12.44, 3.71, 1.85);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(21.74, 22.38);
  ctx.rotate((41.6 * Math.PI) / 180);
  roundRect(ctx, -6.22, -1.85, 12.44, 3.71, 1.85);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function layout(w, h, compact) {
  const top = compact ? 40 : 56;
  const hud = compact ? 34 : 56;
  const side = compact ? 52 : 72;
  const cx = w * 0.5;
  const cy = top + (h - top - hud) / 2;
  const ox = Math.max(compact ? 68 : 140, Math.min(w / 2 - side, compact ? w * 0.34 : w * 0.33));
  const usable = (h - top - hud) / 2;
  const oy = Math.max(compact ? 32 : 88, Math.min(usable - (compact ? 22 : 44), compact ? 46 : usable * 0.72));
  const short = compact;
  return {
    wa: { x: cx - ox, y: cy - oy, label: short ? "WA" : "WhatsApp" },
    web: { x: cx - ox, y: cy, label: "Web" },
    ig: { x: cx - ox, y: cy + oy, label: short ? "IG" : "Instagram" },
    core: { x: cx, y: cy, label: "Neo" },
    crm: { x: cx + ox, y: cy - oy, label: "CRM" },
    cal: { x: cx + ox, y: cy, label: short ? "Cal" : "Calendar" },
    team: { x: cx + ox, y: cy + oy, label: "Team" },
  };
}

function hexToRgb(input) {
  const c = input.trim();
  if (c.startsWith("rgb")) {
    const m = c.match(/[\d.]+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2] } : { r: 139, g: 123, b: 255 };
  }
  let h = c.replace("#", "");
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function initHeroEngine() {
  const stage = document.getElementById("hero-stage");
  const canvas = document.getElementById("hero-engine");
  const hud = document.getElementById("hero-hud-status");
  if (!stage || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    if (hud) hud.textContent = "Live field unavailable on this browser.";
    return;
  }

  const compact = () => stage.clientWidth < 560 || stage.clientHeight < 360;
  let theme = readTheme(stage);
  let nodes = layout(1, 1, false);
  let w = 0;
  let h = 0;
  let dpr = 1;
  let visible = false;
  let raf = 0;
  let last = 0;
  let boot = 0;
  let pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, on: false };
  let journeyIndex = 0;
  let packetT = 0;
  let packetHold = 0.35;
  const sparks = [];
  const MAX_SPARKS = 18;

  function setHud(text) {
    if (hud) hud.textContent = text;
  }

  function hudFor(j) {
    const name = compact() ? j.short : j.label;
    return `${name} · ${j.time}`;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    dpr = compact()
      ? Math.min(1.25, window.devicePixelRatio || 1)
      : Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes = layout(w, h, compact());
  }

  function magnet(node, amount) {
    if (!pointer.on) return node;
    const mx = pointer.x * w;
    const my = pointer.y * h;
    const dx = mx - node.x;
    const dy = my - node.y;
    const dist = Math.hypot(dx, dy) || 1;
    const pull = Math.max(0, 1 - dist / 240) * amount;
    return { x: node.x + (dx / dist) * pull, y: node.y + (dy / dist) * pull, label: node.label };
  }

  function drawField(cx, cy, now) {
    const step = compact() ? 32 : 24;
    ctx.fillStyle = theme.border;
    ctx.globalAlpha = compact() ? 0.22 : 0.2;
    for (let x = step; x < w; x += step) {
      for (let y = step; y < h; y += step) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;

    const ox = Math.abs((nodes.web?.x ?? cx) - cx) || 160;
    const oy = Math.abs((nodes.wa?.y ?? cy) - cy) || 120;
    const rInner = compact() ? Math.min(52, ox * 0.55) : Math.min(ox * 0.42, 92);
    const rMid = ox;
    const rOut = Math.hypot(ox, oy);
    const rings = compact() ? [rInner, rMid] : [rInner, rMid, rOut];
    const rgb = hexToRgb(theme.accent);

    rings.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = i === 0 ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.32)` : theme.border;
      ctx.globalAlpha = i === 0 ? 0.95 : 0.32;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    if (reduced) return;

    const rot = now / 14000;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, rot, rot + 0.9);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, rMid, -rot * 0.7, -rot * 0.7 + 0.45);
    ctx.strokeStyle = theme.success;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawEdge(a, b, progress, lit) {
    const { c1, c2 } = controls(a, b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.strokeStyle = lit ? theme.accent : theme.border;
    ctx.globalAlpha = lit ? 0.72 : 0.22 * progress;
    ctx.lineWidth = lit ? 1.7 : 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawCapsule(p, label, active) {
    ctx.font = compact()
      ? "500 10px Geist Mono, ui-monospace, monospace"
      : "500 12px Geist Mono, ui-monospace, monospace";
    const tw = ctx.measureText(label).width;
    const pw = tw + (compact() ? 12 : 20);
    const ph = compact() ? 18 : 26;
    roundRect(ctx, p.x - pw / 2, p.y - ph / 2, pw, ph, ph / 2);
    ctx.fillStyle = theme.card;
    ctx.fill();
    ctx.strokeStyle = active ? theme.accent : theme.border;
    ctx.lineWidth = active ? 1.4 : 1;
    ctx.stroke();
    if (active) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = active ? theme.text : theme.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, p.x, p.y + 0.5);
  }

  function drawCore(p, pulse) {
    const rgb = hexToRgb(theme.accent);
    const radius = compact() ? 46 : 64;
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, radius + pulse * 16);
    g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.32 + pulse * 0.12})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, compact() ? 26 : 32, 0, Math.PI * 2);
    ctx.fillStyle = theme.card;
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawMark(ctx, p.x, p.y, compact() ? 22 : 30 + pulse * 2, theme.text);

    ctx.font = "500 10px Geist Mono, ui-monospace, monospace";
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("NEO", p.x, p.y + (compact() ? 30 : 38));
  }

  function spawnSparks(x, y, n) {
    const count = Math.min(n, MAX_SPARKS - sparks.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * (0.35 + Math.random() * 0.9),
        vy: Math.sin(a) * (0.35 + Math.random() * 0.9),
        life: 1,
      });
    }
  }

  function drawLanes() {
    if (compact()) return;
    const left = nodes.wa.x;
    const right = nodes.crm.x;
    ctx.font = "500 10px Geist Mono, ui-monospace, monospace";
    ctx.fillStyle = theme.muted;
    ctx.globalAlpha = 0.7;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillText("CAPTURE", left, 20);
    ctx.fillText("OPERATE", right, 20);
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    if (!visible && !reduced) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;

    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;

    if (!finePointer && !reduced) {
      pointer.tx = 0.5 + Math.sin(now / 3400) * 0.14;
      pointer.ty = 0.5 + Math.cos(now / 4300) * 0.1;
      pointer.on = true;
    }

    if (boot < 1) boot = Math.min(1, boot + dt / 1.05);

    ctx.clearRect(0, 0, w, h);

    const pulse = reduced ? 0 : 0.5 + 0.5 * Math.sin(now / 780);
    const drawn = {};
    Object.keys(nodes).forEach((k) => {
      drawn[k] = magnet(nodes[k], k === "core" ? 5 : 8);
    });

    drawField(drawn.core.x, drawn.core.y, now);
    drawLanes();

    const edges = [
      ["wa", "core"],
      ["web", "core"],
      ["ig", "core"],
      ["core", "crm"],
      ["core", "cal"],
      ["core", "team"],
    ];

    const journey = JOURNEYS[journeyIndex];
    edges.forEach(([a, b], i) => {
      const appear = Math.min(1, Math.max(0, (boot - i * 0.07) / 0.32));
      if (appear <= 0) return;
      const lit =
        !reduced &&
        journey &&
        ((journey.from === a && journey.to === b) || (journey.from === b && journey.to === a));
      drawEdge(drawn[a], drawn[b], appear, lit);
    });

    if (!reduced && boot >= 1) {
      const a = drawn[journey.from];
      const b = drawn[journey.to];
      if (packetHold > 0) {
        packetHold -= dt;
      } else {
        packetT += dt / 1.28;
        if (packetT >= 1) {
          spawnSparks(b.x, b.y, compact() ? 3 : 7);
          packetT = 0;
          packetHold = 0.48;
          journeyIndex = (journeyIndex + 1) % JOURNEYS.length;
          const next = JOURNEYS[journeyIndex];
          setHud(hudFor(next));
        } else {
          const { c1, c2 } = controls(a, b);
          const trail = compact() ? 5 : 9;
          for (let i = trail; i >= 0; i--) {
            const t = packetT - i * 0.035;
            if (t <= 0) continue;
            const p = bezierPoint(t, a, c1, c2, b);
            ctx.beginPath();
            ctx.arc(p.x, p.y, i === 0 ? 3.4 : 2.1, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? theme.success : theme.accent;
            ctx.globalAlpha = i === 0 ? 1 : 0.12 + (1 - i / trail) * 0.35;
            ctx.fill();
          }
          const head = bezierPoint(packetT, a, c1, c2, b);
          ctx.globalAlpha = 0.28;
          ctx.beginPath();
          ctx.arc(head.x, head.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = theme.accentGlow;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= dt * 1.85;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = s.life;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(s.x, s.y, 1.6, 1.6);
      ctx.globalAlpha = 1;
    }

    const active = {};
    if (journey && !reduced) {
      active[journey.from] = true;
      active[journey.to] = true;
    }

    ["wa", "web", "ig", "crm", "cal", "team"].forEach((k) => {
      drawCapsule(drawn[k], drawn[k].label, !!active[k]);
    });
    drawCore(drawn.core, pulse);
    stage.classList.add("is-live");

    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  theme = readTheme(stage);

  function paintStatic() {
    visible = true;
    last = performance.now();
    tick(last);
    stop();
  }

  if (reduced) {
    boot = 1;
    setHud("Lead → CRM · <60s");
    paintStatic();
  } else {
    setHud(hudFor(JOURNEYS[0]));
  }

  function inView() {
    const r = stage.getBoundingClientRect();
    return r.height > 0 && r.bottom > 8 && r.top < window.innerHeight - 8;
  }

  function setRunning(on) {
    visible = on;
    if (reduced) return;
    if (on) start();
    else stop();
  }

  const vis = new IntersectionObserver(
    (entries) => {
      const hit = entries.some((e) => e.isIntersecting) || inView();
      setRunning(hit);
    },
    { threshold: [0, 0.05, 0.12] }
  );
  vis.observe(stage);
  setRunning(inView());

  document.addEventListener("visibilitychange", () => {
    if (reduced) return;
    if (document.hidden) stop();
    else if (inView()) setRunning(true);
  });

  const ro = new ResizeObserver(() => {
    resize();
    if (reduced) paintStatic();
  });
  ro.observe(stage);

  if (finePointer) {
    stage.addEventListener(
      "pointermove",
      (e) => {
        const r = stage.getBoundingClientRect();
        pointer.tx = (e.clientX - r.left) / r.width;
        pointer.ty = (e.clientY - r.top) / r.height;
        pointer.on = true;
      },
      { passive: true }
    );
    stage.addEventListener("pointerleave", () => {
      pointer.tx = 0.5;
      pointer.ty = 0.5;
      pointer.on = false;
    });
  }

  const mo = new MutationObserver(() => {
    theme = readTheme(stage);
    if (reduced) {
      visible = true;
      tick(performance.now());
    }
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

const kick = () => initHeroEngine();
if (reduced) {
  kick();
} else if ("requestIdleCallback" in window) {
  requestIdleCallback(kick, { timeout: 220 });
} else {
  requestAnimationFrame(() => setTimeout(kick, 0));
}
