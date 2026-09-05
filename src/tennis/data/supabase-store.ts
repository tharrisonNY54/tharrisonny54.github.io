/**
 * Supabase-backed store.
 *
 * Talks to PostgREST over plain `fetch`, so the tennis app adds no npm
 * dependency to the portfolio build. Login goes through a `security definer`
 * function rather than a table read, so the anon key never needs permission to
 * select login IDs. See `supabase/schema.sql` for the matching SQL.
 */

import type { Member, Settings, Sheet, Signup } from '../types.js';
import { recordOutbox } from './local-store.js';
import { sortRoster, StoreError, type EmailMessage, type PreferenceChange, type SheetStore } from './store.js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /**
   * Outbound mail is opt-in. Promotion notices are sent automatically whenever
   * the draw changes, so a half-configured site could mail 32 people without
   * anyone pressing a button. Leave this false until the group is ready.
   */
  emailEnabled: boolean;
}

interface MemberRow {
  id: string;
  sheet_id: string;
  seat: number;
  first_name: string;
  last_name: string;
  login_id: string;
  email: string;
  phone: string;
  mobile: string;
  member_type: 'regular' | 'substitute';
  is_admin: boolean;
  is_guest_slot: boolean;
}

interface SignupRow {
  member_id: string;
  play_date: string;
  preference: 'N' | 'A';
  signed_up_at: string | null;
}

interface SheetRow {
  id: string;
  settings: Settings;
}

/** `tennis_login` returns the member row plus a fresh session token. */
interface LoginRow extends MemberRow {
  token: string;
}

const TOKEN_KEY = 'tennis:token';

function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Without storage the member simply has to sign in again on the next page.
  }
}

export class SupabaseSheetStore implements SheetStore {
  constructor(private readonly config: SupabaseConfig) {}

  /** Muting is easy to forget, so the footer of every page says it out loud. */
  get label(): string {
    return this.config.emailEnabled ? 'Live' : 'Live · email off';
  }

  async authenticate(sheetId: string, password: string): Promise<Member | null> {
    const rows = await this.rpc<LoginRow[]>('tennis_login', {
      p_sheet_id: sheetId.trim(),
      p_password: password.trim(),
    });
    const row = rows?.[0];
    if (!row) return null;

    // Every later request is authorised by this token, not by the anon key.
    writeToken(row.token);
    return toMember(row);
  }

  async load(sheetId: string): Promise<Sheet> {
    const id = sheetId.trim();
    const [sheets, members, signups] = await Promise.all([
      this.select<SheetRow[]>('sheets', `id=eq.${encodeURIComponent(id)}&select=id,settings`),
      this.select<MemberRow[]>('members', `sheet_id=eq.${encodeURIComponent(id)}&select=*&order=seat`),
      this.select<SignupRow[]>(
        'signups',
        `sheet_id=eq.${encodeURIComponent(id)}&select=member_id,play_date,preference,signed_up_at`,
      ),
    ]);

    const sheetRow = sheets[0];
    if (!sheetRow) throw new StoreError(`No sign up sheet named "${sheetId}".`);

    return {
      id: sheetRow.id,
      settings: sheetRow.settings,
      members: sortRoster(members.map(toMember)),
      signups: signups.map(toSignup),
    };
  }

  async applyPreferences(sheetId: string, changes: readonly PreferenceChange[]): Promise<Sheet> {
    const id = sheetId.trim();
    const cleared = changes.filter((change) => change.preference === 'O');
    const kept = changes.filter((change) => change.preference !== 'O');

    for (const change of cleared) {
      await this.request(
        `signups?sheet_id=eq.${encodeURIComponent(id)}&member_id=eq.${encodeURIComponent(change.memberId)}&play_date=eq.${change.date}`,
        { method: 'DELETE' },
      );
    }

    if (kept.length > 0) {
      // `signed_up_at` is left to the database default/trigger so the sign-up
      // clock is the server's, not whatever the member's laptop thinks.
      await this.request('signups?on_conflict=sheet_id,member_id,play_date', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(
          kept.map((change) => ({
            sheet_id: id,
            member_id: change.memberId,
            play_date: change.date,
            preference: change.preference,
          })),
        ),
      });
    }

