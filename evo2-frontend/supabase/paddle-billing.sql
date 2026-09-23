-- Run after the existing profile/history and SNV schema migrations.
-- This migration is for the user's SANDBOX project. It is not run automatically.
-- Never share a Supabase project between live and sandbox deployments.
begin;

create table if not exists public.billing_config (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('sandbox', 'live')),
  price_id text not null,
  product_id text not null
);
insert into public.billing_config values (true, 'sandbox', 'pri_01m2z97w73ff7j0we1nvv89txb', 'pro_01m2z8swqyc7g3v02bx4n8sa5c')
on conflict do nothing;

create table if not exists public.billing_customers (
  user_id uuid not null references auth.users on delete cascade,
  environment text not null check (environment in ('sandbox','live')),
  customer_id text not null,
  primary key (environment, user_id), unique (environment, customer_id)
);
create table if not exists public.subscriptions (
  environment text not null,
  subscription_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  customer_id text not null,
  status text not null,
  price_id text,
  product_id text,
  eligible boolean not null default false,
  period_end timestamptz,
  scheduled_change jsonb,
  provider_updated_at timestamptz not null,
  primary key (environment, subscription_id)
);
create index if not exists subscriptions_user_idx on public.subscriptions(environment,user_id);
create table if not exists public.billing_transactions (
  environment text not null,
  transaction_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  subscription_id text,
  status text not null,
  amount text,
  currency text,
  provider_updated_at timestamptz not null,
  primary key(environment,transaction_id)
);
create table if not exists public.billing_adjustments (
  environment text not null,
  adjustment_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  transaction_id text not null,
  action text not null,
  status text not null,
  amount text,
  provider_updated_at timestamptz not null,
  primary key(environment,adjustment_id)
);
create table if not exists public.billing_events (
  environment text not null,
  event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now(),
  primary key(environment,event_id)
);
create table if not exists public.billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  environment text not null,
  transaction_id text,
  state text not null default 'creating' check(state in ('creating','ready','completed','canceled')),
  created_at timestamptz not null default now()
);
create table if not exists public.billing_reconciliation (
  user_id uuid primary key references auth.users on delete cascade,
  refreshed_at timestamptz not null
);
create unique index if not exists one_open_billing_checkout on public.billing_checkouts(environment,user_id)
where state in ('creating','ready','completed');

create table if not exists public.usage_daily (
  user_id uuid not null references auth.users on delete cascade,
  usage_date date not null,
  consumed integer not null default 0 check(consumed >= 0),
  primary key(user_id,usage_date)
);
create table if not exists public.analysis_reservations (
  user_id uuid not null references auth.users on delete cascade,
  usage_date date not null,
  variant_key text not null,
  reservation_id uuid not null default gen_random_uuid(),
  state text not null check(state in ('reserved','done')),
  reserved_at timestamptz not null default now(),
  primary key(user_id,usage_date,variant_key)
);

-- No browser can write billing or read shared model caches directly.
do $$ declare t text; begin
  foreach t in array array['billing_config','billing_customers','subscriptions','billing_transactions','billing_adjustments','billing_events','billing_checkouts','billing_reconciliation','usage_daily','analysis_reservations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  foreach t in array array['evo2_cache','disease_predictions','clinvar_disease_lookup'] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on public.%I from public, anon, authenticated',t);
      execute format('grant all on public.%I to service_role',t);
    end if;
  end loop;
end $$;

-- Column grants protect both UPDATE and INSERT, including malicious upserts.
revoke insert, update, delete on public.profiles from public, anon, authenticated;
grant update(full_name,display_name,theme_preference,email_notifications,updated_at) on public.profiles to authenticated;
alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
check(subscription_status in ('inactive','demo','active','trialing','past_due','paused','canceled'));
-- Retire demo entitlements once, without resetting real subscriptions on reruns.
update public.profiles set plan_type='student',subscription_status='inactive'
where subscription_status='demo';

