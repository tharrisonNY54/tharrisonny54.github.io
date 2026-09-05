/*
 * Sign up sheet configuration.
 *
 * This file is served as-is and is NOT part of the build, so it can be edited
 * on the live site without recompiling anything.
 *
 * Leave both values empty and the site runs on demo data stored in whoever's
 * browser is looking at it — good for showing the group what it does, but
 * nothing is shared between people.
 *
 * Fill both in and the site runs against Supabase for real:
 *
 *   url     - your project URL,  https://xxxxxxxx.supabase.co
 *   anonKey - the project's anon/publishable key
 *
 * The anon key is meant to be public. It is safe here ONLY when row level
 * security is switched on for every table — see supabase/schema.sql,
 * which sets that up.
 */
window.TENNIS_CONFIG = {
  url: '',
  anonKey: '',
};
