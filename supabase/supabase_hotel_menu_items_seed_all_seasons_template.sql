begin;

-- 使い方:
-- 1. target_store.store_id を登録先の店舗IDに置き換える
-- 2. 通常期は表示順 10-199、ハイシーズンは 300-499 を推奨
-- 3. アプリの「通常メニューON / ハイシーズンON」機能はこの表示順レンジを使って一括切替します

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
      -- 通常期 10-199
      ('小型犬 ホテル1泊', 'overnight', 'per_night', null, 1.00, 5000, 0.100, true, true, true, 10, '通常期: 〜8kg'),
      ('中型犬 ホテル1泊', 'overnight', 'per_night', null, 1.00, 6500, 0.100, true, true, true, 20, '通常期: 9〜15kg'),
      ('大型犬 ホテル1泊', 'overnight', 'per_night', null, 1.00, 8500, 0.100, true, true, true, 30, '通常期: 16kg以上'),
      ('猫 ホテル1泊', 'overnight', 'per_night', null, 1.00, 4200, 0.100, true, true, true, 40, '通常期猫ホテル'),
      ('小型犬 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2200, 0.100, true, true, true, 50, '通常期短時間預かり'),
      ('中型犬 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2800, 0.100, true, true, true, 60, '通常期短時間預かり'),
      ('大型犬 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 3600, 0.100, true, true, true, 70, '通常期短時間預かり'),
      ('猫 日帰り3時間', 'time_pack', 'fixed', 180, 1.00, 2000, 0.100, true, true, true, 80, '通常期短時間預かり'),
      ('小型犬 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 4000, 0.100, true, true, true, 90, '通常期半日預かり'),
      ('中型犬 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 5200, 0.100, true, true, true, 100, '通常期半日預かり'),
      ('大型犬 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 6800, 0.100, true, true, true, 110, '通常期半日預かり'),
      ('猫 日帰り6時間', 'time_pack', 'fixed', 360, 1.00, 3300, 0.100, true, true, true, 120, '通常期半日預かり'),
      ('延長1時間', 'option', 'per_hour', 60, 1.00, 800, 0.100, true, false, true, 130, '通常期共通延長'),
      ('送迎片道', 'transport', 'per_stay', null, 1.00, 1100, 0.100, true, false, true, 140, '通常期片道送迎'),
      ('送迎往復', 'transport', 'fixed', null, 1.00, 2200, 0.100, true, false, true, 150, '通常期往復送迎'),
      ('お散歩追加', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 160, '通常期オプション'),
      ('猫 個室利用', 'option', 'per_night', null, 1.00, 1320, 0.100, true, false, true, 170, '通常期猫個室'),
      ('投薬サポート', 'option', 'per_stay', null, 1.00, 550, 0.100, true, false, true, 180, '通常期投薬'),
      ('シニアケア加算', 'option', 'per_stay', null, 1.00, 1100, 0.100, true, false, true, 190, '通常期見守り強化'),

      -- ハイシーズン 300-499
      ('小型犬 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 6200, 0.100, true, true, false, 300, '繁忙期: 〜8kg'),
      ('中型犬 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 7900, 0.100, true, true, false, 310, '繁忙期: 9〜15kg'),
      ('大型犬 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 10200, 0.100, true, true, false, 320, '繁忙期: 16kg以上'),
      ('猫 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 5200, 0.100, true, true, false, 330, '繁忙期猫ホテル'),
      ('小型犬 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 2800, 0.100, true, true, false, 340, '繁忙期短時間預かり'),
      ('中型犬 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 3500, 0.100, true, true, false, 350, '繁忙期短時間預かり'),
      ('大型犬 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 4400, 0.100, true, true, false, 360, '繁忙期短時間預かり'),
      ('猫 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 2600, 0.100, true, true, false, 370, '繁忙期短時間預かり'),
      ('小型犬 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 5000, 0.100, true, true, false, 380, '繁忙期半日預かり'),
      ('中型犬 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 6400, 0.100, true, true, false, 390, '繁忙期半日預かり'),
      ('大型犬 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 8200, 0.100, true, true, false, 400, '繁忙期半日預かり'),
      ('猫 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 4200, 0.100, true, true, false, 410, '繁忙期半日預かり'),
      ('ハイシーズン延長1時間', 'option', 'per_hour', 60, 1.00, 1000, 0.100, true, false, false, 420, '繁忙期延長'),
      ('ハイシーズン送迎片道', 'transport', 'per_stay', null, 1.00, 1400, 0.100, true, false, false, 430, '繁忙期片道送迎'),
      ('ハイシーズン送迎往復', 'transport', 'fixed', null, 1.00, 2800, 0.100, true, false, false, 440, '繁忙期往復送迎'),
      ('ハイシーズン個室利用', 'option', 'per_night', null, 1.00, 2200, 0.100, true, false, false, 450, '繁忙期個室'),
      ('ハイシーズン特別ケア', 'option', 'per_stay', null, 1.00, 1320, 0.100, true, false, false, 460, '繁忙期見守り強化'),
      ('ハイシーズン投薬サポート', 'option', 'per_stay', null, 1.00, 770, 0.100, true, false, false, 470, '繁忙期投薬'),
      ('ハイシーズン繁忙日追加', 'option', 'per_stay', null, 1.00, 2200, 0.100, true, false, false, 480, '年末年始・GW・お盆の追加料金'),
      ('ハイシーズン猫ストレスケア', 'option', 'per_stay', null, 1.00, 990, 0.100, true, false, false, 490, '繁忙期猫ケア')
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
