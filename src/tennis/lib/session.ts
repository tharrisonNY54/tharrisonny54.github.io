/**
 * Login persistence, matching the behaviour the original Help page describes:
 *
 *   "The server remembers your login as long as you don't shut down your
 *    browser" — so the active session lives in sessionStorage.
 *
 *   "If you select [remember this login] a cookie is placed on your computer...
 *    The cookie expires in a weeks time and is renewed each time you login."
 */

import type { Session } from '../types.js';

const SESSION_KEY = 'tennis:session';
const REMEMBER_KEY = 'tennis:remember';
const REMEMBER_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export interface RememberedLogin {
  sheetId: string;
  password: string;
  expiresAt: number;
}

export function startSession(sheetId: string, memberId: string): Session {
  const session: Session = {
    sheetId,
    memberId,
    // You are your own default in the edit row when you log in.
    editingMemberId: memberId,
    expiresAt: Date.now() + REMEMBER_DAYS * MS_PER_DAY,
  };
  writeSession(session);
  return session;
}

export function readSession(): Session | null {
  const session = read<Session>(window.sessionStorage, SESSION_KEY);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    endSession();
    return null;
  }
  return session;
}

/** Redirects to the login page when nobody is signed in. */
export function requireSession(): Session | null {
  const session = readSession();
  if (!session) {
    window.location.replace('./index.html');
    return null;
  }
  return session;
}

export function setEditingMember(memberId: string): void {
  const session = readSession();
  if (session) writeSession({ ...session, editingMemberId: memberId });
}

export function endSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable; the user is logged out
    // either way once the page reloads.
  }
}

export function rememberLogin(sheetId: string, password: string): void {
  write(window.localStorage, REMEMBER_KEY, {
    sheetId,
    password,
    expiresAt: Date.now() + REMEMBER_DAYS * MS_PER_DAY,
  } satisfies RememberedLogin);
}

export function readRememberedLogin(): RememberedLogin | null {
  const remembered = read<RememberedLogin>(window.localStorage, REMEMBER_KEY);
  if (!remembered) return null;
  if (remembered.expiresAt < Date.now()) {
    forgetLogin();
    return null;
  }
  return remembered;
}

export function forgetLogin(): void {
  try {
    window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // Same as above — a storage failure here is not worth interrupting the user.
  }
}

function writeSession(session: Session): void {
  write(window.sessionStorage, SESSION_KEY, session);
}

function read<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-browsing modes can refuse writes. Losing "remember me" is an
    // acceptable degradation; failing the login is not.
  }
}
