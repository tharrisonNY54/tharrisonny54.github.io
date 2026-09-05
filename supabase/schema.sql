-- =====================================================================
-- Tennis sign up sheet — Supabase schema
--
-- Run this once in the Supabase SQL editor, then put your project URL and
-- anon key into public/tennis/config.js.
--
-- SECURITY MODEL
-- The anon key is public, so nothing is protected by "only our site calls
-- this". Instead:
--   * Row level security is ON for every table, with NO anonymous access.
--   * tennis_login() verifies the sheet ID and password, then hands back a
--     random session token.
--   * The browser sends that token as the `x-sheet-token` header on every
--     request, and every policy checks it against the sessions table.
--   * Members may only write their own sign ups. Administrators may write
--     anyone's, and are the only ones who may change members or settings.
--
-- KNOWN LIMITATION
-- Passwords are stored in the clear, because the original site emails a
-- member their password and shows it on the maintenance page. Any signed-in
-- member can therefore read other members' passwords. That matches how the
-- group works today, but if this ever holds anything sensitive, move to
-- Supabase Auth magic links instead.
-- =====================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ tables

create table if not exists public.sheets (
  id          text primary key,
  settings    jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  id            text primary key,
  sheet_id      text not null references public.sheets (id) on delete cascade,
  seat          integer not null,
  first_name    text not null default '',
  last_name     text not null default '',
  login_id      text not null,
  email         text not null default '',
  phone         text not null default '',
  mobile        text not null default '',
  member_type   text not null default 'regular' check (member_type in ('regular', 'substitute')),
  is_admin      boolean not null default false,
  is_guest_slot boolean not null default false,
  unique (sheet_id, login_id)
);

create index if not exists members_sheet_idx on public.members (sheet_id, seat);

create table if not exists public.signups (
  sheet_id     text not null references public.sheets (id) on delete cascade,
  member_id    text not null references public.members (id) on delete cascade,
  play_date    date not null,
  preference   text not null check (preference in ('N', 'A')),
  signed_up_at timestamptz,
  primary key (sheet_id, member_id, play_date)
);

create index if not exists signups_sheet_date_idx on public.signups (sheet_id, play_date);

create table if not exists public.sessions (
  token      uuid primary key default gen_random_uuid(),
  sheet_id   text not null references public.sheets (id) on delete cascade,
  member_id  text not null references public.members (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists sessions_expiry_idx on public.sessions (expires_at);

-- The sign-up clock belongs to the server, never the member's laptop, because
-- it decides who keeps their spot when a game is over-subscribed.
create or replace function public.stamp_signup()
returns trigger
language plpgsql
as $$
begin
  if new.preference = 'A' then
    -- Preserve the original time when an existing A is re-submitted unchanged.
    if tg_op = 'UPDATE' and old.preference = 'A' and old.signed_up_at is not null then
      new.signed_up_at := old.signed_up_at;
    else
      new.signed_up_at := now();
    end if;
  else
    new.signed_up_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists signups_stamp on public.signups;
create trigger signups_stamp
  before insert or update on public.signups
  for each row execute function public.stamp_signup();

-- --------------------------------------------------------- session helpers

-- The token the caller presented on this request, if any.
create or replace function public.current_token()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.headers', true)::json ->> 'x-sheet-token',
      ''
    ),
    ''
  )::uuid;
$$;

