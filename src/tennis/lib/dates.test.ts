import { describe, expect, test } from 'vitest';

import {
  dayCode,
  dayName,
  daysUntil,
  fromISODate,
  groupIntoWeeks,
  monthDay,
  startOfToday,
  toISODate,
  upcomingPlayDates,
} from './dates.js';

/** Monday, Wednesday, Friday, Saturday — how the MWF group plays. */
const PLAY_DAYS = [1, 3, 5, 6];

// Friday 4 September 2026, the date on the sheet these tests were written from.
const FRIDAY = new Date(2026, 8, 4);

describe('upcomingPlayDates', () => {
  test('starts on today when today is itself a play day', () => {
    expect(upcomingPlayDates(FRIDAY, PLAY_DAYS, 3)).toEqual(['2026-09-04', '2026-09-05', '2026-09-07']);
  });

  test('skips days the group does not play', () => {
    // Sunday 6 September: the next play day is Monday.
    expect(upcomingPlayDates(new Date(2026, 8, 6), PLAY_DAYS, 1)).toEqual(['2026-09-07']);
  });

  test('produces exactly the number of columns requested', () => {
    const dates = upcomingPlayDates(FRIDAY, PLAY_DAYS, 20);

    expect(dates).toHaveLength(20);
    expect(dates.at(-1)).toBe('2026-10-07');
  });

  test('every date lands on a configured play day', () => {
    for (const iso of upcomingPlayDates(FRIDAY, PLAY_DAYS, 20)) {
      expect(PLAY_DAYS).toContain(fromISODate(iso).getDay());
    }
  });

  test('returns nothing when no play days or no columns are configured', () => {
    expect(upcomingPlayDates(FRIDAY, [], 10)).toEqual([]);
    expect(upcomingPlayDates(FRIDAY, PLAY_DAYS, 0)).toEqual([]);
  });
});

describe('formatting', () => {
  test('matches the headers on the original sheet', () => {
    expect(monthDay('2026-09-04')).toBe('9/4');
    expect(monthDay('2026-10-07')).toBe('10/7');
    expect(dayCode('2026-09-04')).toBe('F');
    expect(dayCode('2026-09-05')).toBe('Sa');
    expect(dayCode('2026-09-07')).toBe('M');
    expect(dayCode('2026-09-09')).toBe('W');
    expect(dayName('2026-09-04')).toBe('Friday');
  });

  test('an ISO date survives a round trip without shifting a day', () => {
    expect(toISODate(fromISODate('2026-09-04'))).toBe('2026-09-04');
  });

  test('parsing treats the date as local, not UTC', () => {
    // `new Date('2026-09-04')` is midnight UTC and reads as the 3rd in the
    // Americas. fromISODate must not do that.
    expect(fromISODate('2026-09-04').getDate()).toBe(4);
  });
});

describe('daysUntil', () => {
  test('counts whole days and ignores the time of day', () => {
    const afternoon = new Date(2026, 8, 4, 16, 30);

    expect(daysUntil('2026-09-04', afternoon)).toBe(0);
    expect(daysUntil('2026-09-05', afternoon)).toBe(1);
    expect(daysUntil('2026-09-11', afternoon)).toBe(7);
  });

  test('is negative for days that have passed', () => {
    expect(daysUntil('2026-09-01', FRIDAY)).toBe(-3);
  });

  test('startOfToday drops the clock time', () => {
    expect(startOfToday(new Date(2026, 8, 4, 23, 59)).getHours()).toBe(0);
  });
});

describe('groupIntoWeeks', () => {
  test('splits into Monday-started weeks, producing the column gaps', () => {
    const weeks = groupIntoWeeks(upcomingPlayDates(FRIDAY, PLAY_DAYS, 20));

    // The sheet opens mid-week with just Friday and Saturday.
    expect(weeks[0]).toEqual(['2026-09-04', '2026-09-05']);
    expect(weeks[1]).toEqual(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-12']);
    expect(weeks.flat()).toHaveLength(20);
  });

  test('handles an empty list', () => {
    expect(groupIntoWeeks([])).toEqual([]);
  });
});
