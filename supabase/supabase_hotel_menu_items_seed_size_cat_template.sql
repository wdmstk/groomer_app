begin;

-- 使い方:
-- 1. target_store.store_id を登録先の店舗IDに置き換える
-- 2. 不要な行は values から削除する
-- 3. 価格は店舗運用に合わせて調整する

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
      ('小型犬 ホテル1泊', 'overnight', 'per_night', null, 1.00, 5000, 0.100, true, true, true, 10, '目安: 〜8kg'),
      ('中型犬 ホテル1泊', 'overnight', 'per_night', null, 1.00, 6500, 0.100, true, true, true, 20, '目安: 9〜15kg'),
      ('大型犬 ホテル1泊', 'overnight', 'per_night', null, 1.00, 8500, 0.100, true, true, true, 30, '目安: 16kg以上'),
      ('小型犬 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2200, 0.100, true, true, true, 40, '短時間預かり'),
      ('中型犬 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2800, 0.100, true, true, true, 50, '短時間預かり'),
      ('大型犬 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 3600, 0.100, true, true, true, 60, '短時間預かり'),
      ('小型犬 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 4000, 0.100, true, true, true, 70, '半日預かり'),
      ('中型犬 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 5200, 0.100, true, true, true, 80, '半日預かり'),
      ('大型犬 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 6800, 0.100, true, true, true, 90, '半日預かり'),
      ('小型犬 日帰り12時間', 'time_pack', 'fixed', 720, 1.00, 6200, 0.100, true, true, true, 100, '長時間預かり'),
      ('中型犬 日帰り12時間', 'time_pack', 'fixed', 720, 1.00, 7600, 0.100, true, true, true, 110, '長時間預かり'),
      ('大型犬 日帰り12時間', 'time_pack', 'fixed', 720, 1.00, 9800, 0.100, true, true, true, 120, '長時間預かり'),
      ('猫ホテル1泊', 'overnight', 'per_night', null, 1.00, 4200, 0.100, true, true, true, 130, '一般的な猫用宿泊'),
      ('猫 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2000, 0.100, true, true, true, 140, '猫用短時間預かり'),
      ('猫 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 3300, 0.100, true, true, true, 150, '猫用半日預かり'),
      ('猫 個室利用', 'option', 'per_night', null, 1.00, 1320, 0.100, true, false, true, 160, '猫用個室・上下運動ケージ'),
      ('猫 ストレスケア加算', 'option', 'per_stay', null, 1.00, 880, 0.100, true, false, true, 170, '神経質な子向けの見守り強化'),
      ('延長1時間', 'option', 'per_hour', 60, 1.00, 800, 0.100, true, false, true, 180, '共通延長料金'),
      ('送迎片道', 'transport', 'per_stay', null, 1.00, 1100, 0.100, true, false, true, 190, '片道送迎'),
      ('送迎往復', 'transport', 'fixed', null, 1.00, 2200, 0.100, true, false, true, 200, '往復送迎'),
      ('お散歩追加', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 210, '追加散歩'),
      ('投薬サポート', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 220, '投薬対応'),
      ('シニアケア加算', 'option', 'per_stay', null, 1.00, 1100, 0.100, true, false, true, 230, '見守り強化'),
      ('繁忙期加算', 'option', 'per_stay', null, 1.00, 2200, 0.100, true, false, true, 240, '年末年始・GWなど'),
      ('特別ケアメモ対応', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 250, '個別ケア指示が多い場合')
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
