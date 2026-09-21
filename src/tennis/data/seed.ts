/**
 * Demo roster and sign-ups.
 *
 * NOTHING IN THIS FILE DESCRIBES A REAL PERSON. Every name, phone number,
 * email address and login ID is invented, because this module is compiled into
 * the public bundle and served to anyone who opens the site.
 *
 * What *is* copied from the real sheet is its shape — 32 members plus two guest
 * rows, 13 substitutes, 3 administrators — so the demo exercises the same draw
 * behaviour the group will see. The real roster lives only in Supabase, behind
 * the login.
 */

import type { Member, Settings, Sheet, Signup } from '../types.js';
import { startOfToday, upcomingPlayDates } from '../lib/dates.js';

export const DEMO_SHEET_ID = 'Doubles40';

/** Handed out on the login screen so the demo is walk-up usable. */
export const DEMO_ADMIN_PASSWORD = '5205551010';

/** Whose row that password opens, named on the login screen's demo hint. */
export const DEMO_ADMIN_LAST_NAME = 'Calder';
export const DEMO_ADMIN_NAME = 'Nadia Calder';

export const DEFAULT_SETTINGS: Settings = {
  title: 'MWF GROUP',
  daysDisplayed: 20,
  playersPerGame: 4,
  maxGames: 5,
  maxPlayers: 36,
  daysSubsProtected: 3,
  daysNoChanges: 0,
  guestPriority: 'regular',
  // Monday, Wednesday, Friday.
  playDays: [1, 3, 5],
  announcement: 'Start Time: 7am - 9/2 8am',
  announcementBlink: true,
};

type RosterEntry = [last: string, first: string, kind: 'regular' | 'substitute' | 'admin'];

/** Alphabetical by last name, exactly as the sheet numbers the rows. */
const ROSTER: RosterEntry[] = [
  ['Abbott', 'Rita', 'regular'],
  ['Alvarez', 'Dale', 'substitute'],
  ['Bishop', 'Ruth', 'substitute'],
  ['Bramley', 'Otto', 'regular'],
  ['Calder', 'Nadia', 'admin'],
  ['Castellano', 'Vince', 'substitute'],
  ['Dunmore', 'Omar', 'substitute'],
  ['Ellery', 'Paul', 'regular'],
  ['Fairweather', 'June', 'regular'],
  ['Fontaine', 'Wendy', 'regular'],
  ['Garrick', 'Ken', 'regular'],
  ['Hollis', 'Ray', 'admin'],
  ['Ibarra', 'Ada', 'substitute'],
  ['Jessup', 'Grace', 'substitute'],
  ['Kirkwood', 'Sam', 'regular'],
  ['Lomax', 'Leif', 'regular'],
  ['Marchetti', 'Bea', 'substitute'],
  ['Merrill', 'Doug', 'regular'],
  ['Nyberg', 'Hal', 'regular'],
  ['Ortiz', 'Dora', 'substitute'],
  ['Pruitt', 'Joan', 'admin'],
  ['Quill', 'Ned', 'regular'],
  ['Ramsey', 'Alice', 'regular'],
  ['Rowan', 'Pearl', 'substitute'],
  ['Sackville', 'Gus', 'substitute'],
  ['Thorne', 'Mabel', 'regular'],
  ['Tolliver', 'Frank', 'regular'],
  ['Underhill', 'Tim', 'regular'],
  ['Vance', 'Bram', 'substitute'],
  ['Whitlock', 'Iris', 'regular'],
  ['Yeats', 'Cliff', 'substitute'],
  ['Zeller', 'Nora', 'substitute'],
];

export function buildSeedMembers(): Member[] {
  const members: Member[] = ROSTER.map(([last, first, kind], position) => {
    const seat = position + 1;
    // One administrator's password is fixed, because the login screen hands it
    // out so the demo is walk-up usable.
    const loginId = last === DEMO_ADMIN_LAST_NAME ? DEMO_ADMIN_PASSWORD : `52055${String(51000 + seat)}`;

    return {
      id: `m${String(seat).padStart(2, '0')}`,
      seat,
      firstName: first,
      lastName: last,
      loginId,
      email: `${asHandle(first)}.${asHandle(last)}@example.com`,
      phone: `520555${String(2000 + seat)}`,
      mobile: seat % 3 === 0 ? `520555${String(3000 + seat)}` : '',
      type: kind === 'substitute' ? 'substitute' : 'regular',
      isAdmin: kind === 'admin',
      isGuestSlot: false,
    };
  });

  for (const index of [0, 1]) {
    const seat = members.length + 1;
    members.push({
      id: `guest${index + 1}`,
      seat,
      firstName: '',
      lastName: `Guest ${index + 1}`,
      loginId: `guest${index + 1}`,
      email: '',
      phone: '',
      mobile: '',
      type: 'regular',
      isAdmin: false,
      isGuestSlot: true,
    });
  }

  return members;
}

function asHandle(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '') || 'member';
}

/**
 * Plausible sign-ups across the visible dates, generated from a fixed seed so
 * the demo sheet looks the same every time it is reset.
 */
export function buildSeedSignups(members: readonly Member[], settings: Settings, now: Date): Signup[] {
  const dates = upcomingPlayDates(startOfToday(now), settings.playDays, settings.daysDisplayed);
  const random = createRandom(20260904);
  const signups: Signup[] = [];
  const baseTime = now.getTime() - 21 * 86_400_000;

  for (const member of members) {
    if (member.isGuestSlot) continue;

    for (const [dateIndex, date] of dates.entries()) {
      const preference = pickPreference(member.type, random);
      if (preference === 'O') continue;

      signups.push({
        memberId: member.id,
        date,
        preference,
        // Spread sign-up times so the draw order — and therefore who ends up
        // yellow — varies realistically from column to column.
        signedUpAt:
          preference === 'A'
            ? baseTime + dateIndex * 3_600_000 + Math.floor(random() * 2_400_000)
            : null,
      });
    }
  }

  return signups;
}

function pickPreference(type: Member['type'], random: () => number): Signup['preference'] {
  const roll = random();

  if (type === 'substitute') {
    if (roll < 0.16) return 'A';
    return roll < 0.24 ? 'N' : 'O';
  }
  if (roll < 0.46) return 'A';
  return roll < 0.72 ? 'N' : 'O';
}

/** Small deterministic PRNG so the demo data is stable across reloads. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function buildSeedSheet(now: Date = new Date()): Sheet {
  const settings = { ...DEFAULT_SETTINGS };
  const members = buildSeedMembers();
  return {
    id: DEMO_SHEET_ID,
    settings,
    members,
    signups: buildSeedSignups(members, settings, now),
  };
}