    return this.load(id);
  }

  async saveMember(sheetId: string, member: Member): Promise<Sheet> {
    const id = sheetId.trim();
    await this.request('members?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ ...toMemberRow(member), sheet_id: id }]),
    });
    return this.load(id);
  }

  async removeMember(sheetId: string, memberId: string): Promise<Sheet> {
    const id = sheetId.trim();
    await this.request(
      `members?sheet_id=eq.${encodeURIComponent(id)}&id=eq.${encodeURIComponent(memberId)}`,
      { method: 'DELETE' },
    );
    return this.load(id);
  }

  async saveSettings(sheetId: string, settings: Settings): Promise<Sheet> {
    const id = sheetId.trim();
    await this.request(`sheets?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    });
    return this.load(id);
  }

  /**
   * Delivery happens in a Supabase Edge Function so the mail provider's API key
   * stays server-side. The browser only ever names recipients by member id.
   */
  async sendEmail(sheetId: string, message: EmailMessage): Promise<void> {
    if (!this.config.emailEnabled) {
      // Log it where the maintenance page can show it, and deliver nothing.
      recordOutbox(sheetId, message, Date.now());
      return;
    }

    const response = await fetch(`${this.baseUrl()}/functions/v1/send-email`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId: sheetId.trim(), ...message }),
    });
    if (!response.ok) {
      throw new StoreError(`Email could not be sent (${response.status}).`);
    }
  }

  private async select<T>(table: string, query: string): Promise<T> {
    return this.request<T>(`${table}?${query}`, { method: 'GET' });
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    return this.request<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/rest/v1/${path}`, {
        ...init,
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...init.headers,
        },
      });
    } catch (error) {
      throw new StoreError('Could not reach the sign up sheet server.', error);
    }

    if (!response.ok) {
      throw new StoreError(await describeFailure(response));
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  private headers(): Record<string, string> {
    const token = readToken();
    return {
      apikey: this.config.anonKey,
      // Legacy anon keys are JWTs and the gateway expects them in Authorization
      // too. The newer `sb_publishable_...` keys are not JWTs, and sending one
      // as a Bearer token fails JWT parsing before the request ever reaches
      // PostgREST, so it goes in `apikey` alone.
      ...(isJwt(this.config.anonKey)
        ? { Authorization: `Bearer ${this.config.anonKey}` }
        : {}),
      // Row level security reads this header; without it nothing is visible.
      ...(token ? { 'x-sheet-token': token } : {}),
    };
  }

  private baseUrl(): string {
    return this.config.url.replace(/\/+$/, '');
  }
}

/** Three dot-separated base64url segments starting with a `{"alg":...` header. */
function isJwt(key: string): boolean {
  return key.startsWith('eyJ') && key.split('.').length === 3;
}

async function describeFailure(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; hint?: string };
    if (body.message) return body.message;
  } catch {
    // Fall through to the status-only message below.
  }
  return `The server rejected that request (${response.status}).`;
}

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    seat: row.seat,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    loginId: row.login_id ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    mobile: row.mobile ?? '',
    type: row.member_type,
    isAdmin: row.is_admin,
    isGuestSlot: row.is_guest_slot,
  };
}

function toMemberRow(member: Member): Omit<MemberRow, 'sheet_id'> {
  return {
    id: member.id,
    seat: member.seat,
    first_name: member.firstName,
    last_name: member.lastName,
    login_id: member.loginId,
    email: member.email,
    phone: member.phone,
    mobile: member.mobile,
    member_type: member.type,
    is_admin: member.isAdmin,
    is_guest_slot: member.isGuestSlot,
  };
}

function toSignup(row: SignupRow): Signup {
  return {
    memberId: row.member_id,
    date: row.play_date,
    preference: row.preference,
    signedUpAt: row.signed_up_at ? Date.parse(row.signed_up_at) : null,
  };
}
