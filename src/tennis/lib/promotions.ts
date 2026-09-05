/**
 * Detects members whose status moved from A (available) to P (playing) when the
 * draw was recalculated, so they can be told a spot opened up.
 *
 * The Help page warns that this happens constantly — "all the members that have
 * signed up for the next day of play should keep an eye on the website" — which
 * is exactly the chore the notification removes.
 */

import type { SheetView } from './sheet.js';

export interface Promotion {
  memberId: string;
  date: string;
}

export function findPromotions(before: SheetView, after: SheetView): Promotion[] {
  const promotions: Promotion[] = [];

  for (const [date, day] of after.days) {
    const previous = before.days.get(date);
    if (!previous) continue;

    for (const [memberId, status] of day.statuses) {
      if (status === 'P' && previous.statuses.get(memberId) === 'A') {
        promotions.push({ memberId, date });
      }
    }
  }

  return promotions;
}
