-- Apply after the core profile and prediction-history schemas.
-- This keeps analysis quotas server-controlled while checkout is disabled.

create table if not exists public.free_usage_daily (
  user_id uuid not null references auth.users on delete cascade,
  usage_date date not null,
  consumed integer not null default 0 check (consumed >= 0),
  primary key (user_id, usage_date)
);

create table if not exists public.free_analysis_reservations (
  user_id uuid not null references auth.users on delete cascade,
  usage_date date not null,
  variant_key text not null,
  reservation_id uuid not null default gen_random_uuid(),
  state text not null check (state in ('reserved', 'done')),
  reserved_at timestamptz not null default now(),
  primary key (user_id, usage_date, variant_key)
);

alter table public.free_usage_daily enable row level security;
alter table public.free_analysis_reservations enable row level security;
revoke all on public.free_usage_daily from public, anon, authenticated;
revoke all on public.free_analysis_reservations from public, anon, authenticated;
grant all on public.free_usage_daily to service_role;
grant all on public.free_analysis_reservations to service_role;

-- Remove the paid-subscription restriction if the old billing migration ran.
drop policy if exists billing_history_access on public.prediction_history;

-- Model caches and authoritative prediction history are server-managed.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'evo2_cache',
    'disease_predictions',
    'clinvar_disease_lookup',
    'prediction_history'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'revoke insert, update, delete on public.%I from public, anon, authenticated',
        table_name
      );
      execute format('grant all on public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

create or replace function public.reserve_free_analysis(
  p_user uuid,
  p_key text,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  day date := (now() at time zone 'UTC')::date;
  used integer;
  reservation public.free_analysis_reservations;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid usage limit';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));

  select * into reservation
  from public.free_analysis_reservations
  where user_id = p_user and usage_date = day and variant_key = p_key;

  if found then
    if reservation.state = 'done' then
      return jsonb_build_object('reused', true);
    end if;
    if reservation.reserved_at > now() - interval '5 minutes' then
      return jsonb_build_object('busy', true);
    end if;
    update public.free_analysis_reservations
      set reservation_id = gen_random_uuid(), reserved_at = now()
      where user_id = p_user and usage_date = day and variant_key = p_key
      returning * into reservation;
    return jsonb_build_object('id', reservation.reservation_id);
  end if;

  insert into public.free_usage_daily values (p_user, day, 0)
  on conflict do nothing;
  update public.free_usage_daily
    set consumed = consumed + 1
    where user_id = p_user and usage_date = day and consumed < p_limit
    returning consumed into used;
  if not found then
    return jsonb_build_object('exceeded', true);
  end if;

  insert into public.free_analysis_reservations
    (user_id, usage_date, variant_key, state)
    values (p_user, day, p_key, 'reserved')
    returning * into reservation;
  return jsonb_build_object('id', reservation.reservation_id);
end;
$$;

create or replace function public.settle_free_analysis(
  p_user uuid,
  p_id uuid,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  day date;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  if p_success then
    update public.free_analysis_reservations
      set state = 'done'
      where user_id = p_user and reservation_id = p_id and state = 'reserved';
  else
    delete from public.free_analysis_reservations
      where user_id = p_user and reservation_id = p_id and state = 'reserved'
      returning usage_date into day;
    if found then
      update public.free_usage_daily
        set consumed = greatest(0, consumed - 1)
        where user_id = p_user and usage_date = day;
    end if;
  end if;
end;
$$;

revoke all on function public.reserve_free_analysis(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.settle_free_analysis(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_free_analysis(uuid, text, integer)
  to service_role;
grant execute on function public.settle_free_analysis(uuid, uuid, boolean)
  to service_role;
