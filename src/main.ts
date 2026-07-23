// Styles
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

// Self-hosted fonts (no CDN — bundled by Vite)
import '@fontsource/space-grotesk/300.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fade the load curtain out, then let `.enter` elements rise in. */
function bootIn(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.remove('is-loading'));
  });
}

/** Same-origin internal links play a short curtain before navigating. */
function wirePageTransitions(): void {
  if (prefersReduced) return;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (
      !href ||
      link.target === '_blank' ||
      link.hasAttribute('download') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      link.origin !== location.origin
    ) {
      return;
    }
    if (link.pathname === location.pathname) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(() => {
      window.location.href = href;
    }, 320);
  });

  // Restore on back/forward (page kept in bfcache).
  window.addEventListener('pageshow', (ev) => {
    if ((ev as PageTransitionEvent).persisted) {
      document.body.classList.remove('is-leaving', 'is-loading');
    }
  });
}

/** Reveal-on-scroll for [data-reveal] blocks, with a small stagger. */
function wireReveals(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
  if (!items.length) return;
  if (prefersReduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.delay ?? 0);
          window.setTimeout(() => el.classList.add('in'), delay);
          io.unobserve(el);
        }
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );
  items.forEach((el) => io.observe(el));
}

/** Live UTC clock in [data-clock] elements — reinforces the "instrument" feel. */
function wireClock(): void {
  const nodes = document.querySelectorAll<HTMLElement>('[data-clock]');
  if (!nodes.length) return;
  const tick = () => {
    const t = new Date().toISOString().slice(11, 19);
    nodes.forEach((n) => (n.textContent = `${t} UTC`));
  };
  tick();
  window.setInterval(tick, 1000);
}

/** Toggle hero corner-label visibility once the user scrolls past the fold. */
function wireHeroScroll(): void {
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!hero) return;
  const onScroll = () => {
    hero.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.5);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function setYear(): void {
  document.querySelectorAll('[data-year]').forEach((n) => {
    n.textContent = String(new Date().getFullYear());
  });
}

export function boot(): void {
  setYear();
  wirePageTransitions();
  wireReveals();
  wireClock();
  wireHeroScroll();
  if (document.readyState === 'complete') bootIn();
  else window.addEventListener('load', bootIn, { once: true });
}
