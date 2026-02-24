insert into public.scan_catalog (name, modality, is_active)
values
  ('Abdomen Pelvis', 'Ultrasound', true),
  ('TVS', 'Ultrasound', true),
  ('Growth Scan', 'Ultrasound', true),
  ('Obs Doppler', 'Ultrasound', true),
  ('Obs BPP', 'Ultrasound', true),
  ('Color Doppler (1 leg arterial/venous)', 'Ultrasound', true),
  ('TIFFA', 'Ultrasound', true),
  ('NT Scan', 'Ultrasound', true),
  ('Early Pregnancy', 'Ultrasound', true),
  ('Small Parts (Swelling)', 'Ultrasound', true),
  ('Follicular Study (3 visits)', 'Ultrasound', true)
on conflict (name) do update
set
  modality = excluded.modality,
  is_active = excluded.is_active;

insert into public.scan_price_history (scan_catalog_id, price, effective_start_date, reason)
select sc.id, seed.price, date '2025-01-01', 'Initial seeded price'
from public.scan_catalog sc
join (
  values
    ('Abdomen Pelvis', 1200::numeric),
    ('TVS', 1200::numeric),
    ('Growth Scan', 1000::numeric),
    ('Obs Doppler', 2000::numeric),
    ('Obs BPP', 2000::numeric),
    ('Color Doppler (1 leg arterial/venous)', 4000::numeric),
    ('TIFFA', 2500::numeric),
    ('NT Scan', 1800::numeric),
    ('Early Pregnancy', 1000::numeric),
    ('Small Parts (Swelling)', 1500::numeric),
    ('Follicular Study (3 visits)', 1800::numeric)
) as seed(name, price)
  on sc.name = seed.name
on conflict (scan_catalog_id, effective_start_date)
do update set
  price = excluded.price,
  reason = excluded.reason,
  created_at = now();
