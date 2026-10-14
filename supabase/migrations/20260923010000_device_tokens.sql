create table public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

create policy "user reads own device tokens"
  on public.device_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user inserts own device tokens"
  on public.device_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user updates own device tokens"
  on public.device_tokens
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user deletes own device tokens"
  on public.device_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.device_tokens to authenticated;
