-- Let members type the Sign Up Sheet ID in any case: "Doubles40", "doubles40"
-- and "DOUBLES40" all sign in to the same sheet.
--
-- Run this once in the Supabase SQL editor against the live project. It is the
-- same definition `schema.sql` now contains, so a fresh project needs nothing
-- extra.

-- Two sheets that differ only by case would make the login ambiguous.
create unique index if not exists sheets_id_lower_idx on public.sheets (lower(id));

create or replace function public.tennis_login(p_sheet_id text, p_password text)
returns table (
  token         uuid,
  id            text,
  sheet_id      text,
  seat          integer,
  first_name    text,
  last_name     text,
  login_id      text,
  email         text,
  phone         text,
  mobile        text,
  member_type   text,
  is_admin      boolean,
  is_guest_slot boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_token  uuid;
begin
  -- The stored spelling of the sheet ID is returned, and the browser uses
  -- that for every later request.
  select * into v_member
  from public.members m
  where lower(m.sheet_id) = lower(btrim(p_sheet_id))
    and m.login_id = btrim(p_password)
    and not m.is_guest_slot;

  if not found then
    -- Deliberately no detail about which half was wrong.
    return;
  end if;

  delete from public.sessions where expires_at < now();

  insert into public.sessions (sheet_id, member_id)
  values (v_member.sheet_id, v_member.id)
  returning sessions.token into v_token;

  return query
  select v_token, v_member.id, v_member.sheet_id, v_member.seat, v_member.first_name,
         v_member.last_name, v_member.login_id, v_member.email, v_member.phone,
         v_member.mobile, v_member.member_type, v_member.is_admin, v_member.is_guest_slot;
end;
$$;

grant execute on function public.tennis_login(text, text) to anon, authenticated;
