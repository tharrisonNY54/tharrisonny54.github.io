-- Drop Saturday from the play days.
--
-- `schema.sql` only inserts its settings for a brand new sheet, so changing the
-- default there does nothing to a sheet that already exists. Run this once in
-- the SQL editor against a live project.
--
-- Saturday sign-ups already stored are left alone: the sheet only renders the
-- dates that `playDays` produces, so those rows simply stop being displayed.

update public.sheets
set settings = jsonb_set(settings, '{playDays}', jsonb_build_array(1, 3, 5))
where settings -> 'playDays' <> jsonb_build_array(1, 3, 5);
