/**
 * Ira — hero conversation demo.
 *
 * Hidden bubbles are `display: none`, so they don't occupy layout and
 * clip the visible line (the previous "one orphan sentence on a black
 * screen" bug). The first inbound message is authored with `.show` so
 * the phone is never empty.
 *
 * Pace is WhatsApp-like: ~180ms enter, short dwell, no smooth-scroll.
 * Loops by fading the extra messages off rather than wiping the pane.
 */

const READ_BASE_MS = 380;
const READ_PER_CHAR_MS = 12;
const READ_MAX_MS = 1100;
const TYPING_MS = 520;
const LOOP_PAUSE_MS = 1600;

export function initIraHeroChat() {
  const pane = document.getElementById("ira-hero-chat");
  if (!pane) return;

  const items = Array.from(pane.children).filter(
    (el) =>
      el.classList.contains("chat-bubble") || el.classList.contains("chat-typing")
  );
  if (!items.length) return;

  const status = document.querySelector("[data-chat-status]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function showAll() {
    items.forEach((el) => {
      if (el.classList.contains("chat-typing")) el.classList.remove("show");
      else el.classList.add("show");
    });
    if (status) status.textContent = "online";
  }

  if (reduced.matches) {
    showAll();
    return;
  }

  let timer = null;
  let index = 0;
  let running = false;

  const wait = (ms) =>
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    });

  function dwellFor(el) {
    const len = (el.textContent || "").trim().length;
    return Math.min(READ_BASE_MS + len * READ_PER_CHAR_MS, READ_MAX_MS);
  }

  /* Keep the opening inbound message on screen so a loop never flashes
     an empty device. Everything after it is replayed. */
  const keepShown = items.findIndex(
    (el) => el.classList.contains("chat-bubble") && el.classList.contains("in")
  );

  function resetToOpener() {
    items.forEach((el, i) => {
      if (i === keepShown && el.classList.contains("chat-bubble")) {
        el.classList.add("show");
      } else {
        el.classList.remove("show");
      }
    });
    index = keepShown < 0 ? 0 : keepShown + 1;
    if (status) status.textContent = "online";
  }

  async function play() {
    if (running) return;
    running = true;

    if (!items[0].classList.contains("show")) {
      items[0].classList.add("show");
    }
    if (index === 0 && items[0].classList.contains("chat-bubble")) {
      index = 1;
    }

    while (running) {
      if (index >= items.length) {
        await wait(LOOP_PAUSE_MS);
        if (!running) return;
        resetToOpener();
        await wait(280);
        if (!running) return;
        continue;
      }

      const el = items[index];

      if (el.classList.contains("chat-typing")) {
        if (status) status.textContent = "typing…";
        el.classList.add("show");
        await wait(TYPING_MS);
        if (!running) return;
        el.classList.remove("show");
        if (status) status.textContent = "online";
      } else {
        el.classList.add("show");
        await wait(dwellFor(el));
        if (!running) return;
      }

      index += 1;
    }
  }

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) play();
          else stop();
        });
      },
      { threshold: 0.25 }
    );
    io.observe(pane.closest(".device") || pane);
  } else {
    play();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (pane.getBoundingClientRect().top < window.innerHeight) play();
  });

  reduced.addEventListener("change", (e) => {
    if (e.matches) {
      stop();
      showAll();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIraHeroChat);
} else {
  initIraHeroChat();
}
