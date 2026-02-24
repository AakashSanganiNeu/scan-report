create extension if not exists pgcrypto;

create table if not exists public.scan_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  modality text not null default 'Ultrasound',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.scan_catalog drop column if exists price;

create table if not exists public.scan_price_history (
  id uuid primary key default gen_random_uuid(),
  scan_catalog_id uuid not null references public.scan_catalog(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  effective_start_date date not null,
  reason text null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  unique (scan_catalog_id, effective_start_date)
);

create index if not exists idx_scan_price_history_scan_start_desc
  on public.scan_price_history (scan_catalog_id, effective_start_date desc);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null unique,
  notes text null,
  total_scans integer not null default 0 check (total_scans >= 0),
  total_revenue numeric(12,2) not null default 0 check (total_revenue >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create table if not exists public.daily_entry_items (
  id uuid primary key default gen_random_uuid(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  scan_catalog_id uuid not null references public.scan_catalog(id),
  quantity integer not null default 0 check (quantity >= 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique (daily_entry_id, scan_catalog_id)
);

create index if not exists idx_daily_entries_entry_date on public.daily_entries(entry_date);
create index if not exists idx_daily_entry_items_daily_entry_id on public.daily_entry_items(daily_entry_id);
create index if not exists idx_daily_entry_items_scan_catalog_id on public.daily_entry_items(scan_catalog_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid null,
  entity_label text null,
  action text not null,
  change_summary text null,
  before_data jsonb null,
  after_data jsonb null,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists idx_audit_logs_created_at_desc on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_entity_type on public.audit_logs(entity_type);
create index if not exists idx_audit_logs_action on public.audit_logs(action);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_daily_entries_set_updated_at on public.daily_entries;
create trigger trg_daily_entries_set_updated_at
before update on public.daily_entries
for each row execute function public.set_updated_at();

create or replace function public.resolve_effective_price(
  p_scan_catalog_id uuid,
  p_entry_date date
)
returns numeric as $$
  select sph.price
  from public.scan_price_history sph
  where sph.scan_catalog_id = p_scan_catalog_id
    and sph.effective_start_date <= p_entry_date
  order by sph.effective_start_date desc, sph.created_at desc
  limit 1;
$$ language sql stable;

create or replace function public.save_daily_entry_with_items(
  p_entry_date date,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_entry_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_item jsonb;
  v_scan_catalog_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_total_scans integer := 0;
  v_total_revenue numeric(12,2) := 0;
  v_is_update boolean := false;
begin
  if p_entry_date is null then
    raise exception 'entry_date is required';
  end if;

  select de.id into v_entry_id
  from public.daily_entries de
  where de.entry_date = p_entry_date;

  if v_entry_id is not null then
    v_is_update := true;

    select jsonb_build_object(
      'entry', to_jsonb(de),
      'items', coalesce(jsonb_agg(to_jsonb(dei)), '[]'::jsonb)
    )
    into v_before
    from public.daily_entries de
    left join public.daily_entry_items dei on dei.daily_entry_id = de.id
    where de.id = v_entry_id
    group by de.id;

    update public.daily_entries
    set notes = p_notes
    where id = v_entry_id;

    delete from public.daily_entry_items
    where daily_entry_id = v_entry_id;
  else
    insert into public.daily_entries (entry_date, notes)
    values (p_entry_date, p_notes)
    returning id into v_entry_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_scan_catalog_id := (v_item ->> 'scan_catalog_id')::uuid;
    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 0), 0);

    if v_scan_catalog_id is null then
      continue;
    end if;

    select coalesce(public.resolve_effective_price(v_scan_catalog_id, p_entry_date), 0)
      into v_unit_price;

    v_line_total := round(v_quantity::numeric * v_unit_price, 2);

    insert into public.daily_entry_items (
      daily_entry_id,
      scan_catalog_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_entry_id,
      v_scan_catalog_id,
      v_quantity,
      v_unit_price,
      v_line_total
    )
    on conflict (daily_entry_id, scan_catalog_id)
    do update set
      quantity = excluded.quantity,
      unit_price = excluded.unit_price,
      line_total = excluded.line_total;

    v_total_scans := v_total_scans + v_quantity;
    v_total_revenue := v_total_revenue + v_line_total;
  end loop;

  update public.daily_entries
  set
    notes = p_notes,
    total_scans = v_total_scans,
    total_revenue = v_total_revenue
  where id = v_entry_id;

  select jsonb_build_object(
    'entry', to_jsonb(de),
    'items', coalesce(jsonb_agg(to_jsonb(dei)), '[]'::jsonb)
  )
  into v_after
  from public.daily_entries de
  left join public.daily_entry_items dei on dei.daily_entry_id = de.id
  where de.id = v_entry_id
  group by de.id;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    entity_label,
    action,
    change_summary,
    before_data,
    after_data
  )
  values (
    'daily_entry',
    v_entry_id,
    p_entry_date::text,
    case when v_is_update then 'UPDATE' else 'CREATE' end,
    case when v_is_update then 'Updated daily entry for ' || p_entry_date::text else 'Created daily entry for ' || p_entry_date::text end,
    v_before,
    v_after
  );

  return v_entry_id;
end;
$$;

create or replace function public.delete_daily_entry_with_audit(
  p_daily_entry_id uuid
)
returns void
language plpgsql
as $$
declare
  v_before jsonb;
  v_entry_date date;
begin
  if p_daily_entry_id is null then
    raise exception 'daily_entry_id is required';
  end if;

  select de.entry_date into v_entry_date
  from public.daily_entries de
  where de.id = p_daily_entry_id;

  if v_entry_date is null then
    return;
  end if;

  select jsonb_build_object(
    'entry', to_jsonb(de),
    'items', coalesce(jsonb_agg(to_jsonb(dei)), '[]'::jsonb)
  )
  into v_before
  from public.daily_entries de
  left join public.daily_entry_items dei on dei.daily_entry_id = de.id
  where de.id = p_daily_entry_id
  group by de.id;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    entity_label,
    action,
    change_summary,
    before_data,
    after_data
  )
  values (
    'daily_entry',
    p_daily_entry_id,
    v_entry_date::text,
    'DELETE',
    'Deleted daily entry for ' || v_entry_date::text,
    v_before,
    null
  );

  delete from public.daily_entries where id = p_daily_entry_id;
end;
$$;

create or replace function public.add_scan_price_with_audit(
  p_scan_catalog_id uuid,
  p_price numeric,
  p_effective_start_date date,
  p_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  v_existing_id uuid;
  v_price_id uuid;
  v_scan_name text;
  v_prev_price numeric(12,2);
  v_action text;
begin
  if p_scan_catalog_id is null then
    raise exception 'scan_catalog_id is required';
  end if;
  if p_effective_start_date is null then
    raise exception 'effective_start_date is required';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'price must be >= 0';
  end if;

  select name into v_scan_name
  from public.scan_catalog
  where id = p_scan_catalog_id;

  if v_scan_name is null then
    raise exception 'scan_catalog not found';
  end if;

  select id into v_existing_id
  from public.scan_price_history
  where scan_catalog_id = p_scan_catalog_id
    and effective_start_date = p_effective_start_date;

  select sph.price into v_prev_price
  from public.scan_price_history sph
  where sph.scan_catalog_id = p_scan_catalog_id
  order by sph.effective_start_date desc, sph.created_at desc
  limit 1;

  insert into public.scan_price_history (
    scan_catalog_id,
    price,
    effective_start_date,
    reason
  )
  values (
    p_scan_catalog_id,
    round(p_price, 2),
    p_effective_start_date,
    p_reason
  )
  on conflict (scan_catalog_id, effective_start_date)
  do update set
    price = excluded.price,
    reason = excluded.reason,
    created_at = now()
  returning id into v_price_id;

  v_action := case when v_existing_id is null then 'CREATE' else 'UPDATE' end;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    entity_label,
    action,
    change_summary,
    before_data,
    after_data
  )
  values (
    'price',
    v_price_id,
    v_scan_name,
    v_action,
    format(
      '%s price %s: %s -> %s effective %s',
      v_scan_name,
      lower(v_action),
      coalesce(v_prev_price::text, 'null'),
      round(p_price, 2)::text,
      p_effective_start_date::text
    ),
    jsonb_build_object('previous_price', v_prev_price),
    jsonb_build_object(
      'price', round(p_price, 2),
      'effective_start_date', p_effective_start_date,
      'reason', p_reason
    )
  );

  return v_price_id;
end;
$$;

create or replace view public.current_effective_prices as
select distinct on (sc.id)
  sc.id as scan_catalog_id,
  sc.name as scan_name,
  sph.price,
  sph.effective_start_date
from public.scan_catalog sc
join public.scan_price_history sph on sph.scan_catalog_id = sc.id
where sc.is_active = true
  and sph.effective_start_date <= current_date
order by sc.id, sph.effective_start_date desc, sph.created_at desc;

create or replace view public.monthly_summary_by_scan_type as
select
  date_trunc('month', de.entry_date)::date as entry_month,
  dei.scan_catalog_id,
  sc.name as scan_name,
  sum(dei.quantity)::integer as total_quantity,
  sum(dei.line_total)::numeric(12,2) as total_revenue
from public.daily_entry_items dei
join public.daily_entries de on de.id = dei.daily_entry_id
join public.scan_catalog sc on sc.id = dei.scan_catalog_id
group by 1, 2, 3;

alter table public.scan_catalog enable row level security;
alter table public.scan_price_history enable row level security;
alter table public.daily_entries enable row level security;
alter table public.daily_entry_items enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists p_scan_catalog_all on public.scan_catalog;
create policy p_scan_catalog_all on public.scan_catalog for all using (true) with check (true);

drop policy if exists p_scan_price_history_all on public.scan_price_history;
create policy p_scan_price_history_all on public.scan_price_history for all using (true) with check (true);

drop policy if exists p_daily_entries_all on public.daily_entries;
create policy p_daily_entries_all on public.daily_entries for all using (true) with check (true);

drop policy if exists p_daily_entry_items_all on public.daily_entry_items;
create policy p_daily_entry_items_all on public.daily_entry_items for all using (true) with check (true);

drop policy if exists p_audit_logs_all on public.audit_logs;
create policy p_audit_logs_all on public.audit_logs for all using (true) with check (true);
