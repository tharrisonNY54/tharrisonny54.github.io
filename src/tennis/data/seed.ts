/**
 * Demo roster and sign-ups.
 *
 * The names, member classes and row order mirror the group's real sheet so it
 * is recognisable at a glance, but every phone number, email address and login
 * ID here is invented. Nothing in this file is real contact information.
 */

import type { Member, Settings, Sheet, Signup } from '../types.js';
import { startOfToday, upcomingPlayDates } from '../lib/dates.js';

export const DEMO_SHEET_ID = 'Doubles40';

/** Handed out on the login screen so the demo is walk-up usable. */
export const DEMO_ADMIN_PASSWORD = '5205551010';

export const DEFAULT_SETTINGS: Settings = {
  title: 'MWF GROUP',
  daysDisplayed: 20,
  playersPerGame: 4,
  maxGames: 5,
  maxPlayers: 36,
  daysSubsProtected: 3,
  daysNoChanges: 0,
  guestPriority: 'regular',
  // Monday, Wednesday, Friday, Saturday.
  playDays: [1, 3, 5, 6],
  announcement: 'Start Time: 7am - 9/2 8am',
  announcementBlink: true,
};

type RosterEntry = [last: string, first: string, kind: 'regular' | 'substitute' | 'admin'];

/** Alphabetical by last name, exactly as the sheet numbers the rows. */
const ROSTER: RosterEntry[] = [
  ['Ball', 'Tom', 'regular'],
  ['Bennett', 'Bruce', 'substitute'],
  ['Conour', 'Joe', 'substitute'],
  ['El Sharif', 'Salah', 'admin'],
  ['Erickson', 'Mike', 'substitute'],
  ['Estupinan', 'Marco', 'substitute'],
  ['Flint', 'Jim', 'regular'],
  ['Haberbush', 'John', 'regular'],
  ['Hansen', 'Hans', 'regular'],
  ['Harrison', 'Darel', 'admin'],
  ['Hyde', 'C.R.', 'substitute'],
  ['Ives', 'Debbie', 'substitute'],
  ['Khan', 'Atif', 'regular'],
  ['Kokke', 'Henri', 'regular'],
  ['Larson', 'Lance', 'substitute'],
  ['Lawlor', 'Ken', 'regular'],
  ['Levine', 'Irv', 'substitute'],
  ['Mack', 'Jeff', 'admin'],
  ['Makansi', 'Jason', 'regular'],
  ['Martin', 'Jonathan', 'regular'],
  ['McCleary', 'Shawn', 'substitute'],
  ['Mckinnon', 'George', 'regular'],
  ['Overlund', 'Scott', 'regular'],
  ['Peterson', 'Mark', 'regular'],
  ['Pettit', 'Jan', 'substitute'],
  ['Richied', 'Chris', 'regular'],
  ['Rosenfeld', 'Chip', 'substitute'],
  ['Sommers', 'Adam', 'regular'],
  ['Sorensen', 'Keld', 'regular'],
  ['Stuart', 'Ian', 'regular'],
  ['Walsh', 'Tom', 'substitute'],
  ['Wilcox', 'Paul', 'substitute'],
];

export function buildSeedMembers(): Member[] {
  const members: Member[] = ROSTER.map(([last, first, kind], position) => {
    const seat = position + 1;
    // Darel Harrison is the account the demo instructions hand out.
    const loginId = last === 'Harrison' ? DEMO_ADMIN_PASSWORD : `52055${String(51000 + seat)}`;

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
      const preference = pickPreference(member.type, date, random);
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

function pickPreference(
  type: Member['type'],
  date: string,
  random: () => number,
): Signup['preference'] {
  const isSaturday = new Date(`${date}T00:00:00`).getDay() === 6;
  const roll = random();

  if (isSaturday) return roll < 0.12 ? 'A' : 'O';
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
