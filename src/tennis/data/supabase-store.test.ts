import { afterEach, describe, expect, test, vi } from 'vitest';

import { SupabaseSheetStore } from './supabase-store.js';

const SETTINGS = {
  title: 'T', daysDisplayed: 20, playersPerGame: 4, maxGames: 5, maxPlayers: 36,
  daysSubsProtected: 3, daysNoChanges: 0, guestPriority: 'regular', playDays: [1],
  announcement: '', announcementBlink: false,
};

function stubFetch(signupRows: unknown[]): string[] {
  const urls: string[] = [];
  vi.stubGlobal('window', { sessionStorage: { getItem: () => 'token', setItem: () => {} } });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    urls.push(`${init?.method ?? 'GET'} ${url}`);
    let body: unknown[] = [];
    if (url.includes('/sheets?')) body = [{ id: 'Doubles40', settings: SETTINGS }];
    if (url.includes('/signups?')) {
      // Behave like Supabase: honour limit/offset, never more than 1000 rows.
      const params = new URL(url).searchParams;
      const limit = Math.min(Number(params.get('limit') ?? 1000), 1000);
      const offset = Number(params.get('offset') ?? 0);
      body = signupRows.slice(offset, offset + limit);
    }
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return urls;
}

function signupRow(index: number): unknown {
  return { member_id: `m${index}`, play_date: '2099-01-05', preference: 'A', signed_up_at: null };
}

function store(): SupabaseSheetStore {
  return new SupabaseSheetStore({ url: 'https://x.supabase.co', anonKey: 'k', emailEnabled: false });
}

describe('SupabaseSheetStore.load', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('requests only sign-ups from today onward, using reads only', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 15, 30));
    const urls = stubFetch([]);

    await store().load('Doubles40');

    const signupUrl = urls.find((url) => url.includes('/signups?'));
    expect(signupUrl).toContain('play_date=gte.2026-11-09');
    expect(signupUrl).toContain('sheet_id=eq.Doubles40');
    expect(urls.every((url) => url.startsWith('GET '))).toBe(true);
  });

  test('makes a single request when everything fits in one page', async () => {
    const urls = stubFetch(Array.from({ length: 377 }, (_, index) => signupRow(index)));

    const sheet = await store().load('Doubles40');

    expect(sheet.signups).toHaveLength(377);
    expect(urls.filter((url) => url.includes('/signups?'))).toHaveLength(1);
  });

  test('reads every page when there are more rows than Supabase returns at once', async () => {
    stubFetch(Array.from({ length: 2345 }, (_, index) => signupRow(index)));

    const sheet = await store().load('Doubles40');

    expect(sheet.signups).toHaveLength(2345);
    expect(new Set(sheet.signups.map((signup) => signup.memberId)).size).toBe(2345);
  });
});
