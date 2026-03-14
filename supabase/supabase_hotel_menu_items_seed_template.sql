begin;

-- 使い方:
-- 1. target_store.store_id を登録したい店舗IDに置き換える
-- 2. 必要に応じて価格や表示順を調整して実行する

with target_store as (
  select '00000000-0000-0000-0000-000000000000'::uuid as store_id
),
seed_rows as (
  select
    name,
    item_type,
    billing_unit,
    duration_minutes,
    default_quantity,
    price,
    tax_rate,
    tax_included,
    counts_toward_capacity,
    is_active,
    display_order,
    notes
  from (
    values
      ('ホテル1泊', 'overnight', 'per_night', null, 1.00, 5500, 0.100, true, true, true, 10, '標準的な1泊料金'),
      ('日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2500, 0.100, true, true, true, 20, '短時間預かりの基本プラン'),
      ('日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 4500, 0.100, true, true, true, 30, '半日預かりの基本プラン'),
      ('日帰り12時間', 'time_pack', 'fixed', 720, 1.00, 7000, 0.100, true, true, true, 40, '長時間預かりプラン'),
      ('延長1時間', 'option', 'per_hour', 60, 1.00, 800, 0.100, true, false, true, 50, '時間預かりの延長用'),
      ('送迎片道', 'transport', 'per_stay', null, 1.00, 1100, 0.100, true, false, true, 60, '片道送迎料金'),
      ('送迎往復', 'transport', 'fixed', null, 1.00, 2200, 0.100, true, false, true, 70, '往復送迎料金'),
      ('お散歩追加', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 80, '通常回数に追加する散歩'),
      ('個室利用', 'option', 'per_night', null, 1.00, 1650, 0.100, true, false, true, 90, '個室・静養室利用オプション'),
      ('投薬サポート', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 100, '投薬対応が必要な場合'),
      ('シニアケア加算', 'option', 'per_stay', null, 1.00, 1100, 0.100, true, false, true, 110, '高齢犬猫の見守り強化'),
      ('繁忙期加算', 'option', 'per_stay', null, 1.00, 2200, 0.100, true, false, true, 120, '年末年始・GWなどの加算'),
      ('特別ケアメモ対応', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 130, '細かなケア依頼がある場合')
  ) as v(
    name,
    item_type,
    billing_unit,
    duration_minutes,
    default_quantity,
    price,
    tax_rate,
    tax_included,
    counts_toward_capacity,
    is_active,
    display_order,
    notes
  )
)
insert into public.hotel_menu_items (
  store_id,
  name,
  item_type,
  billing_unit,
  duration_minutes,
  default_quantity,
  price,
  tax_rate,
  tax_included,
  counts_toward_capacity,
  is_active,
  display_order,
  notes
)
select
  target_store.store_id,
  seed_rows.name,
  seed_rows.item_type,
  seed_rows.billing_unit,
  seed_rows.duration_minutes,
  seed_rows.default_quantity,
  seed_rows.price,
  seed_rows.tax_rate,
  seed_rows.tax_included,
  seed_rows.counts_toward_capacity,
  seed_rows.is_active,
  seed_rows.display_order,
  seed_rows.notes
from target_store
cross join seed_rows
where not exists (
  select 1
  from public.hotel_menu_items existing
  where existing.store_id = target_store.store_id
    and lower(trim(existing.name)) = lower(trim(seed_rows.name))
    and existing.item_type = seed_rows.item_type
);

commit;
