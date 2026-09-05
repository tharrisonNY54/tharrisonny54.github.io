/**
 * Play-date generation and formatting.
 *
 * All dates are handled as local-time calendar days and passed around as ISO
 * `yyyy-mm-dd` strings. Parsing goes through `fromISODate` rather than
 * `new Date(string)` because the latter treats a bare date as UTC and shifts
 * the day for anyone west of Greenwich.
 */

const DAY_CODES = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MS_PER_DAY = 86_400_000;

/** Guard against a bad `playDays` setting spinning the date search forever. */
const MAX_DAYS_SEARCHED = 400;

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Midnight today, so "days until" comparisons ignore the clock time. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The next `count` dates that fall on one of `playDays`, starting with today
 * if today is itself a play day.
 */
export function upcomingPlayDates(from: Date, playDays: number[], count: number): string[] {
  if (playDays.length === 0 || count <= 0) return [];

  const wanted = new Set(playDays);
  const dates: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  for (let searched = 0; dates.length < count && searched < MAX_DAYS_SEARCHED; searched += 1) {
    if (wanted.has(cursor.getDay())) dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

/** `M`, `W`, `F`, `Sa` — the short code in the second header row. */
export function dayCode(iso: string): string {
  return DAY_CODES[fromISODate(iso).getDay()];
}

/** `Friday` — spelled out for screen readers and the mobile-free help text. */
export function dayName(iso: string): string {
  return DAY_NAMES[fromISODate(iso).getDay()];
}

/** `9/4` — the date label in the top header row. */
export function monthDay(iso: string): string {
  const date = fromISODate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** Whole days from `today` to `iso`. Negative once the date has passed. */
export function daysUntil(iso: string, today: Date): number {
  const target = fromISODate(iso).getTime();
  const base = startOfToday(today).getTime();
  return Math.round((target - base) / MS_PER_DAY);
}

/**
 * Split the date list into Monday-started calendar weeks, which is what
 * produces the visual gaps between column groups on the sheet.
 */
export function groupIntoWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  let current: string[] = [];
  let currentKey = '';

  for (const iso of dates) {
    const key = weekKey(iso);
    if (key !== currentKey && current.length > 0) {
      weeks.push(current);
      current = [];
    }
    currentKey = key;
    current.push(iso);
  }

  if (current.length > 0) weeks.push(current);
  return weeks;
}

/** ISO date of the Monday that starts this date's week. */
function weekKey(iso: string): string {
  const date = fromISODate(iso);
  const offsetToMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offsetToMonday);
  return toISODate(date);
}
