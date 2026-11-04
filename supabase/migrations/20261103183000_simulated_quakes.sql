create table public.simulated_quakes (
  id text primary key,
  magnitude double precision not null,
  place text not null,
  occurred_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  depth_km double precision not null,
  created_at timestamptz not null default now(),
  constraint simulated_quakes_latitude_range check (latitude between -90 and 90),
  constraint simulated_quakes_longitude_range check (longitude between -180 and 180),
  constraint simulated_quakes_magnitude_range check (magnitude between 0.1 and 10),
  constraint simulated_quakes_depth_range check (depth_km between 0 and 800)
);

create index simulated_quakes_occurred_at_idx
  on public.simulated_quakes (occurred_at desc);

alter table public.simulated_quakes enable row level security;

revoke all on table public.simulated_quakes from anon, authenticated;