create or replace function public.billing_has_access(p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (
    select 1 from subscriptions s join billing_config c on c.environment=s.environment
    where s.user_id=p_user and (auth.role() is distinct from 'authenticated' or p_user=auth.uid()) and s.status='active' and s.eligible
      and s.price_id=c.price_id and s.product_id=c.product_id
      and s.period_end > now()
      and (s.scheduled_change is null or s.scheduled_change->>'action' not in ('cancel','pause')
           or (s.scheduled_change->>'effective_at')::timestamptz > now())
  );
$$;
-- Restrictive policy composes with existing ownership policies, never broadens them.
drop policy if exists billing_history_access on public.prediction_history;
create policy billing_history_access on public.prediction_history as restrictive for select to authenticated
using(user_id=auth.uid() and public.billing_has_access(auth.uid()));
-- History is an authoritative server result, not a client-writable quota ledger.
revoke insert,update,delete on public.prediction_history from public,anon,authenticated;
grant all on public.prediction_history to service_role;

create or replace function public.billing_access(p_user uuid,p_environment text,p_price text,p_product text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s subscriptions; cid text; begin
  if not exists(select 1 from billing_config where environment=p_environment and price_id=p_price and product_id=p_product) then
    raise exception 'billing configuration mismatch';
  end if;
  select * into s from subscriptions where user_id=p_user and environment=p_environment
  order by (status in ('active','trialing','past_due','paused')) desc, provider_updated_at desc limit 1;
  select customer_id into cid from billing_customers where user_id=p_user and environment=p_environment;
  return jsonb_build_object('plan',case when billing_has_access(p_user) then 'researcher' else 'student' end,
    'status',coalesce(s.status,'inactive'),'subscriptionId',s.subscription_id,'customerId',cid,
    'periodEnd',s.period_end,'scheduledChange',s.scheduled_change,'environment',p_environment);
end $$;

create or replace function public.billing_claim_refresh(p_user uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into billing_reconciliation values(p_user,now())
  on conflict(user_id) do update set refreshed_at=excluded.refreshed_at
  where billing_reconciliation.refreshed_at < now()-interval '30 seconds';
  return found;
end $$;

create or replace function public.billing_begin_checkout(p_user uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare attempt billing_checkouts; begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if not exists(select 1 from billing_config where environment=p_environment) then raise exception 'environment mismatch'; end if;
  if exists(select 1 from subscriptions where user_id=p_user and environment=p_environment and status in ('active','trialing','past_due','paused')) then
    return jsonb_build_object('blocked',true);
  end if;
  select * into attempt from billing_checkouts where user_id=p_user and environment=p_environment and state in ('creating','ready','completed') limit 1;
  if found then return to_jsonb(attempt)||jsonb_build_object('new',false); end if;
  insert into billing_checkouts(user_id,environment) values(p_user,p_environment) returning * into attempt;
  return to_jsonb(attempt)||jsonb_build_object('new',true);
end $$;

-- One atomic commit covers deduplication, subscriptions, financial records and profile projection.
create or replace function public.billing_apply_event(p_environment text,p_event_id text,p_event_type text,p_occurred_at timestamptz,
  p_customer_id text,p_subscription jsonb default null,p_transaction jsonb default null,p_adjustment jsonb default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; cfg billing_config; s jsonb:=p_subscription; t jsonb:=p_transaction; a jsonb:=p_adjustment; latest_status text; begin
  select * into cfg from billing_config where environment=p_environment;
  if not found then raise exception 'environment mismatch'; end if;
  select user_id into uid from billing_customers where environment=p_environment and customer_id=p_customer_id;
  if uid is null then raise exception 'unmapped customer'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  insert into billing_events(environment,event_id,event_type,occurred_at) values(p_environment,p_event_id,p_event_type,p_occurred_at) on conflict do nothing;
  if not found then return; end if;
  if s is not null then
    if exists(select 1 from subscriptions where environment=p_environment and subscription_id=s->>'id' and user_id<>uid) then raise exception 'subscription owner mismatch'; end if;
    insert into subscriptions values(p_environment,s->>'id',uid,p_customer_id,s->>'status',s->>'price_id',s->>'product_id',
      coalesce((s->>'eligible')::boolean,false) and s->>'price_id'=cfg.price_id and s->>'product_id'=cfg.product_id,
      (s->>'period_end')::timestamptz,nullif(s->'scheduled_change','null'::jsonb),(s->>'updated_at')::timestamptz)
    on conflict(environment,subscription_id) do update set status=excluded.status,price_id=excluded.price_id,product_id=excluded.product_id,
      eligible=excluded.eligible,period_end=excluded.period_end,scheduled_change=excluded.scheduled_change,provider_updated_at=excluded.provider_updated_at
    where subscriptions.provider_updated_at < excluded.provider_updated_at;
    -- Cancelled subscriptions may start a new checkout; a stale canceled event must not release it.
    if exists(select 1 from subscriptions where environment=p_environment and subscription_id=s->>'id' and status='canceled') then
      update billing_checkouts set state='canceled' where environment=p_environment and user_id=uid and transaction_id in (
        select transaction_id from billing_transactions where environment=p_environment and subscription_id=s->>'id');
    end if;
  end if;
  if t is not null then
    if exists(select 1 from billing_transactions where environment=p_environment and transaction_id=t->>'id' and user_id<>uid) then raise exception 'transaction owner mismatch'; end if;
    insert into billing_transactions values(p_environment,t->>'id',uid,t->>'subscription_id',t->>'status',t->>'amount',t->>'currency',(t->>'updated_at')::timestamptz)
    on conflict(environment,transaction_id) do update set status=excluded.status,subscription_id=excluded.subscription_id,amount=excluded.amount,currency=excluded.currency,provider_updated_at=excluded.provider_updated_at
    where billing_transactions.provider_updated_at < excluded.provider_updated_at;
    update billing_checkouts set transaction_id=t->>'id',state=case when t->>'status'='canceled' then 'canceled' when t->>'status' in ('paid','completed') then 'completed' else 'ready' end
    where environment=p_environment and user_id=uid and (transaction_id=t->>'id' or (id::text=t->>'attempt_id' and transaction_id is null))
      and exists(select 1 from billing_transactions where environment=p_environment and transaction_id=t->>'id' and provider_updated_at=(t->>'updated_at')::timestamptz);
    if exists(select 1 from subscriptions where environment=p_environment and subscription_id=t->>'subscription_id' and status='canceled') then
      update billing_checkouts set state='canceled' where environment=p_environment and transaction_id=t->>'id';
    end if;
  end if;
  if a is not null then
    insert into billing_adjustments values(p_environment,a->>'id',uid,a->>'transaction_id',a->>'action',a->>'status',a->>'amount',(a->>'updated_at')::timestamptz)
    on conflict(environment,adjustment_id) do update set status=excluded.status,amount=excluded.amount,provider_updated_at=excluded.provider_updated_at
    where billing_adjustments.provider_updated_at < excluded.provider_updated_at;
  end if;
  select status into latest_status from subscriptions where environment=p_environment and user_id=uid order by
    (status in ('active','trialing','past_due','paused')) desc,provider_updated_at desc limit 1;
  update profiles set plan_type=case when billing_has_access(uid) then 'researcher' else 'student' end,
    subscription_status=case when latest_status in ('active','trialing','past_due','paused','canceled') then latest_status else 'inactive' end,
    plan_updated_at=now() where id=uid;
end $$;

-- Same normalized variant is counted once per UTC day across all analysis routes.
create or replace function public.reserve_analysis(p_user uuid,p_key text,p_environment text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare day date:=(now() at time zone 'UTC')::date; lim integer; used integer; r analysis_reservations; begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
  if not exists(select 1 from billing_config where environment=p_environment) then raise exception 'environment mismatch'; end if;
  select * into r from analysis_reservations where user_id=p_user and usage_date=day and variant_key=p_key;
  if found then
    if r.state='done' then return jsonb_build_object('reused',true); end if;
    if r.reserved_at > now()-interval '5 minutes' then return jsonb_build_object('busy',true); end if;
    update analysis_reservations set reservation_id=gen_random_uuid(),reserved_at=now() where user_id=p_user and usage_date=day and variant_key=p_key returning * into r;
    return jsonb_build_object('id',r.reservation_id);
  end if;
  lim:=case when billing_has_access(p_user) then 50 else 5 end;
  insert into usage_daily values(p_user,day,0) on conflict do nothing;
  update usage_daily set consumed=consumed+1 where user_id=p_user and usage_date=day and consumed<lim returning consumed into used;
  if not found then return jsonb_build_object('exceeded',true); end if;
  insert into analysis_reservations(user_id,usage_date,variant_key,state) values(p_user,day,p_key,'reserved') returning * into r;
  return jsonb_build_object('id',r.reservation_id);
end $$;
create or replace function public.settle_analysis(p_user uuid,p_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare day date; begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
  if p_success then
    update analysis_reservations set state='done' where user_id=p_user and reservation_id=p_id and state='reserved';
  else
    delete from analysis_reservations where user_id=p_user and reservation_id=p_id and state='reserved' returning usage_date into day;
    if found then update usage_daily set consumed=greatest(0,consumed-1) where user_id=p_user and usage_date=day; end if;
  end if;
end $$;

-- Supabase grants EXECUTE to PUBLIC by default; explicitly restrict every RPC.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('billing_access','billing_begin_checkout','billing_apply_event','billing_claim_refresh','reserve_analysis','settle_analysis','billing_has_access') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant execute on function public.billing_has_access(uuid) to authenticated;
commit;
