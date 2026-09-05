/**
 * Storage boundary.
 *
 * Everything above this interface is plain logic and DOM work, so the app runs
 * unchanged against the browser-local demo store or against Supabase. Swapping
 * one for the other is a config change, not a rewrite.
 */

import type { Member, Preference, Settings, Sheet } from '../types.js';

export type EmailKind = 'welcome' | 'promoted' | 'announcement' | 'custom';

export interface EmailMessage {
  kind: EmailKind;
  to: string[];
  subject: string;
  body: string;
}

export interface PreferenceChange {
  memberId: string;
  date: string;
  preference: Preference;
}

export interface SheetStore {
  /** Which backend is live, for the footer badge and the maintenance page. */
  readonly label: string;

  /** Sheet ID + user password. Resolves to null when either is wrong. */
  authenticate(sheetId: string, password: string): Promise<Member | null>;

  load(sheetId: string): Promise<Sheet>;

  /** Writes the edit row. The draw is always recomputed from stored sign-ups. */
  applyPreferences(sheetId: string, changes: readonly PreferenceChange[]): Promise<Sheet>;

  /** Creates when the member has no id, updates otherwise. */
  saveMember(sheetId: string, member: Member): Promise<Sheet>;

  removeMember(sheetId: string, memberId: string): Promise<Sheet>;

  saveSettings(sheetId: string, settings: Settings): Promise<Sheet>;

  sendEmail(sheetId: string, message: EmailMessage): Promise<void>;

  /** Demo affordance: restore the seeded roster and sign-ups. */
  resetDemoData?(sheetId: string): Promise<Sheet>;
}

export class StoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StoreError';
  }
}

/** Next free seat number, used when adding a member. */
export function nextSeat(members: readonly Member[]): number {
  return members.reduce((highest, member) => Math.max(highest, member.seat), 0) + 1;
}

/** Keeps rows alphabetical, with the guest slots pinned to the bottom. */
export function sortRoster(members: readonly Member[]): Member[] {
  return [...members]
    .sort((left, right) => {
      if (left.isGuestSlot !== right.isGuestSlot) return left.isGuestSlot ? 1 : -1;
      const byLast = left.lastName.localeCompare(right.lastName);
      return byLast !== 0 ? byLast : left.firstName.localeCompare(right.firstName);
    })
    .map((member, index) => ({ ...member, seat: index + 1 }));
}
