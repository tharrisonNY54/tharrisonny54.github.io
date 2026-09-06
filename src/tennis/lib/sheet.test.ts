import { describe, expect, test } from 'vitest';

import { buildSheetView, indexSignups, preferenceFor, rosterForDay } from './sheet.js';
import { findPromotions } from './promotions.js';
import { DEFAULT_SETTINGS } from '../data/seed.js';
import type { Member, Preference, Sheet, Signup } from '../types.js';

const NOW = new Date(2026, 8, 4, 9, 0); // Friday 4 September 2026
const FIRST_DATE = '2026-09-04';

function member(id: string, overrides: Partial<Member> = {}): Member {
  return {
    id,
    seat: Number(id.replace(/\D/g, '')) || 1,
    firstName: 'Test',
    lastName: id,
    loginId: `login-${id}`,
    email: `${id}@example.com`,
    phone: '',
    mobile: '',
    type: 'regular',
    isAdmin: false,
    isGuestSlot: false,
    ...overrides,
  };
}

function signup(memberId: string, preference: Preference, hour: number): Signup {
  return {
    memberId,
    date: FIRST_DATE,
    preference,
    signedUpAt: preference === 'A' ? hour * 3_600_000 : null,
  };
}

function sheetWith(members: Member[], signups: Signup[]): Sheet {
  return {
    id: 'Doubles40',
    settings: { ...DEFAULT_SETTINGS, daysDisplayed: 4 },
    members,
    signups,
  };
}

describe('buildSheetView', () => {
  test('gives every member a status on every visible date', () => {
    const view = buildSheetView(sheetWith([member('m1'), member('m2')], []), NOW);

    expect(view.dates).toHaveLength(4);
    for (const date of view.dates) {
      expect(view.days.get(date)?.statuses.get('m1')).toBe('O');
      expect(view.days.get(date)?.statuses.get('m2')).toBe('O');
    }
  });

  test('turns four available members green and counts the game', () => {
    const members = ['m1', 'm2', 'm3', 'm4'].map((id) => member(id));
    const view = buildSheetView(
      sheetWith(members, members.map((m, index) => signup(m.id, 'A', index + 1))),
      NOW,
    );

    const day = view.days.get(FIRST_DATE)!;
    expect(day.games).toBe(1);
    for (const m of members) expect(day.statuses.get(m.id)).toBe('P');
  });

  test('leaves the last to sign up yellow when the game cannot be filled', () => {
    const members = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => member(id));
    const view = buildSheetView(
      sheetWith(members, members.map((m, index) => signup(m.id, 'A', index + 1))),
      NOW,
    );

    const day = view.days.get(FIRST_DATE)!;
    expect(day.statuses.get('m5')).toBe('A');
    expect(day.games).toBe(1);
  });

  test('keeps N as N and never draws someone who is not available', () => {
    const members = ['m1', 'm2', 'm3', 'm4'].map((id) => member(id));
    const signups = [
      signup('m1', 'A', 1),
      signup('m2', 'A', 2),
      signup('m3', 'A', 3),
      signup('m4', 'N', 0),
    ];
    const view = buildSheetView(sheetWith(members, signups), NOW);

    const day = view.days.get(FIRST_DATE)!;
    expect(day.statuses.get('m4')).toBe('N');
    expect(day.games).toBe(0);
  });

  test('marks the last member to sign up for the next day of play', () => {
    const members = ['m1', 'm2', 'm3'].map((id) => member(id));
    const view = buildSheetView(
      sheetWith(members, [signup('m1', 'A', 1), signup('m3', 'A', 9), signup('m2', 'A', 5)]),
      NOW,
    );

    expect(view.lastSignupMemberId).toBe('m3');
  });

  test('marks nobody when the next day has no sign-ups', () => {
    const view = buildSheetView(sheetWith([member('m1')], []), NOW);

    expect(view.lastSignupMemberId).toBeNull();
  });

  test('groups the columns into weeks', () => {
    const view = buildSheetView(sheetWith([member('m1')], []), NOW);

    expect(view.weeks.flat()).toEqual(view.dates);
    expect(view.weeks[0]).toEqual(['2026-09-04', '2026-09-05']);
  });
});

describe('preferenceFor', () => {
  test('reports Open for a member with nothing stored', () => {
    const index = indexSignups([signup('m1', 'A', 1)]);

    expect(preferenceFor(index, 'm1', FIRST_DATE)).toBe('A');
    expect(preferenceFor(index, 'm2', FIRST_DATE)).toBe('O');
    expect(preferenceFor(index, 'm1', '2026-09-05')).toBe('O');
  });
});

describe('findPromotions', () => {
  const members = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => member(id));

  test('reports the members who were waiting and are now playing', () => {
    // Three available: not enough for a game, so all three sit yellow.
    const before = buildSheetView(
      sheetWith(members, [signup('m1', 'A', 1), signup('m2', 'A', 2), signup('m3', 'A', 3)]),
      NOW,
    );

    // A fourth signs up and fills the game for everyone.
    const after = buildSheetView(
      sheetWith(members, [
        signup('m1', 'A', 1),
        signup('m2', 'A', 2),
        signup('m3', 'A', 3),
        signup('m4', 'A', 4),
      ]),
      NOW,
    );

    // Only the three who were waiting are told. m4 went straight from Open to
    // Playing by their own submission, so mailing them would be noise.
    const promoted = findPromotions(before, after).map((p) => p.memberId).sort();
    expect(promoted).toEqual(['m1', 'm2', 'm3']);
  });

  test('reports nothing when the draw did not move anyone up', () => {
    const view = buildSheetView(sheetWith(members, [signup('m1', 'A', 1)]), NOW);

    expect(findPromotions(view, view)).toEqual([]);
  });

  test('does not treat somebody dropping to A as a promotion', () => {
    const full = buildSheetView(
      sheetWith(members, [
        signup('m1', 'A', 1),
        signup('m2', 'A', 2),
        signup('m3', 'A', 3),
        signup('m4', 'A', 4),
      ]),
      NOW,
    );
    const broken = buildSheetView(
      sheetWith(members, [signup('m1', 'A', 1), signup('m2', 'A', 2), signup('m3', 'A', 3)]),
      NOW,
    );

    expect(findPromotions(full, broken)).toEqual([]);
  });
});

describe('rosterForDay', () => {
  test('splits the day into playing, waiting and out, in seat order', () => {
    const members = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id) => member(id));
    const signups = [
      ...members.slice(0, 5).map((m, index) => signup(m.id, 'A', index + 1)),
      signup('m6', 'N', 0),
    ];

    const view = buildSheetView(sheetWith(members, signups), NOW);
    const roster = rosterForDay(members, view.days.get(FIRST_DATE));

    expect(roster.playing.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(roster.available.map((m) => m.id)).toEqual(['m5']);
    expect(roster.unavailable.map((m) => m.id)).toEqual(['m6']);
  });

  test('leaves members who entered nothing out of every group', () => {
    const members = [member('m1'), member('m2')];
    const view = buildSheetView(sheetWith(members, []), NOW);
    const roster = rosterForDay(members, view.days.get(FIRST_DATE));

    expect(roster.playing).toEqual([]);
    expect(roster.available).toEqual([]);
    expect(roster.unavailable).toEqual([]);
  });

  test('returns empty groups for a date that is not on the sheet', () => {
    const roster = rosterForDay([member('m1')], undefined);

    expect(roster.playing).toEqual([]);
    expect(roster.available).toEqual([]);
    expect(roster.unavailable).toEqual([]);
  });
});
