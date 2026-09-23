-- FIRST-TIME setup for an EMPTY development project only.
-- Run profile-settings.sql, germline-association-schema.sql,
-- snv-disease-pipeline-schema.sql, then paddle-billing.sql afterward.
begin;
do $$ begin
  if to_regclass('public.profiles') is not null or to_regclass('public.prediction_history') is not null then
    raise exception 'Base tables already exist. Skip development-bootstrap.sql; do not overwrite an existing application schema.';
  end if;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
-- Profile policies and the signup trigger are added by profile-settings.sql.

create table public.prediction_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  genome_assembly text not null,
  chromosome text not null,
  variant_position bigint not null,
  prediction text,
  delta_score double precision,
  confidence double precision
);
create index prediction_history_user_date_idx on public.prediction_history(user_id,created_at desc);
alter table public.prediction_history enable row level security;
grant select on public.prediction_history to authenticated;
grant all on public.prediction_history to service_role;
create policy "Users can read own prediction history" on public.prediction_history
  for select to authenticated using (auth.uid()=user_id);
commit;
