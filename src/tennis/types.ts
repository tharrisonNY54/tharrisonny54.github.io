/**
 * Domain types for the tennis sign-up sheet.
 *
 * Vocabulary follows the original site's Help page so that the code reads the
 * same way the members talk about it:
 *   O = Open (no preference entered)   N = Not available
 *   A = Available (signed up, waiting) P = Playing (selected in the draw)
 *
 * Only O / N / A are ever *stored*. P is always computed by the draw.
 */

/** What a member can actually choose in the edit row. */
export type Preference = 'O' | 'N' | 'A';

/** What a cell shows after the draw has run. */
export type DisplayStatus = 'O' | 'N' | 'A' | 'P';

/** Regulars are drawn ahead of substitutes. */
export type MemberType = 'regular' | 'substitute';

export interface Member {
  id: string;
  /** 1-based row number shown in the button to the left of the name. */
  seat: number;
  firstName: string;
  lastName: string;
  /** Doubles as the user password on the login screen. */
  loginId: string;
  email: string;
  phone: string;
  mobile: string;
  type: MemberType;
  /** Website administrators may edit any member and reach Website Maint. */
  isAdmin: boolean;
  /** The two "Guest" rows members use to sign in an outside fill-in player. */
  isGuestSlot: boolean;
}

export interface Signup {
  memberId: string;
  /** ISO `yyyy-mm-dd` for a play date. */
  date: string;
  preference: Preference;
  /**
   * When the member last moved to `A`. The draw breaks ties first-come
   * first-served, and dropping out bumps "the last that signed up".
   * Null whenever the preference is not `A`.
   */
  signedUpAt: number | null;
}

export interface Settings {
  title: string;
  /** How many upcoming play dates appear as columns. */
  daysDisplayed: number;
  playersPerGame: number;
  maxGames: number;
  maxPlayers: number;
  /** Inside this many days of play, substitutes can no longer be bumped. */
  daysSubsProtected: number;
  /** Inside this many days of play, the sheet is locked. 0 disables locking. */
  daysNoChanges: number;
  /** Whether the two guest rows are drawn as regulars or as substitutes. */
  guestPriority: MemberType;
  /** Weekdays this group plays, as `Date.getDay()` values. */
  playDays: number[];
  announcement: string;
  announcementBlink: boolean;
}

export interface Sheet {
  /** The "Sign Up Sheet ID" typed on the login screen, e.g. `Doubles40`. */
  id: string;
  settings: Settings;
  members: Member[];
  signups: Signup[];
}

/** Who is logged in, and which member's row they are currently editing. */
export interface Session {
  sheetId: string;
  memberId: string;
  /** Admins may point the edit row at somebody else. */
  editingMemberId: string;
  expiresAt: number;
}

export const REGULAR: MemberType = 'regular';
export const SUBSTITUTE: MemberType = 'substitute';

export function fullName(member: Member): string {
  return member.isGuestSlot ? member.lastName : `${member.lastName}, ${member.firstName}`;
}
