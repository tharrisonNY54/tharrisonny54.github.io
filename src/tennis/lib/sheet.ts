/**
 * Turns stored sign-ups into the view the grid renders: a status per member per
 * date, and a game count per column.
 */

import type { DisplayStatus, Member, Preference, Sheet, Signup } from '../types.js';
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
}

/** The three groups the day-by-day view lists under each date. */
export interface DayRoster {
  playing: Member[];
  available: Member[];
  unavailable: Member[];
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
 * Splits the roster for one day into playing, waiting and out.
 *
 * Members who have entered nothing are left out entirely, the same way the grid
 * leaves their cell blank rather than listing them as undecided. Input order is
 * preserved, so names come back in seat order.
 */
export function rosterForDay(members: readonly Member[], day: DayView | undefined): DayRoster {
  const roster: DayRoster = { playing: [], available: [], unavailable: [] };
  if (!day) return roster;

  for (const member of members) {
    const status = day.statuses.get(member.id) ?? 'O';
    if (status === 'P') roster.playing.push(member);
    else if (status === 'A') roster.available.push(member);
    else if (status === 'N') roster.unavailable.push(member);
  }

  return roster;
}
