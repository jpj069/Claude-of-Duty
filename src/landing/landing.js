import './landing.css';

/**
 * Landing page behaviour: scroll reveals, parallax, sticky nav.
 *
 * No framework and no scroll library. Two rules keep it cheap:
 *  - reveals are IntersectionObserver, so nothing runs on scroll for them;
 *  - parallax reads scrollY once per frame in a rAF and writes transforms only,
 *    which stays on the compositor and never triggers layout.
 *
 * Everything degrades: `prefers-reduced-motion` disables parallax entirely (the
 * CSS separately neutralises the reveal transition), and if this module fails to
 * load, `.no-js` in the CSS keeps every revealed element visible rather than
 * leaving a blank page.
 */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- scroll reveals ---------------- */
const revealables = document.querySelectorAll('.reveal');
if (reduced || !('IntersectionObserver' in window)) {
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
    // Fire slightly before the element is fully in view, and require a little of
    // it to be showing so tall sections do not wait for their own bottom edge.
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );

  // Stagger siblings inside a group so rows arrive in sequence rather than
  // snapping in as one block.
  for (const group of document.querySelectorAll('.facts, .grid, .still-pair')) {
    [...group.children].forEach((child, i) => {
      const target = child.classList.contains('reveal')
        ? child
        : child.querySelector('.reveal');
      if (target) target.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
    });
  }

  revealables.forEach((el) => io.observe(el));
}

/* ---------------- parallax ---------------- */
const layers = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
  el,
  rate: Number(el.dataset.parallax) || 0,
}));

if (!reduced && layers.length) {
  let queued = false;

  const apply = () => {
    queued = false;
    const vh = innerHeight;
    for (const { el, rate } of layers) {
      const r = el.getBoundingClientRect();
      // Skip offscreen layers — a translate on something invisible is pure cost.
      if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) continue;
      // Progress of this element through the viewport, centred on 0 so a layer
      // sits at its authored position when it is dead centre.
      const progress = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = `translate3d(0, ${(progress * rate * 100).toFixed(2)}px, 0)`;
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
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => nav.classList.toggle('stuck', !e.isIntersecting),
      { threshold: 0 },
    ).observe(sentinel);
  } else {
    nav.classList.add('stuck');
  }
}
