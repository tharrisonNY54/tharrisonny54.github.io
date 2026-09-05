/**
 * Browser-local store. Keeps the whole sheet in localStorage so the site is
 * fully usable with no account, no keys and no network — which is what makes it
 * demo-able to the group before any real data exists.
 *
 * Every write returns a new Sheet rather than mutating the one it was given.
 */

import type { Member, Settings, Sheet } from '../types.js';
import { buildSeedSheet } from './seed.js';
import {
  nextSeat,
  sortRoster,
  StoreError,
  type EmailMessage,
  type PreferenceChange,
  type SheetStore,
} from './store.js';

const SHEET_PREFIX = 'tennis:sheet:';
const OUTBOX_PREFIX = 'tennis:outbox:';
const OUTBOX_LIMIT = 50;

export interface OutboxEntry extends EmailMessage {
  sentAt: number;
}

export class LocalSheetStore implements SheetStore {
  readonly label = 'Demo data (this browser only)';

  constructor(private readonly now: () => Date = () => new Date()) {}

  async authenticate(sheetId: string, password: string): Promise<Member | null> {
    const sheet = await this.load(sheetId);
    const candidate = password.trim();
    return sheet.members.find((member) => member.loginId === candidate && !member.isGuestSlot) ?? null;
  }

  async load(sheetId: string): Promise<Sheet> {
    const stored = readJson<Sheet>(SHEET_PREFIX + normalizeId(sheetId));
    if (stored) return stored;

    const seeded = buildSeedSheet(this.now());
    // Only the demo sheet exists locally; anything else is a bad sheet ID.
    if (normalizeId(sheetId) !== normalizeId(seeded.id)) {
      throw new StoreError(`No sign up sheet named "${sheetId}".`);
    }
    this.write(seeded);
    return seeded;
  }

  async applyPreferences(sheetId: string, changes: readonly PreferenceChange[]): Promise<Sheet> {
    const sheet = await this.load(sheetId);
    const signups = new Map(sheet.signups.map((signup) => [key(signup.memberId, signup.date), signup]));
    const timestamp = this.now().getTime();

    for (const change of changes) {
      const existing = signups.get(key(change.memberId, change.date));

      if (change.preference === 'O') {
        signups.delete(key(change.memberId, change.date));
        continue;
      }

      signups.set(key(change.memberId, change.date), {
        memberId: change.memberId,
        date: change.date,
        preference: change.preference,
        // Keep the original sign-up time when someone re-submits an unchanged
        // `A`, so re-saving the form never costs them their place in the draw.
        signedUpAt:
          change.preference === 'A'
            ? existing?.preference === 'A' && existing.signedUpAt !== null
              ? existing.signedUpAt
              : timestamp
            : null,
      });
    }

    return this.write({ ...sheet, signups: [...signups.values()] });
  }

  async saveMember(sheetId: string, member: Member): Promise<Sheet> {
    const sheet = await this.load(sheetId);
    const isNew = !sheet.members.some((existing) => existing.id === member.id);

    if (isNew && sheet.members.length >= sheet.settings.maxPlayers) {
      throw new StoreError(`This sheet is limited to ${sheet.settings.maxPlayers} members.`);
    }

    const duplicate = sheet.members.find(
      (existing) => existing.loginId === member.loginId && existing.id !== member.id,
    );
    if (duplicate) {
      throw new StoreError(`Login ID ${member.loginId} already belongs to ${duplicate.lastName}.`);
    }

    const withMember = isNew
      ? [...sheet.members, { ...member, seat: nextSeat(sheet.members) }]
      : sheet.members.map((existing) => (existing.id === member.id ? { ...member } : existing));

    return this.write({ ...sheet, members: sortRoster(withMember) });
  }

  async removeMember(sheetId: string, memberId: string): Promise<Sheet> {
    const sheet = await this.load(sheetId);
    const target = sheet.members.find((member) => member.id === memberId);
    if (!target) throw new StoreError('That member is no longer on the sheet.');
    if (target.isGuestSlot) throw new StoreError('The guest rows cannot be deleted.');

    return this.write({
      ...sheet,
      members: sortRoster(sheet.members.filter((member) => member.id !== memberId)),
      signups: sheet.signups.filter((signup) => signup.memberId !== memberId),
    });
  }

  async saveSettings(sheetId: string, settings: Settings): Promise<Sheet> {
    const sheet = await this.load(sheetId);
    return this.write({ ...sheet, settings: { ...settings } });
  }

  /**
   * There is no mail server behind the demo, so messages are recorded in an
   * outbox the maintenance page displays. Nothing is silently dropped and
   * nothing pretends to have been delivered.
   */
  async sendEmail(sheetId: string, message: EmailMessage): Promise<void> {
    const storageKey = OUTBOX_PREFIX + normalizeId(sheetId);
    const outbox = readJson<OutboxEntry[]>(storageKey) ?? [];
    const entry: OutboxEntry = { ...message, sentAt: this.now().getTime() };
    writeJson(storageKey, [entry, ...outbox].slice(0, OUTBOX_LIMIT));
  }

  async resetDemoData(sheetId: string): Promise<Sheet> {
    const seeded = buildSeedSheet(this.now());
    if (normalizeId(sheetId) !== normalizeId(seeded.id)) {
      throw new StoreError(`No sign up sheet named "${sheetId}".`);
    }
    window.localStorage.removeItem(OUTBOX_PREFIX + normalizeId(sheetId));
    return this.write(seeded);
  }

  private write(sheet: Sheet): Sheet {
    writeJson(SHEET_PREFIX + normalizeId(sheet.id), sheet);
    return sheet;
  }
}

export function readOutbox(sheetId: string): OutboxEntry[] {
  return readJson<OutboxEntry[]>(OUTBOX_PREFIX + normalizeId(sheetId)) ?? [];
}

function key(memberId: string, date: string): string {
  return `${memberId}|${date}`;
}

function normalizeId(sheetId: string): string {
  return sheetId.trim().toLowerCase();
}

function readJson<T>(storageKey: string): T | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Corrupt or unavailable storage should look like "nothing saved yet"
    // rather than taking the page down.
    return null;
  }
}

function writeJson(storageKey: string, value: unknown): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    throw new StoreError('This browser would not save the sheet.', error);
  }
}
