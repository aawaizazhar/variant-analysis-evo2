alter table public.profiles
  add column if not exists full_name text,
  add column if not exists display_name text,
  add column if not exists theme_preference text not null default 'system',
  add column if not exists email_notifications boolean not null default true,
  add column if not exists plan_type text not null default 'student',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists plan_updated_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz;

update public.profiles
set plan_type = 'student'
where plan_type is null
  or plan_type not in ('student', 'researcher');

update public.profiles
set subscription_status = case
    when plan_type = 'researcher' then 'demo'
    else 'inactive'
  end
where subscription_status is null
  or subscription_status not in ('inactive', 'demo');

update public.profiles
set plan_updated_at = now()
where plan_updated_at is null;

alter table public.profiles
  alter column plan_type set default 'student',
  alter column plan_type set not null,
  alter column subscription_status set default 'inactive',
  alter column subscription_status set not null,
  alter column plan_updated_at set default now(),
  alter column plan_updated_at set not null;

alter table public.profiles
  drop constraint if exists profiles_plan_type_check,
  add constraint profiles_plan_type_check
    check (plan_type in ('student', 'researcher'));

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check,
  add constraint profiles_subscription_status_check
    check (subscription_status in ('inactive', 'demo'));

insert into public.profiles (id, plan_type, subscription_status, plan_updated_at)
select users.id, 'student', 'inactive', now()
from auth.users as users
where not exists (
  select 1
  from public.profiles as profiles
  where profiles.id = users.id
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    plan_type,
    subscription_status,
    plan_updated_at
  )
  values (new.id, 'student', 'inactive', now())
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own profile settings" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;

create policy "Users can read their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update their own profile settings"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can create their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Authentication creates profiles through the trigger. Browser users may only
-- change presentation preferences, never entitlement columns.
revoke insert, update, delete on public.profiles from public, anon, authenticated;
grant update(full_name, display_name, theme_preference, email_notifications, updated_at)
  on public.profiles to authenticated;
