/**
 * Marks whichever hero panel is currently in front of the cloud.
 *
 * This used to also drive a tick rail down the side of the stage. The rail is
 * gone — the page is navigated by scrolling and by the buttons in the panels
 * themselves — but the position signal is still needed, because the panel copy
 * fades and slides in from the side it belongs to (see .stage.is-spied in
 * plates.css).
 *
 * Nothing here is required for the page to work. If it never runs, every panel
 * keeps its resting state and stays readable.
 */

export function initPanelSpy(): void {
  const stage = document.querySelector<HTMLElement>('.stage');
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));
  if (!stage || !panels.length) return;

  /* Only claim the entrance states once the observer is confirmed available —
     without this, a browser lacking IntersectionObserver would hold every
     panel at opacity 0. */
  if (!('IntersectionObserver' in window)) return;
  stage.classList.add('is-spied');

  panels[0].classList.add('is-current');

  /*
   * Panels are stacked inside a pinned section, so several can intersect the
   * viewport at once. Tracking the highest intersection ratio picks the one
   * actually centred rather than whichever fired most recently.
   */
  const ratios = new Map<Element, number>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
      let best = 0;
      let bestRatio = -1;
      panels.forEach((p, i) => {
        const r = ratios.get(p) ?? 0;
        if (r > bestRatio) {
          bestRatio = r;
          best = i;
        }
      });
      panels.forEach((p, i) => p.classList.toggle('is-current', i === best));
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  panels.forEach((p) => io.observe(p));
}
