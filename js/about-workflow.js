/**
 * Use-cases live workflow.
 * Each step enters differently (slide / rise / pop) while a single
 * spine fills between them so the chain reads as one motion.
 */
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ENTER = ["wf-a", "wf-b", "wf-c"];

  function bind(chain) {
    const nodes = Array.from(chain.querySelectorAll(".wf-node"));
    if (!nodes.length) return;

    nodes.forEach((node, i) => node.classList.add(ENTER[i % ENTER.length]));
    chain.classList.add("is-armed");

    if (reduced.matches) {
      nodes.forEach((node) => node.classList.add("is-in"));
      chain.style.setProperty("--wf-progress", "1");
      return;
    }

    let gen = 0;
    let timer = 0;

    function stop() {
      gen += 1;
      clearTimeout(timer);
    }

    function play() {
      const my = ++gen;
      let i = 0;
      nodes.forEach((node) => node.classList.remove("is-in", "is-live"));
      chain.style.setProperty("--wf-progress", "0");

      function step() {
        if (my !== gen) return;
        if (i >= nodes.length) {
          timer = setTimeout(() => {
            if (my === gen) play();
          }, 1800);
          return;
        }
        nodes.forEach((node) => node.classList.remove("is-live"));
        const current = nodes[i];
        current.classList.remove("is-in");
        void current.offsetWidth;
        current.classList.add("is-in", "is-live");
        chain.style.setProperty("--wf-progress", String((i + 1) / nodes.length));
        i += 1;
        timer = setTimeout(step, 720);
      }

      timer = setTimeout(step, 120);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) play();
          else stop();
        });
      },
      { threshold: 0.4 }
    );

    io.observe(chain.closest(".wf-visual") || chain);
  }

  document.querySelectorAll(".wf-chain").forEach(bind);
})();
