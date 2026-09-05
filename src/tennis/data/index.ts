/**
 * Picks the store the app runs against.
 *
 * `tennis/config.js` is a plain script the site owner edits by hand — no
 * rebuild, no secrets in the repo. Fill in the Supabase URL and anon key and
 * the whole app switches over; leave them blank and it runs on demo data.
 */

import { LocalSheetStore } from './local-store.js';
import { SupabaseSheetStore, type SupabaseConfig } from './supabase-store.js';
import type { SheetStore } from './store.js';

declare global {
  interface Window {
    TENNIS_CONFIG?: Partial<SupabaseConfig>;
  }
}

let store: SheetStore | null = null;

export function getStore(): SheetStore {
  if (store) return store;

  const config = window.TENNIS_CONFIG;
  const url = config?.url?.trim();
  const anonKey = config?.anonKey?.trim();

  store = url && anonKey ? new SupabaseSheetStore({ url, anonKey }) : new LocalSheetStore();
  return store;
}

export function isDemoMode(): boolean {
  return getStore() instanceof LocalSheetStore;
}

export * from './store.js';
