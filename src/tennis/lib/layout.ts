/**
 * Which of the two sheet layouts a member last chose.
 *
 * The grid is the original sheet and stays the default on a wide screen. On a
 * phone it cannot work: a name column beside twenty date columns leaves about
 * one readable day on a 375px screen, so narrow screens open the day-by-day
 * list instead. The choice is remembered per browser, not per session, because
 * it is a property of the device rather than of the person.
 */

export type SheetLayout = 'days' | 'grid';

const LAYOUT_KEY = 'tennis:layout';

/** Anything narrower than this cannot show the grid and the name column at once. */
export const NARROW_SCREEN = '(max-width: 47.99em)';

export function isNarrowScreen(): boolean {
  return window.matchMedia(NARROW_SCREEN).matches;
}

export function defaultLayout(): SheetLayout {
  return isNarrowScreen() ? 'days' : 'grid';
}

export function readLayout(): SheetLayout {
  try {
    const stored = window.localStorage.getItem(LAYOUT_KEY);
    if (stored === 'days' || stored === 'grid') return stored;
  } catch {
    // Private-browsing modes can refuse reads; the screen-size default is fine.
  }
  return defaultLayout();
}

export function writeLayout(layout: SheetLayout): void {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // The choice simply will not survive a reload.
  }
}
