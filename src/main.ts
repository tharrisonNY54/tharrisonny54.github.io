// Styles
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

// Self-hosted fonts (no CDN — bundled by Vite).
// Only the weights the stylesheets actually use: 400 and 500.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/space-mono/400.css';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Page-transition fade. Short enough that clicking through never feels stalled. */
const NAV_FADE_MS = 160;

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
    }, NAV_FADE_MS);
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


/**
 * The header sits transparent over the hero and picks up a blurred ground once
 * the page scrolls, so body text never collides with the nav.
 */
function wireHeaderScroll(): void {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('at-top', window.scrollY < 24);
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
  wireHeaderScroll();
  if (document.readyState === 'complete') bootIn();
  else window.addEventListener('load', bootIn, { once: true });
}
