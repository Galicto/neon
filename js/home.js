/**
 * Neo Automations — Homepage motion
 *
 * Two sequences: the hero "run" (enquiry → CRM update) and the
 * three-stage flow. Both are driven from one small scheduler and are
 * gated on visibility, so nothing animates while it is off screen —
 * the previous hero console ran a setInterval for the whole session.
 *
 * Under prefers-reduced-motion both render their finished state
 * immediately and never tick.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A cancellable chain of delayed callbacks. Returned handle lets an
 * IntersectionObserver stop a sequence mid-flight without leaking
 * timers, and restart it cleanly from the top.
 */
function createSequence(steps, { loop = false, loopDelay = 0 } = {}) {
  let timers = [];
  let running = false;

  function clear() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function run() {
    clear();
    let elapsed = 0;
    steps.forEach(({ at, fn }) => {
      elapsed = at;
      timers.push(setTimeout(fn, at));
    });
    if (loop) {
      timers.push(setTimeout(run, elapsed + loopDelay));
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      run();
    },
    stop() {
      running = false;
      clear();
    },
  };
}

/** Runs `sequence` only while `el` is on screen. */
function gateOnVisibility(el, sequence) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) sequence.start();
        else sequence.stop();
      });
    },
    { threshold: 0.25 }
  );
  observer.observe(el);
}

/* ── Hero run ─────────────────────────────────────────────────── */

function initHeroRun() {
  const run = document.getElementById("hero-run");
  if (!run) return;

  const steps = [...run.querySelectorAll(".run-step")];
  const elapsedEl = document.getElementById("run-elapsed");
  if (!steps.length) return;

  // Seconds each row claims, used both for the row's own label and to
  // drive the total in the footer.
  const marks = steps.map((step) => {
    const raw = step.querySelector(".run-t")?.textContent ?? "0";
    return parseFloat(raw);
  });
  const total = marks[marks.length - 1];

  const format = (s) => `${Math.round(s)}s`;

  function setElapsed(value) {
    if (elapsedEl) elapsedEl.textContent = format(value);
  }

  function settle() {
    steps.forEach((step) => {
      step.classList.remove("is-active");
      step.classList.add("is-done");
    });
    setElapsed(total);
  }

  if (reducedMotion) {
    settle();
    return;
  }

  function reset() {
    steps.forEach((step) => step.classList.remove("is-active", "is-done"));
    setElapsed(0);
  }

  // Ease the footer total from the previous mark to the current one so
  // the number moves with the row rather than snapping.
  let countFrame = null;
  function countTo(from, to, duration) {
    cancelAnimationFrame(countFrame);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setElapsed(from + (to - from) * eased);
      if (t < 1) countFrame = requestAnimationFrame(tick);
    };
    countFrame = requestAnimationFrame(tick);
  }

  const STAGGER = 720;
  const LEAD_IN = 180;

  const timeline = [{ at: 0, fn: reset }];

  steps.forEach((step, i) => {
    const activeAt = LEAD_IN + i * STAGGER;

    timeline.push({
      at: activeAt,
      fn: () => {
        steps.forEach((s) => s.classList.remove("is-active"));
        step.classList.add("is-active");
        countTo(i === 0 ? 0 : marks[i - 1], marks[i], STAGGER * 0.7);
      },
    });

    timeline.push({
      at: activeAt + STAGGER * 0.72,
      fn: () => {
        step.classList.remove("is-active");
        step.classList.add("is-done");
        setElapsed(marks[i]);
      },
    });
  });

  const sequence = createSequence(timeline, { loop: true, loopDelay: 2800 });
  gateOnVisibility(run, sequence);
}

/* ── Three-stage flow ─────────────────────────────────────────── */

function initFlow() {
  const flow = document.getElementById("flow");
  if (!flow) return;

  const stages = [...flow.querySelectorAll(".flow-stage")];
  if (!stages.length) return;

  if (reducedMotion) {
    stages.forEach((stage) => stage.classList.add("is-done"));
    return;
  }

  const STAGGER = 900;

  const timeline = [
    {
      at: 0,
      fn: () => stages.forEach((s) => s.classList.remove("is-active", "is-done")),
    },
  ];

  stages.forEach((stage, i) => {
    timeline.push({
      at: 200 + i * STAGGER,
      fn: () => {
        stages.forEach((s) => s.classList.remove("is-active"));
        stage.classList.add("is-active");
        // Mark everything up to here as handed off, so the connectors
        // read as a path rather than three unrelated highlights.
        stages.slice(0, i + 1).forEach((s) => s.classList.add("is-done"));
      },
    });
  });

  timeline.push({
    at: 200 + stages.length * STAGGER,
    fn: () => stages.forEach((s) => s.classList.remove("is-active")),
  });

  const sequence = createSequence(timeline, { loop: true, loopDelay: 2400 });
  gateOnVisibility(flow, sequence);
}

initHeroRun();
initFlow();
