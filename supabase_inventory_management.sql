-- =========================================================
-- Groomer App: Inventory management schema + RLS
-- =========================================================
-- Prerequisite:
-- - Apply supabase_multistore_migration.sql
-- - Apply supabase_multistore_rls.sql
-- =========================================================

begin;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text,
  unit text not null default '個',
  supplier_name text,
  jan_code text,
  optimal_stock numeric not null default 0,
  is_active boolean not null default true,
  notes text
);

create unique index if not exists uq_inventory_items_store_name
  on public.inventory_items(store_id, name);

create index if not exists idx_inventory_items_store_id
  on public.inventory_items(store_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('inbound', 'outbound', 'stocktake_adjustment')),
  reason text,
  quantity_delta numeric not null,
  unit_cost numeric,
  lot_number text,
  expires_on date,
  happened_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id)
);

create index if not exists idx_inventory_movements_store_id
  on public.inventory_movements(store_id);

create index if not exists idx_inventory_movements_store_item
  on public.inventory_movements(store_id, item_id);

create index if not exists idx_inventory_movements_store_happened
  on public.inventory_movements(store_id, happened_at desc);

create table if not exists public.inventory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_no text not null,
  supplier_name text not null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'canceled')),
  ordered_on date,
  expected_on date,
  total_amount numeric not null default 0,
  notes text
);

create unique index if not exists uq_inventory_purchase_orders_store_order_no
  on public.inventory_purchase_orders(store_id, order_no);

create index if not exists idx_inventory_purchase_orders_store_id
  on public.inventory_purchase_orders(store_id);

create table if not exists public.inventory_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  purchase_order_id uuid not null references public.inventory_purchase_orders(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  notes text
);

create index if not exists idx_inventory_purchase_order_items_store_id
  on public.inventory_purchase_order_items(store_id);

create index if not exists idx_inventory_purchase_order_items_order_id
  on public.inventory_purchase_order_items(purchase_order_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'inventory_items',
    'inventory_movements',
    'inventory_purchase_orders',
    'inventory_purchase_order_items'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t || '_select_store', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (store_id in (select public.current_user_store_ids()));',
      t || '_select_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_insert_store', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (store_id in (select public.current_user_store_ids()));',
      t || '_insert_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_update_store', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (store_id in (select public.current_user_store_ids())) with check (store_id in (select public.current_user_store_ids()));',
      t || '_update_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_delete_store', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (store_id in (select public.current_user_store_ids()));',
      t || '_delete_store',
      t
    );
  end loop;
end $$;

commit;
