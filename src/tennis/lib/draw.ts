/**
 * The draw: deciding which of the members who signed up (`A`) actually play
 * (`P`) on a given date.
 *
 * The rules come straight from the original site's Help page:
 *
 *   "A  Available - The member has signed up but there are not enough members
 *    to make a game."
 *
 *   "If you created an A status and caused the number of A's to be enough to
 *    fill a game, then your change will appear as a P and the other A's will
 *    change to P's. If you changed a P to an O or N, then other P's, the last
 *    that signed up, will be changed to A's."
 *
 * Two consequences drive the whole implementation:
 *
 *   1. Members are only promoted in COMPLETE games. Five sign-ups with four
 *      players per game means four P's and one A, never five P's. So the number
 *      of players playing is always a multiple of `playersPerGame`, and the
 *      game count in the column header is exactly `playing / playersPerGame`.
 *
 *   2. Order is first-come first-served, with regulars ranked ahead of
 *      substitutes. Whoever signed up last is the first to lose a spot.
 */

import type { Member, MemberType, Settings } from '../types.js';

export interface DrawCandidate {
  memberId: string;
  /** Effective type — guest rows have already been resolved here. */
  type: MemberType;
  /** Epoch ms of when this member moved to `A`. */
  signedUpAt: number;
}

export interface DrawResult {
  /** Members shown green, in the order they were drawn. */
  playing: string[];
  /** Members still shown yellow, in the order they would be promoted. */
  waiting: string[];
  /** Full games formed — the number beside the day code in the header. */
  games: number;
}

/**
 * The guest rows are drawn as whichever class the sheet settings say, which is
 * what the "Guest Priority" radio buttons on the maintenance page control.
 */
export function effectiveType(member: Member, settings: Settings): MemberType {
  return member.isGuestSlot ? settings.guestPriority : member.type;
}

/**
 * Rank the sign-ups for one date and split them into playing and waiting.
 *
 * `daysOut` is how many days from today the date falls; it decides whether
 * substitutes are still protected from being bumped by a late-signing regular.
 */
export function drawForDate(
  candidates: readonly DrawCandidate[],
  settings: Settings,
  daysOut: number,
): DrawResult {
  const ordered = rankCandidates(candidates, settings, daysOut);

  const capacity = settings.maxGames * settings.playersPerGame;
  const contenders = Math.min(ordered.length, capacity);
  const games = Math.floor(contenders / settings.playersPerGame);
  const seats = games * settings.playersPerGame;

  return {
    playing: ordered.slice(0, seats).map((candidate) => candidate.memberId),
    waiting: ordered.slice(seats).map((candidate) => candidate.memberId),
    games,
  };
}

/**
 * Draw order. Normally regulars come first and ties break by sign-up time.
 *
 * Once the date is inside the "Days Subs Protected" window, class is ignored
 * and order is purely first-come first-served — that is what protects a
 * substitute who committed early from being displaced at the last minute.
 */
function rankCandidates(
  candidates: readonly DrawCandidate[],
  settings: Settings,
  daysOut: number,
): DrawCandidate[] {
  const substitutesProtected = daysOut <= settings.daysSubsProtected;

  return [...candidates].sort((left, right) => {
    if (!substitutesProtected) {
      const byClass = classRank(left.type) - classRank(right.type);
      if (byClass !== 0) return byClass;
    }
    if (left.signedUpAt !== right.signedUpAt) return left.signedUpAt - right.signedUpAt;
    return left.memberId.localeCompare(right.memberId);
  });
}

function classRank(type: MemberType): number {
  return type === 'regular' ? 0 : 1;
}

/**
 * Whether the sheet still accepts changes for a date. "Days No Changes: 0"
 * disables locking entirely, which is how the group runs today.
 */
export function isDateLocked(daysOut: number, settings: Settings): boolean {
  if (daysOut < 0) return true;
  if (settings.daysNoChanges <= 0) return false;
  return daysOut < settings.daysNoChanges;
}
