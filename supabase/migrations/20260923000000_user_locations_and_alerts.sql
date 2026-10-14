create table public.user_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  location_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint user_locations_latitude_range check (latitude between -90 and 90),
  constraint user_locations_longitude_range check (longitude between -180 and 180)
);

create table public.quake_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quake_id text not null,
  magnitude double precision not null,
  place text not null,
  latitude double precision not null,
  longitude double precision not null,
  distance_km double precision not null,
  quake_time timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, quake_id)
);

create index quake_alerts_user_unseen_idx
  on public.quake_alerts (user_id)
  where seen_at is null;

alter table public.user_locations enable row level security;
alter table public.quake_alerts enable row level security;

create policy "user reads own location"
  on public.user_locations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user inserts own location"
  on public.user_locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user updates own location"
  on public.user_locations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user reads own alerts"
  on public.quake_alerts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user marks own alerts seen"
  on public.quake_alerts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_locations to authenticated;
grant select, update on public.quake_alerts to authenticated;

alter publication supabase_realtime add table public.quake_alerts;
