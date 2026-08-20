/**
 * Use-cases live run.
 * Turns the static step list into a macOS-style conversation:
 * incoming event, typing beat, outgoing confirmation — then loops.
 */
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const READ =
    '<span class="wf-read" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M1.2 8.4l2.2 2.2 4.2-5.2"/><path d="M6.2 8.4l2.2 2.2 6.2-7"/></svg></span>';

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function row(side) {
    const el = document.createElement("div");
    el.className = "wf-row is-" + side;
    return el;
  }

  function bind(chain) {
    const source = Array.from(chain.querySelectorAll(".wf-node"));
    if (!source.length) return;

    const steps = source.map((node) => {
      const status = node.querySelector(".wf-node-status");
      return {
        icon: (node.querySelector(".wf-node-dot") || {}).innerHTML || "",
        copy: ((node.querySelector(".wf-node-copy") || {}).textContent || "").trim(),
        status: ((status || {}).textContent || "").trim(),
      };
    });

    const visual = chain.closest(".wf-visual");
    const panel = chain.closest(".case-visual");

    chain.classList.add("wf-demo");
    chain.replaceChildren();

    const chrome = document.createElement("div");
    chrome.className = "wf-chrome";
    chrome.innerHTML =
      '<span class="wf-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="wf-chrome-title"><span class="wf-live-pulse" aria-hidden="true"></span>Live workflow</span>' +
      '<span class="wf-clock">9:41</span>';

    const thread = document.createElement("div");
    thread.className = "wf-thread";
    thread.setAttribute("role", "log");
    thread.setAttribute("aria-live", "polite");
    thread.setAttribute("aria-label", "Live workflow");

    const ticks = document.createElement("div");
    ticks.className = "wf-ticks";
    ticks.setAttribute("role", "tablist");
    ticks.setAttribute("aria-label", "Workflow steps");

    const tickBtns = steps.map((_, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wf-tick";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-label", "Step " + (i + 1));
      ticks.appendChild(btn);
      return btn;
    });

    chain.append(chrome, thread, ticks);

    function incoming(step, animate) {
      const wrap = row("in");
      const avatar = document.createElement("span");
      avatar.className = "wf-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.innerHTML = step.icon;
      const msg = document.createElement("div");
      msg.className = "wf-msg is-in";
      msg.textContent = step.copy;
      if (!animate) msg.style.animation = "none";
      wrap.append(avatar, msg);
      thread.appendChild(wrap);
      return wrap;
    }

    function outgoing(step, animate) {
      const wrap = row("out");
      const msg = document.createElement("div");
      msg.className = "wf-msg is-out";
      msg.textContent = step.status;
      msg.insertAdjacentHTML("beforeend", READ);
      if (!animate) msg.style.animation = "none";
      wrap.appendChild(msg);
      thread.appendChild(wrap);
      return wrap;
    }

    function typing() {
      const wrap = row("out");
      wrap.classList.add("is-typing");
      wrap.innerHTML = '<div class="wf-typing" aria-hidden="true"><i></i><i></i><i></i></div>';
      thread.appendChild(wrap);
      return wrap;
    }

    function mark(upto) {
      tickBtns.forEach((btn, i) => {
        const on = i <= upto;
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-selected", i === upto ? "true" : "false");
      });
    }

    function snapshot(upto, all) {
      thread.classList.remove("is-flush");
      thread.replaceChildren();
      const from = all ? 0 : Math.max(0, upto - 1);
      for (let i = from; i <= upto && i < steps.length; i++) {
        incoming(steps[i], false);
        outgoing(steps[i], false);
      }
      mark(upto);
    }

    async function prune(token) {
      const msgs = Array.from(thread.querySelectorAll(".wf-row:not(.is-typing)"));
      if (msgs.length < 4) return;
      const drop = msgs.slice(0, 2);
      drop.forEach((el) => el.classList.add("is-leaving"));
      await wait(320);
      if (token !== gen) return;
      drop.forEach((el) => el.remove());
    }

    if (reduced.matches) {
      snapshot(steps.length - 1, true);
      return;
    }

    let gen = 0;
    let running = false;

    async function beat(token, index) {
      await prune(token);
      if (token !== gen) return;
      incoming(steps[index], true);
      mark(index);
      await wait(720);
      if (token !== gen) return;
      const dots = typing();
      if (visual) visual.classList.add("is-replying");
      await wait(780);
      if (token !== gen) return;
      dots.remove();
      outgoing(steps[index], true);
      if (visual) visual.classList.remove("is-replying");
      await wait(980);
    }

    async function flush(token) {
      thread.classList.add("is-flush");
      await wait(480);
      if (token !== gen) return;
      thread.classList.remove("is-flush");
      thread.replaceChildren();
      mark(-1);
    }

    async function loop(token, from) {
      let i = from;
      while (token === gen) {
        while (i < steps.length) {
          if (token !== gen) return;
          await beat(token, i);
          if (token !== gen) return;
          i += 1;
        }
        await wait(1500);
        if (token !== gen) return;
        await flush(token);
        if (token !== gen) return;
        i = 0;
      }
    }

    function start(from) {
      running = true;
      const token = ++gen;
      const at = from || 0;
      if (at === 0) {
        thread.classList.remove("is-flush");
        thread.replaceChildren();
        mark(-1);
      }
      loop(token, at);
    }

    function stop() {
      running = false;
      gen += 1;
      if (visual) visual.classList.remove("is-replying");
    }

    tickBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        stop();
        snapshot(i);
        start(i + 1);
      });
    });

    if (fine.matches && visual) {
      visual.addEventListener("pointermove", (event) => {
        const box = visual.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        visual.style.transform =
          "rotateY(" + x * 7 + "deg) rotateX(" + -y * 5 + "deg)";
      });
      visual.addEventListener("pointerleave", () => {
        visual.style.transform = "";
      });
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (panel) panel.classList.add("is-playing");
            if (!running) start(0);
          } else {
            stop();
            if (visual) visual.style.transform = "";
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(visual || chain);
  }

  document.querySelectorAll(".wf-chain").forEach(bind);
})();
