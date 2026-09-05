import { describe, expect, test } from 'vitest';

import { drawForDate, effectiveType, isDateLocked, type DrawCandidate } from './draw.js';
import { DEFAULT_SETTINGS } from '../data/seed.js';
import type { Member, MemberType, Settings } from '../types.js';

const settings: Settings = { ...DEFAULT_SETTINGS };

/** Candidates numbered in sign-up order, an hour apart. */
function candidates(...specs: Array<[id: string, type: MemberType, hour: number]>): DrawCandidate[] {
  return specs.map(([memberId, type, hour]) => ({ memberId, type, signedUpAt: hour * 3_600_000 }));
}

function regulars(count: number): DrawCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    memberId: `r${index}`,
    type: 'regular' as const,
    signedUpAt: index * 3_600_000,
  }));
}

describe('drawForDate', () => {
  test('nobody plays until a full game can be made', () => {
    const result = drawForDate(regulars(3), settings, 10);

    expect(result.playing).toEqual([]);
    expect(result.waiting).toHaveLength(3);
    expect(result.games).toBe(0);
  });

  test('exactly four available fills one game', () => {
    const result = drawForDate(regulars(4), settings, 10);

    expect(result.playing).toEqual(['r0', 'r1', 'r2', 'r3']);
    expect(result.waiting).toEqual([]);
    expect(result.games).toBe(1);
  });

  test('the fifth member waits rather than joining an incomplete game', () => {
    const result = drawForDate(regulars(5), settings, 10);

    expect(result.playing).toHaveLength(4);
    expect(result.waiting).toEqual(['r4']);
    expect(result.games).toBe(1);
  });

  test('players only ever play in whole foursomes', () => {
    for (let signedUp = 0; signedUp <= 23; signedUp += 1) {
      const result = drawForDate(regulars(signedUp), settings, 10);

      expect(result.playing.length % settings.playersPerGame).toBe(0);
      expect(result.games).toBe(result.playing.length / settings.playersPerGame);
    }
  });

  test('capacity is capped at max games, and the overflow waits', () => {
    // 5 games x 4 players = 20 seats; 23 sign-ups means 3 wait.
    const result = drawForDate(regulars(23), settings, 10);

    expect(result.games).toBe(settings.maxGames);
    expect(result.playing).toHaveLength(20);
    expect(result.waiting).toHaveLength(3);
  });

  test('regulars are drawn ahead of substitutes who signed up earlier', () => {
    const result = drawForDate(
      candidates(
        ['sub-early', 'substitute', 1],
        ['reg-late', 'regular', 9],
        ['reg-later', 'regular', 10],
        ['reg-latest', 'regular', 11],
        ['reg-last', 'regular', 12],
      ),
      settings,
      10,
    );

    expect(result.playing).toEqual(['reg-late', 'reg-later', 'reg-latest', 'reg-last']);
    expect(result.waiting).toEqual(['sub-early']);
  });

  test('within a class, whoever signed up first keeps the spot', () => {
    const result = drawForDate(
      candidates(
        ['fifth', 'regular', 5],
        ['first', 'regular', 1],
        ['third', 'regular', 3],
        ['second', 'regular', 2],
        ['fourth', 'regular', 4],
      ),
      settings,
      10,
    );

    expect(result.playing).toEqual(['first', 'second', 'third', 'fourth']);
    expect(result.waiting).toEqual(['fifth']);
  });

  test('inside the protection window a substitute is not bumped by a later regular', () => {
    const roster = candidates(
      ['sub-early', 'substitute', 1],
      ['reg-late', 'regular', 9],
      ['reg-later', 'regular', 10],
      ['reg-latest', 'regular', 11],
      ['reg-last', 'regular', 12],
    );

    // daysSubsProtected is 3, so two days out the substitute keeps the spot.
    const protectedDraw = drawForDate(roster, settings, 2);
    expect(protectedDraw.playing).toContain('sub-early');
    expect(protectedDraw.waiting).toEqual(['reg-last']);

    // Well ahead of the date, the regulars still take priority.
    const openDraw = drawForDate(roster, settings, 10);
    expect(openDraw.waiting).toEqual(['sub-early']);
  });

  test('the result is stable regardless of the order candidates arrive in', () => {
    const roster = regulars(9);
    const shuffled = [...roster].reverse();

    expect(drawForDate(shuffled, settings, 10).playing).toEqual(
      drawForDate(roster, settings, 10).playing,
    );
  });

  test('an empty day produces no games', () => {
    expect(drawForDate([], settings, 10)).toEqual({ playing: [], waiting: [], games: 0 });
  });
});

describe('effectiveType', () => {
  const guest = { isGuestSlot: true, type: 'substitute' } as Member;
  const substitute = { isGuestSlot: false, type: 'substitute' } as Member;

  test('guest rows follow the Guest Priority setting, not their own type', () => {
    expect(effectiveType(guest, { ...settings, guestPriority: 'regular' })).toBe('regular');
    expect(effectiveType(guest, { ...settings, guestPriority: 'substitute' })).toBe('substitute');
  });

  test('real members keep their own type', () => {
    expect(effectiveType(substitute, { ...settings, guestPriority: 'regular' })).toBe('substitute');
  });
});

describe('isDateLocked', () => {
  test('a zero setting never locks an upcoming day', () => {
    expect(isDateLocked(0, { ...settings, daysNoChanges: 0 })).toBe(false);
    expect(isDateLocked(5, { ...settings, daysNoChanges: 0 })).toBe(false);
  });

  test('days that have already passed are always locked', () => {
    expect(isDateLocked(-1, { ...settings, daysNoChanges: 0 })).toBe(true);
  });

  test('days inside the no-changes window are locked', () => {
    const locking = { ...settings, daysNoChanges: 2 };

    expect(isDateLocked(0, locking)).toBe(true);
    expect(isDateLocked(1, locking)).toBe(true);
    expect(isDateLocked(2, locking)).toBe(false);
  });
});