create or replace function public.session_member_id(p_sheet_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.member_id
  from public.sessions s
  where s.token = public.current_token()
    and s.sheet_id = p_sheet_id
    and s.expires_at > now();
$$;

create or replace function public.session_is_admin(p_sheet_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(m.is_admin, false)
  from public.sessions s
  join public.members m on m.id = s.member_id
  where s.token = public.current_token()
    and s.sheet_id = p_sheet_id
    and s.expires_at > now();
$$;

-- ------------------------------------------------------------------ login

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
  select * into v_member
  from public.members m
  where m.sheet_id = p_sheet_id
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

create or replace function public.tennis_logout()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sessions where token = public.current_token();
$$;

-- ------------------------------------------------------- row level security

alter table public.sheets   enable row level security;
alter table public.members  enable row level security;
alter table public.signups  enable row level security;
alter table public.sessions enable row level security;

-- Table privileges are checked BEFORE row level security, so without these
-- grants every policy below is unreachable and the site fails with
-- "permission denied for table members" even for a correctly signed-in member.
-- Newer Supabase projects do not grant these automatically.
--
-- Granting broadly here is safe precisely because RLS is on: these say "the
-- anonymous role may attempt these verbs", and the policies decide which rows
-- it actually reaches — which is none at all without a valid session token.
grant usage on schema public to anon, authenticated;
grant select, update                 on public.sheets  to anon, authenticated;
grant select, insert, update, delete on public.members to anon, authenticated;
grant select, insert, update, delete on public.signups to anon, authenticated;

-- sessions is reachable only through the security-definer functions above, so
-- it gets no grant at all. This revoke must stay AFTER the grants above.
revoke all on public.sessions from anon, authenticated;

drop policy if exists sheets_read on public.sheets;
create policy sheets_read on public.sheets
  for select using (public.session_member_id(id) is not null);

drop policy if exists sheets_admin_write on public.sheets;
create policy sheets_admin_write on public.sheets
  for update using (public.session_is_admin(id)) with check (public.session_is_admin(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.session_member_id(sheet_id) is not null);

drop policy if exists members_admin_write on public.members;
create policy members_admin_write on public.members
  for all using (public.session_is_admin(sheet_id)) with check (public.session_is_admin(sheet_id));

drop policy if exists signups_read on public.signups;
create policy signups_read on public.signups
  for select using (public.session_member_id(sheet_id) is not null);

-- A member writes their own row; an administrator writes anybody's.
drop policy if exists signups_write on public.signups;
create policy signups_write on public.signups
  for all
  using (
    public.session_is_admin(sheet_id)
    or member_id = public.session_member_id(sheet_id)
  )
  with check (
    public.session_is_admin(sheet_id)
    or member_id = public.session_member_id(sheet_id)
  );

grant execute on function public.tennis_login(text, text) to anon, authenticated;
grant execute on function public.tennis_logout() to anon, authenticated;

-- ------------------------------------------------------------- first sheet

insert into public.sheets (id, settings)
values (
  'Doubles40',
  jsonb_build_object(
    'title', 'MWF GROUP',
    'daysDisplayed', 20,
    'playersPerGame', 4,
    'maxGames', 5,
    'maxPlayers', 36,
    'daysSubsProtected', 3,
    'daysNoChanges', 0,
    'guestPriority', 'regular',
    'playDays', jsonb_build_array(1, 3, 5, 6),
    'announcement', 'Start Time: 7am - 9/2 8am',
    'announcementBlink', true
  )
)
on conflict (id) do nothing;

-- Seed the two guest rows and one placeholder administrator so somebody can
-- sign in and build the rest of the roster from the maintenance page.
--
-- This file is committed to a public repository, so it deliberately contains
-- no real names or contact details. Load the actual roster from a separate
-- seed kept outside the repo, and make sure that seed deletes 'admin1' — until
-- it does, CHANGE-ME-0000 is a working administrator password.
insert into public.members
  (id, sheet_id, seat, first_name, last_name, login_id, email, member_type, is_admin, is_guest_slot)
values
  ('admin1', 'Doubles40', 1, '', 'Administrator', 'CHANGE-ME-0000', '', 'regular', true, false),
  ('guest1', 'Doubles40', 2, '', 'Guest 1', 'guest1', '', 'regular', false, true),
  ('guest2', 'Doubles40', 3, '', 'Guest 2', 'guest2', '', 'regular', false, true)
on conflict (id) do nothing;
