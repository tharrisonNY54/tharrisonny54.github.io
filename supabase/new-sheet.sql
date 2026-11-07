-- =====================================================================
-- Create another group's sign up sheet in the same Supabase project.
--
-- Every group shares the same tables and the same website; the Sign Up Sheet
-- ID typed on the login screen decides which group's sheet opens. Groups never
-- see each other: every row level security policy is scoped to the sheet the
-- session token was issued for.
--
-- HOW TO USE
--   1. Copy this whole file into the Supabase SQL editor (do NOT edit it in the
--      repo — this repository is public).
--   2. Change the five values in the `settings` block below.
--   3. Run it. It refuses to run twice for the same sheet ID.
--   4. Sign in at /tennis/ with the new Sheet ID and the admin password, open
--      Website Maint, and add the group's members with Add New Member.
--   5. Edit your own row there and change the admin password to something
--      only you know (the Login ID field is the password).
-- =====================================================================

do $$
declare
  -- ---------------------------------------------------- change these five
  v_sheet_id   text   := 'Doubles2';              -- what members type to sign in (any case works)
  v_title      text   := 'SECOND GROUP';          -- heading shown on the sheet
  v_play_days  int[]  := array[2, 4];             -- 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  v_admin_last text   := 'Administrator';         -- admin's last name on the roster
  v_admin_pass text   := 'CHANGE-ME-0000';        -- admin's password, at least 6 characters
  -- -----------------------------------------------------------------------
  v_prefix text;
begin
  if exists (select 1 from public.sheets where lower(id) = lower(v_sheet_id)) then
    raise exception 'A sheet called "%" already exists.', v_sheet_id;
  end if;
  if length(btrim(v_admin_pass)) < 6 then
    raise exception 'The admin password must be at least 6 characters.';
  end if;

  -- Member ids are unique across every sheet, so prefix them with the sheet.
  v_prefix := lower(v_sheet_id) || '-';

  insert into public.sheets (id, settings)
  values (
    v_sheet_id,
    jsonb_build_object(
      'title', v_title,
      'daysDisplayed', 20,
      'playersPerGame', 4,
      'maxGames', 5,
      'maxPlayers', 36,
      'daysSubsProtected', 3,
      'daysNoChanges', 0,
      'guestPriority', 'regular',
      'playDays', to_jsonb(v_play_days),
      'announcement', '',
      'announcementBlink', false
    )
  );

  insert into public.members
    (id, sheet_id, seat, first_name, last_name, login_id, email, member_type, is_admin, is_guest_slot)
  values
    (v_prefix || 'admin1', v_sheet_id, 1, '', v_admin_last, btrim(v_admin_pass), '', 'regular', true,  false),
    (v_prefix || 'guest1', v_sheet_id, 2, '', 'Guest 1',    v_prefix || 'guest1', '', 'regular', false, true),
    (v_prefix || 'guest2', v_sheet_id, 3, '', 'Guest 2',    v_prefix || 'guest2', '', 'regular', false, true);

  raise notice 'Created sheet "%". Sign in with that ID and the admin password.', v_sheet_id;
end;
$$;
