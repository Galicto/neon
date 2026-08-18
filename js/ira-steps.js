/**
 * Ira — scroll-synced step visuals.
 *
 * The five mockups are authored ONCE, in the sticky desktop column.
 * Below the mobile breakpoint they are cloned into each step's
 * placeholder, so page source stays single-source-of-truth and the
 * desktop build never pays for markup it doesn't render.
 *
 * Activation is scroll-driven only. The steps are prose, not controls,
 * so they get no tab stop; keyboard scrolling moves the observer.
 */

const MOBILE_QUERY = "(max-width: 768px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReduced() {
  return window.matchMedia(REDUCED_QUERY).matches;
}

/* Count-up scoped to a container, so a metric animates when its
   panel becomes visible rather than on page load. */
function formatCount(el, n) {
  const suffix = el.dataset.suffix || "";
  const prefix = el.dataset.prefix || "";
  const decimals = parseInt(el.dataset.decimals || "0", 10);
  const value = decimals ? n.toFixed(decimals) : String(Math.round(n));
  return prefix + value + suffix;
}

function runCountUps(container) {
  container.querySelectorAll(".count-up").forEach((el) => {
    if (el.dataset.counted) return;
    const target = parseFloat(el.dataset.target);
    if (Number.isNaN(target)) return;

    el.dataset.counted = "1";
    const finalText = formatCount(el, target);

    const probe = el.cloneNode(false);
    probe.textContent = finalText;
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;";
    el.parentNode.appendChild(probe);
    el.style.minWidth = probe.offsetWidth + "px";
    probe.remove();

    if (prefersReduced() || target === 0) {
      el.textContent = finalText;
      return;
    }

    el.textContent = formatCount(el, 0);
    const duration = 640;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatCount(el, target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    };
    requestAnimationFrame(tick);
  });
}

export function initIraSteps() {
  const section = document.getElementById("how-ira-works");
  if (!section) return;

  const steps = Array.from(section.querySelectorAll(".hw-step"));
  const column = section.querySelector("#hw-visual-col");
  if (!steps.length || !column) return;

  const sourceVisuals = Array.from(column.querySelectorAll(".hw-visual"));

  /* ── Mobile cloning ─────────────────────────────────────────── */
  let cloned = false;

  function cloneForMobile() {
    if (cloned) return;
    steps.forEach((step) => {
      const slot = step.querySelector(".hw-visual-mobile");
      const source = sourceVisuals.find(
        (v) => v.id === `hw-vis-${step.dataset.step}`
      );
      if (!slot || !source || slot.children.length) return;

      const copy = source.cloneNode(true);
      copy.removeAttribute("id");
      // Cloned count-ups must be able to run independently.
      copy.querySelectorAll(".count-up").forEach((el) => {
        delete el.dataset.counted;
        el.style.minWidth = "";
        el.textContent = formatCount(el, 0);
      });
      slot.appendChild(copy);
      slot.removeAttribute("aria-hidden");
    });
    cloned = true;
  }

  const mobile = window.matchMedia(MOBILE_QUERY);
  if (mobile.matches) cloneForMobile();
  mobile.addEventListener("change", (e) => {
    if (e.matches) cloneForMobile();
  });

  /* ── Activation ─────────────────────────────────────────────── */
  let current = null;

  function activate(stepNum) {
    if (current === stepNum) return;
    current = stepNum;

    steps.forEach((step) => {
      const isActive = step.dataset.step === stepNum;
      step.classList.toggle("is-active", isActive);

      const mobileVis = step.querySelector(".hw-visual-mobile .hw-visual");
      if (mobileVis) {
        mobileVis.classList.toggle("is-active", isActive);
        if (isActive) runCountUps(mobileVis);
      }
    });

    sourceVisuals.forEach((vis) => {
      const isActive = vis.id === `hw-vis-${stepNum}`;
      vis.classList.toggle("is-active", isActive);
      // Only the panel on screen should be readable; the other four are
      // stacked underneath it at opacity 0.
      vis.setAttribute("aria-hidden", isActive ? "false" : "true");
      if (isActive) runCountUps(vis);
    });
  }

  /* On mobile every visual is inline and permanently visible, so
     count-ups are driven by their own observer instead of activation. */
  function observeMobileVisuals() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runCountUps(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );
    steps.forEach((step) => {
      const vis = step.querySelector(".hw-visual-mobile .hw-visual");
      if (vis) io.observe(vis);
    });
  }

  if (mobile.matches) observeMobileVisuals();
  mobile.addEventListener("change", (e) => {
    if (e.matches) observeMobileVisuals();
  });

  /* ── Scroll sync ────────────────────────────────────────────── */
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) activate(visible[0].target.dataset.step);
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: "-30% 0px -30% 0px" }
    );
    steps.forEach((step) => observer.observe(step));
  }

  activate("1");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIraSteps);
} else {
  initIraSteps();
}
