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
 *   anonKey - the project's publishable (anon) key
 *
 * The publishable key is meant to be public. It is safe here ONLY when row
 * level security is switched on for every table — see supabase/schema.sql,
 * which sets that up. It grants no read access on its own: every policy also
 * requires a session token issued by tennis_login().
 */
window.TENNIS_CONFIG = {
  url: 'https://gpbneaabmyajiklaaizr.supabase.co',
  anonKey: 'sb_publishable_ViyZXIuE7459yuOf3JselA_ZVsy0Zua',

  /*
   * OUTBOUND EMAIL. Off until this reads exactly `true`.
   *
   * This matters more than it looks. Promotion notices are sent automatically
   * whenever the draw changes — nobody presses a button — so switching this on
   * before the roster and the play days are right can mail 32 people by
   * accident. While it is off, every message the site would have sent is
   * listed on the Website Maintenance page instead, and the footer of every
   * page reads "Live - email off".
   *
   * Turn it on only after:
   *   1. the roster in Supabase is correct,
   *   2. the send-email function is deployed with a mail provider key,
   *   3. you have sent yourself one Send Welcome and seen it arrive.
   */
  emailEnabled: false,
};
