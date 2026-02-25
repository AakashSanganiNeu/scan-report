create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_status text not null check (subscription_status in ('trialing','active','expired','canceled')),
  plan_name text null,
  trial_start_at timestamptz null,
  trial_end_at timestamptz null,
  premium_start_at timestamptz null,
  premium_end_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);

create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
create index if not exists idx_hospitals_user_active on public.hospitals(user_id, is_active);

alter table public.scan_catalog add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.scan_catalog add column if not exists display_order integer not null default 0;
alter table public.scan_catalog add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_scan_catalog_user_active_order on public.scan_catalog(user_id, is_active, display_order, name);
create unique index if not exists uniq_scan_catalog_user_name on public.scan_catalog(user_id, name);

alter table public.scan_price_history add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_scan_price_history_user_scan_start on public.scan_price_history(user_id, scan_catalog_id, effective_start_date desc);

alter table public.daily_entries add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.daily_entries add column if not exists hospital_id uuid references public.hospitals(id) on delete restrict;
alter table public.daily_entries add column if not exists calculated_total_revenue numeric(12,2) not null default 0 check (calculated_total_revenue >= 0);
alter table public.daily_entries add column if not exists final_total_revenue numeric(12,2) not null default 0 check (final_total_revenue >= 0);
alter table public.daily_entries add column if not exists is_manual_override boolean not null default false;
alter table public.daily_entries add column if not exists manual_override_reason text null;

update public.daily_entries
set calculated_total_revenue = coalesce(total_revenue, 0),
    final_total_revenue = coalesce(total_revenue, 0)
where calculated_total_revenue = 0 and final_total_revenue = 0 and coalesce(total_revenue, 0) > 0;

alter table public.daily_entries drop constraint if exists daily_entries_entry_date_key;
create unique index if not exists uniq_daily_entries_user_hospital_date on public.daily_entries(user_id, hospital_id, entry_date);
create index if not exists idx_daily_entries_user_hospital_date on public.daily_entries(user_id, hospital_id, entry_date desc);

alter table public.daily_entry_items add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_daily_entry_items_user on public.daily_entry_items(user_id);

alter table public.audit_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.audit_logs add column if not exists hospital_id uuid references public.hospitals(id) on delete set null;
create index if not exists idx_audit_logs_user_created on public.audit_logs(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
drop trigger if exists trg_hospitals_set_updated_at on public.hospitals;
create trigger trg_hospitals_set_updated_at before update on public.hospitals for each row execute function public.set_updated_at();
drop trigger if exists trg_scan_catalog_set_updated_at on public.scan_catalog;
create trigger trg_scan_catalog_set_updated_at before update on public.scan_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_daily_entries_set_updated_at on public.daily_entries;
create trigger trg_daily_entries_set_updated_at before update on public.daily_entries for each row execute function public.set_updated_at();

create or replace function public.evaluate_subscription_status(p_user_id uuid)
returns text
language plpgsql
as $$
declare
  v_sub record;
  v_now timestamptz := now();
  v_status text := 'expired';
begin
  select * into v_sub
  from public.subscriptions
  where user_id = p_user_id
  order by updated_at desc
  limit 1;

  if v_sub is null then
    return 'expired';
  end if;

  if v_sub.subscription_status = 'canceled' then
    v_status := 'canceled';
  elsif v_sub.premium_end_at is not null and v_sub.premium_end_at >= v_now then
    v_status := 'active';
  elsif v_sub.trial_end_at is not null and v_sub.trial_end_at >= v_now then
    v_status := 'trialing';
  else
    v_status := 'expired';
  end if;

  if v_status <> v_sub.subscription_status then
    update public.subscriptions
    set subscription_status = v_status
    where id = v_sub.id;
  end if;

  return v_status;
end;
$$;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.hospitals enable row level security;
alter table public.scan_catalog enable row level security;
alter table public.scan_price_history enable row level security;
alter table public.daily_entries enable row level security;
alter table public.daily_entry_items enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles owner" on public.profiles;
create policy "profiles owner" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "subscriptions owner" on public.subscriptions;
create policy "subscriptions owner" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "hospitals owner" on public.hospitals;
create policy "hospitals owner" on public.hospitals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scan_catalog owner" on public.scan_catalog;
create policy "scan_catalog owner" on public.scan_catalog for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scan_price_history owner" on public.scan_price_history;
create policy "scan_price_history owner" on public.scan_price_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_entries owner" on public.daily_entries;
create policy "daily_entries owner" on public.daily_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_entry_items owner" on public.daily_entry_items;
create policy "daily_entry_items owner" on public.daily_entry_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "audit_logs owner" on public.audit_logs;
create policy "audit_logs owner" on public.audit_logs for select using (auth.uid() = user_id);
create policy "audit_logs owner insert" on public.audit_logs for insert with check (auth.uid() = user_id);
