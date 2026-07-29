import './landing.css';

/**
 * Landing page behaviour: scroll reveals, parallax, scroll-linked image scale,
 * count-up figures, a progress bar and a sticky nav.
 *
 * No framework and no scroll library. Two rules keep it cheap:
 *  - reveals and count-ups are IntersectionObserver, so nothing runs on scroll
 *    for them and each fires exactly once;
 *  - everything that IS scroll-driven shares ONE rAF-throttled handler and only
 *    ever writes transforms or scaleX, which stays on the compositor and never
 *    triggers layout.
 *
 * Everything degrades. `prefers-reduced-motion` disables parallax, image scale
 * and count-ups, and if this module fails to load `.no-js` in the CSS keeps every
 * revealed element visible rather than leaving a blank page.
 */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasIO = 'IntersectionObserver' in window;

/* ---------------- scroll reveals ---------------- */
const revealables = document.querySelectorAll('.reveal');
if (reduced || !hasIO) {
  revealables.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target); // one-shot: re-animating on scroll-up reads as jitter
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );

  // Stagger siblings inside a group so rows arrive in sequence rather than
  // snapping in as one block.
  for (const group of document.querySelectorAll('.facts, .grid, .still-grid')) {
    [...group.children].forEach((child, i) => {
      const target = child.classList.contains('reveal') ? child : child.querySelector('.reveal');
      if (target) target.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
    });
  }

  revealables.forEach((el) => io.observe(el));
}

/* ---------------- count-up figures ----------------
   Only numeric facts animate. `data-count` carries the target and the element's
   authored text carries the format (prefix, suffix, separators), so a value like
   "~500 KB" counts on the number and keeps its unit. */
if (!reduced && hasIO) {
  const countIo = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        countIo.unobserve(el);
        const target = Number(el.dataset.count);
        if (!Number.isFinite(target)) continue;
        const tpl = el.textContent;
        const digits = String(target);
        const t0 = performance.now();
        const dur = 900;
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          // easeOutCubic: fast start, settles on the figure rather than crawling
          const v = Math.round(target * (1 - (1 - p) ** 3));
          el.textContent = tpl.replace(digits, String(v));
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = tpl;
        };
        el.textContent = tpl.replace(digits, '0');
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.5 },
  );
  document.querySelectorAll('[data-count]').forEach((el) => countIo.observe(el));
}

/* ---------------- scroll-driven: parallax, image scale, progress ---------------- */
const layers = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
  el,
  rate: Number(el.dataset.parallax) || 0,
}));
const scalers = [...document.querySelectorAll('[data-scale]')].map((el) => ({
  el,
  amount: Number(el.dataset.scale) || 0.06,
}));
const bar = document.querySelector('.progress-bar');

if (bar || (!reduced && (layers.length || scalers.length))) {
  let queued = false;

  const apply = () => {
    queued = false;
    const vh = innerHeight;

    if (bar) {
      const max = document.documentElement.scrollHeight - vh;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    }

    if (reduced) return;

    for (const { el, rate } of layers) {
      const r = el.getBoundingClientRect();
      // Skip offscreen layers — a transform on something invisible is pure cost.
      if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) continue;
      // Progress through the viewport, centred on 0 so a layer sits at its
      // authored position when it is dead centre.
      const p = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = `translate3d(0, ${(p * rate * 100).toFixed(2)}px, 0)`;
    }

    for (const { el, amount } of scalers) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      // 1 + amount at the edges, 1 at centre: the still eases DOWN to its true
      // size as it lands, which reads as settling rather than drifting.
      const p = Math.abs((r.top + r.height / 2 - vh / 2) / vh);
      el.style.transform = `scale(${(1 + Math.min(1, p) * amount).toFixed(4)})`;
    }
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  apply();
}

/* ---------------- sticky nav ---------------- */
const nav = document.getElementById('nav');
if (nav) {
  // A sentinel beats a scroll handler: the class flips exactly when the hero's
  // first 80px have passed, with no listener running the rest of the time.
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:80px;height:1px;width:1px;';
  document.body.prepend(sentinel);
  if (hasIO) {
    new IntersectionObserver(([e]) => nav.classList.toggle('stuck', !e.isIntersecting), {
      threshold: 0,
    }).observe(sentinel);
  } else {
    nav.classList.add('stuck');
  }
}
