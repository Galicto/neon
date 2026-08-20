/**
 * Neo Automations — Shared Site Script
 * Theme · Navigation · Mobile drawer · Scroll reveal · Count-up · FAQ
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const STORAGE_KEY = 'neo-theme';

  /* ── Theme ─────────────────────────────────────────────── */
  function getInitialTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  applyTheme(getInitialTheme());

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ── Header scroll state ─────────────────────────────── */
  const header = document.getElementById('site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile drawer ─────────────────────────────────────── */
  const menuBtn = document.getElementById('menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  let lastFocused = null;

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function openDrawer() {
    if (!menuBtn || !drawer) return;
    lastFocused = document.activeElement;
    menuBtn.classList.add('is-open');
    drawer.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const focusable = getFocusable(drawer);
    if (focusable.length) focusable[0].focus();
  }

  function closeDrawer() {
    if (!menuBtn || !drawer) return;
    menuBtn.classList.remove('is-open');
    drawer.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => {
      drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeDrawer);
    });

    document.addEventListener('keydown', (e) => {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(drawer);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (!drawer.classList.contains('is-open')) return;
      if (drawer.contains(e.target) || menuBtn.contains(e.target)) return;
      closeDrawer();
    });
  }

  /* ── Scroll reveal ─────────────────────────────────────── */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('visible');
    });
  } else {
    const revealEls = document.querySelectorAll('.reveal');
    if (revealEls.length) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            revealObserver.unobserve(el);

            // Elements authored as already-visible (the above-the-fold hero)
            // never run a transition, so transitionend would never fire.
            if (el.classList.contains('visible')) return;

            el.classList.add('is-revealing');
            el.addEventListener(
              'transitionend',
              () => el.classList.remove('is-revealing'),
              { once: true }
            );
            el.classList.add('visible');
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
      );
      revealEls.forEach((el) => revealObserver.observe(el));
    }
  }

  /* ── Count-up metrics ────────────────────────────────────
     Measure the final string first and lock min-width so the
     column doesn't jitter as digits change. Skip 0 (nothing to
     count) and reduced-motion. */
  function formatCount(el, n) {
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const value = decimals ? n.toFixed(decimals) : String(Math.round(n));
    return prefix + value + suffix;
  }

  function countUp(el) {
    if (el.dataset.counted) return;
    const target = parseFloat(el.dataset.target);
    if (Number.isNaN(target)) return;
    el.dataset.counted = '1';

    const finalText = formatCount(el, target);

    const probe = el.cloneNode(false);
    probe.textContent = finalText;
    probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;';
    el.parentNode.appendChild(probe);
    el.style.minWidth = probe.offsetWidth + 'px';
    probe.remove();

    if (reducedMotion || target === 0) {
      el.textContent = finalText;
      return;
    }

    el.textContent = formatCount(el, 0);
    const duration = 680;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatCount(el, target * eased);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = finalText;
    }
    requestAnimationFrame(step);
  }

  const countEls = document.querySelectorAll('.count-up');
  if (countEls.length) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            countUp(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    countEls.forEach((el) => countObserver.observe(el));
  }

  /* ── FAQ accordion ───────────────────────────────────── */
  document.querySelectorAll('.faq-q').forEach((btn) => {
    const item = btn.closest('.faq-item');
    const answer = item?.querySelector('.faq-a');
    if (!answer) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((other) => {
        other.classList.remove('open');
        const otherAnswer = other.querySelector('.faq-a');
        if (otherAnswer) otherAnswer.style.maxHeight = '';
        const otherBtn = other.querySelector('.faq-q');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── Pipeline demo animation (homepage) ────────────────── */
  const pipeline = document.getElementById('pipeline-demo');
  if (pipeline && !reducedMotion) {
    const nodes = pipeline.querySelectorAll('.pipeline-node');
    let activeIndex = 0;
    let pulseTimer = null;

    function pulseNode() {
      nodes.forEach((n, i) => n.classList.toggle('is-active', i === activeIndex));
      activeIndex = (activeIndex + 1) % nodes.length;
    }

    // Only tick while on screen — previously this ran for the whole
    // session regardless of visibility.
    const pipelineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !pulseTimer) {
            pulseNode();
            pulseTimer = setInterval(pulseNode, 2200);
          } else if (!entry.isIntersecting && pulseTimer) {
            clearInterval(pulseTimer);
            pulseTimer = null;
          }
        });
      },
      { threshold: 0.2 }
    );
    pipelineObserver.observe(pipeline);
  }

  /* ── Contact form ──────────────────────────────────────── */
  const auditForm = document.getElementById('auditForm');
  if (auditForm) {
    auditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('form-status');
      const btn = auditForm.querySelector('[type="submit"]');
      const trap = auditForm.querySelector('[name="website"]');
      if (trap && trap.value) return;

      const email = (auditForm.email?.value || '').trim();
      const name = (auditForm.name?.value || '').trim();
      const company = (auditForm.company?.value || '').trim();
      const bottleneck = (auditForm.bottleneck?.value || '').trim();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!name || !validEmail || bottleneck.length < 8) {
        if (status) {
          status.hidden = false;
          status.textContent = 'Enter a name, a valid work email, and a short description of the bottleneck.';
        }
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.dataset.label = btn.textContent;
        btn.textContent = 'Sending…';
      }
      if (status) {
        status.hidden = false;
        status.textContent = 'Sending your request…';
      }

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name, email, company, bottleneck, website: trap ? trap.value : '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || 'Could not send. Write to Info@neointegrations.com.');
        }
        if (status) {
          status.textContent = data.message || 'Request sent. We will reply to your work email.';
        }
        auditForm.reset();
        if (btn) {
          btn.textContent = 'Sent';
        }
      } catch (err) {
        if (status) {
          status.textContent =
            err.message || 'Could not reach the server. Confirm the site is running with npm start, or email Info@neointegrations.com.';
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = btn.dataset.label || 'Submit Audit Request';
        }
      }
    });
  }

  /* ── Newsletter (placeholder handler) ──────────────────── */
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = document.getElementById('newsletter-status');
      if (status) {
        status.hidden = false;
        status.textContent = 'TODO: connect newsletter to Mailchimp, ConvertKit, or similar.';
      }
    });
  }
})();
