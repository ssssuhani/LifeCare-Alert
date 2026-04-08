-- Fall detection system schema for Supabase
-- Run this file in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fall_events (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null default 'fall',
  heart_rate integer,
  spo2 integer,
  created_at timestamptz not null default now(),
  constraint fall_events_event_type_check check (event_type <> '')
);

create table if not exists public.locations (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.fall_events(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx
  on public.users (email);

create index if not exists devices_user_id_idx
  on public.devices (user_id);

create index if not exists fall_events_device_id_created_at_idx
  on public.fall_events (device_id, created_at desc);

create index if not exists locations_event_id_created_at_idx
  on public.locations (event_id, created_at desc);

alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.fall_events enable row level security;
alter table public.locations enable row level security;

drop policy if exists "users_select_anon" on public.users;
drop policy if exists "devices_select_anon" on public.devices;
drop policy if exists "devices_insert_anon" on public.devices;
drop policy if exists "fall_events_select_anon" on public.fall_events;
drop policy if exists "fall_events_insert_anon" on public.fall_events;
drop policy if exists "locations_select_anon" on public.locations;
drop policy if exists "locations_insert_anon" on public.locations;

create policy "users_select_anon"
  on public.users
  for select
  to anon
  using (true);

create policy "devices_select_anon"
  on public.devices
  for select
  to anon
  using (true);

create policy "devices_insert_anon"
  on public.devices
  for insert
  to anon
  with check (true);

create policy "fall_events_select_anon"
  on public.fall_events
  for select
  to anon
  using (true);

create policy "fall_events_insert_anon"
  on public.fall_events
  for insert
  to anon
  with check (true);

create policy "locations_select_anon"
  on public.locations
  for select
  to anon
  using (true);

create policy "locations_insert_anon"
  on public.locations
  for insert
  to anon
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fall_events'
  ) then
    alter publication supabase_realtime add table public.fall_events;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'locations'
  ) then
    alter publication supabase_realtime add table public.locations;
  end if;
end $$;

-- Optional sample data for quick testing.
insert into public.users (name, email)
select 'Demo User', 'demo@example.com'
where not exists (
  select 1 from public.users where email = 'demo@example.com'
);

insert into public.devices (user_id, device_name)
select u.id, 'ESP32 Fall Detector'
from public.users u
where u.email = 'demo@example.com'
  and not exists (
    select 1
    from public.devices d
    where d.user_id = u.id
      and d.device_name = 'ESP32 Fall Detector'
  );
