/**
 * Turns stored sign-ups into the view the grid renders: a status per member per
 * date, a game count per column, and the "last player to sign up for the next
 * day of play" that the original site marks with a blue seat button.
 */

import type { DisplayStatus, Preference, Sheet, Signup } from '../types.js';
import { daysUntil, groupIntoWeeks, startOfToday, upcomingPlayDates } from './dates.js';
import { drawForDate, effectiveType, isDateLocked, type DrawCandidate } from './draw.js';

export interface DayView {
  date: string;
  games: number;
  locked: boolean;
  /** Member id -> what the cell shows. Members with no entry are `O`. */
  statuses: Map<string, DisplayStatus>;
}

export interface SheetView {
  dates: string[];
  /** Dates split into calendar weeks, producing the gaps between column groups. */
  weeks: string[][];
  days: Map<string, DayView>;
  /** Seat button highlighted blue: last to sign up for the next play date. */
  lastSignupMemberId: string | null;
}

export function signupKey(memberId: string, date: string): string {
  return `${memberId}|${date}`;
}

export function indexSignups(signups: readonly Signup[]): Map<string, Signup> {
  const index = new Map<string, Signup>();
  for (const signup of signups) index.set(signupKey(signup.memberId, signup.date), signup);
  return index;
}

export function preferenceFor(index: Map<string, Signup>, memberId: string, date: string): Preference {
  return index.get(signupKey(memberId, date))?.preference ?? 'O';
}

export function buildSheetView(sheet: Sheet, now: Date = new Date()): SheetView {
  const today = startOfToday(now);
  const dates = upcomingPlayDates(today, sheet.settings.playDays, sheet.settings.daysDisplayed);
  const index = indexSignups(sheet.signups);

  const days = new Map<string, DayView>();
  for (const date of dates) {
    days.set(date, buildDayView(sheet, index, date, daysUntil(date, today)));
  }

  return {
    dates,
    weeks: groupIntoWeeks(dates),
    days,
    lastSignupMemberId: findLastSignup(index, dates[0]),
  };
}

function buildDayView(
  sheet: Sheet,
  index: Map<string, Signup>,
  date: string,
  daysOut: number,
): DayView {
  const statuses = new Map<string, DisplayStatus>();
  const candidates: DrawCandidate[] = [];

  for (const member of sheet.members) {
    const signup = index.get(signupKey(member.id, date));
    const preference = signup?.preference ?? 'O';
    statuses.set(member.id, preference);

    if (preference === 'A') {
      candidates.push({
        memberId: member.id,
        type: effectiveType(member, sheet.settings),
        signedUpAt: signup?.signedUpAt ?? 0,
      });
    }
  }

  const draw = drawForDate(candidates, sheet.settings, daysOut);
  for (const memberId of draw.playing) statuses.set(memberId, 'P');

  return {
    date,
    games: draw.games,
    locked: isDateLocked(daysOut, sheet.settings),
    statuses,
  };
}

/**
 * Whoever most recently moved to `A` for the next play date. Members watch this
 * marker to see whether the sheet has moved since they last looked.
 */
function findLastSignup(index: Map<string, Signup>, nextDate: string | undefined): string | null {
  if (!nextDate) return null;

  let latest: Signup | null = null;
  for (const signup of index.values()) {
    if (signup.date !== nextDate) continue;
    if (signup.preference !== 'A' || signup.signedUpAt === null) continue;
    if (latest === null || signup.signedUpAt > (latest.signedUpAt ?? 0)) latest = signup;
  }

  return latest?.memberId ?? null;
}
