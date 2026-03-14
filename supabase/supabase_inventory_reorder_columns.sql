begin;

-- =========================================================
-- Groomer App: Inventory reorder planning columns
-- =========================================================
-- Purpose:
-- - Extend inventory_items so reorder suggestions can be generated
--   without introducing a supplier master in the first iteration.
-- =========================================================

alter table public.inventory_items
  add column if not exists reorder_point numeric not null default 0,
  add column if not exists lead_time_days integer not null default 0,
  add column if not exists preferred_supplier_name text,
  add column if not exists minimum_order_quantity numeric not null default 0,
  add column if not exists order_lot_size numeric not null default 0;

comment on column public.inventory_items.reorder_point is
  '発注を起こす閾値。在庫がこの値以下なら発注提案対象にする。';

comment on column public.inventory_items.lead_time_days is
  '標準リードタイム日数。初回は表示/優先度用。';

comment on column public.inventory_items.preferred_supplier_name is
  '推奨仕入先名。未設定時は supplier_name を使う。';

comment on column public.inventory_items.minimum_order_quantity is
  '最小発注数。推奨発注数がこれ未満ならこの値に切り上げる。';

comment on column public.inventory_items.order_lot_size is
  '発注ロット単位。6本単位などの丸めに使う。';

create index if not exists idx_inventory_items_store_reorder_point
  on public.inventory_items(store_id, reorder_point);

commit;
