begin;

-- 使い方:
-- 1. target_store.store_id を登録先の店舗IDに置き換える
-- 2. 通常メニューと共存できるよう、名称は「ハイシーズン」を含めてあります
-- 3. 年末年始・GW・お盆などの期間限定メニューとして必要なものだけ残して実行してください

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
      ('小型犬 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 6200, 0.100, true, true, true, 300, '繁忙期用: 〜8kg'),
      ('中型犬 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 7900, 0.100, true, true, true, 310, '繁忙期用: 9〜15kg'),
      ('大型犬 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 10200, 0.100, true, true, true, 320, '繁忙期用: 16kg以上'),
      ('猫 ハイシーズン1泊', 'overnight', 'per_night', null, 1.00, 5200, 0.100, true, true, true, 330, '繁忙期用猫ホテル'),
      ('小型犬 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 2800, 0.100, true, true, true, 340, '繁忙期用短時間預かり'),
      ('中型犬 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 3500, 0.100, true, true, true, 350, '繁忙期用短時間預かり'),
      ('大型犬 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 4400, 0.100, true, true, true, 360, '繁忙期用短時間預かり'),
      ('猫 ハイシーズン3時間', 'time_pack', 'fixed', 180, 1.00, 2600, 0.100, true, true, true, 370, '繁忙期用短時間預かり'),
      ('小型犬 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 5000, 0.100, true, true, true, 380, '繁忙期用半日預かり'),
      ('中型犬 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 6400, 0.100, true, true, true, 390, '繁忙期用半日預かり'),
      ('大型犬 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 8200, 0.100, true, true, true, 400, '繁忙期用半日預かり'),
      ('猫 ハイシーズン6時間', 'time_pack', 'fixed', 360, 1.00, 4200, 0.100, true, true, true, 410, '繁忙期用半日預かり'),
      ('ハイシーズン延長1時間', 'option', 'per_hour', 60, 1.00, 1000, 0.100, true, false, true, 420, '繁忙期用延長料金'),
      ('ハイシーズン送迎片道', 'transport', 'per_stay', null, 1.00, 1400, 0.100, true, false, true, 430, '繁忙期用片道送迎'),
      ('ハイシーズン送迎往復', 'transport', 'fixed', null, 1.00, 2800, 0.100, true, false, true, 440, '繁忙期用往復送迎'),
      ('ハイシーズン個室利用', 'option', 'per_night', null, 1.00, 2200, 0.100, true, false, true, 450, '繁忙期用個室オプション'),
      ('ハイシーズン特別ケア', 'option', 'per_stay', null, 1.00, 1320, 0.100, true, false, true, 460, '繁忙期の見守り強化'),
      ('ハイシーズン投薬サポート', 'option', 'per_stay', null, 1.00, 770, 0.100, true, false, true, 470, '繁忙期用投薬対応')
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
