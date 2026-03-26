-- =========================================================
-- Groomer App: POS core schema + RLS
-- Task: TASK-POS-002
-- =========================================================
-- Prerequisite:
-- - Apply supabase_multistore_migration.sql
-- - Apply supabase_multistore_rls.sql
-- - Apply supabase_inventory_management.sql
-- - Apply supabase_invoices_unified_checkout.sql
-- =========================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.pos_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by_user_id uuid references auth.users(id) on delete set null,
  closed_by_user_id uuid references auth.users(id) on delete set null,
  notes text,
  check (
    (status = 'open' and closed_at is null and closed_by_user_id is null)
    or (status = 'closed' and closed_at is not null)
  )
);

create index if not exists idx_pos_sessions_store_opened_at
  on public.pos_sessions(store_id, opened_at desc);

create index if not exists idx_pos_sessions_store_status
  on public.pos_sessions(store_id, status, opened_at desc);

create table if not exists public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id uuid references public.pos_sessions(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'void', 'refunded')),
  subtotal_amount numeric not null default 0 check (subtotal_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  confirmed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  paid_at timestamptz,
  payment_id uuid references public.payments(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  check (
    (status <> 'void')
    or (status = 'void' and voided_at is not null and coalesce(length(trim(void_reason)), 0) > 0)
  )
);

create index if not exists idx_pos_orders_store_created_at
  on public.pos_orders(store_id, created_at desc);

create index if not exists idx_pos_orders_store_status
  on public.pos_orders(store_id, status, created_at desc);

create index if not exists idx_pos_orders_store_session
  on public.pos_orders(store_id, session_id, created_at desc);

create index if not exists idx_pos_orders_store_customer
  on public.pos_orders(store_id, customer_id, created_at desc);

create index if not exists idx_pos_orders_store_appointment
  on public.pos_orders(store_id, appointment_id, created_at desc);

create index if not exists idx_inventory_movements_store_notes
  on public.inventory_movements(store_id, notes);

create table if not exists public.pos_order_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.pos_orders(id) on delete cascade,
  line_type text not null check (line_type in ('service', 'product', 'manual_adjustment')),
  source_id uuid,
  label text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_amount numeric not null default 0 check (unit_amount >= 0),
  tax_rate numeric not null default 0.1 check (tax_rate >= 0 and tax_rate <= 1),
  tax_included boolean not null default true,
  line_subtotal numeric not null default 0 check (line_subtotal >= 0),
  line_tax numeric not null default 0 check (line_tax >= 0),
  line_total numeric not null default 0 check (line_total >= 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_pos_order_lines_store_order
  on public.pos_order_lines(store_id, order_id, sort_order asc, created_at asc);

create index if not exists idx_pos_order_lines_store_type
  on public.pos_order_lines(store_id, line_type, created_at desc);

create table if not exists public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.pos_orders(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  method text not null,
  action_type text not null default 'confirm' check (action_type in ('confirm', 'void', 'refund')),
  idempotency_key text not null,
  notes text,
  paid_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null
);

create unique index if not exists uq_pos_payments_store_action_idempotency
  on public.pos_payments(store_id, action_type, idempotency_key);

create unique index if not exists uq_pos_payments_order_payment
  on public.pos_payments(order_id, payment_id);

create unique index if not exists uq_pos_payments_order_confirm
  on public.pos_payments(order_id)
  where action_type = 'confirm';

create index if not exists idx_pos_payments_store_paid_at
  on public.pos_payments(store_id, paid_at desc);

create table if not exists public.pos_refunds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.pos_orders(id) on delete cascade,
  refund_type text not null check (refund_type in ('void', 'refund')),
  amount numeric not null default 0 check (amount >= 0),
  reason text not null,
  refunded_at timestamptz not null default now(),
  refunded_by_user_id uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists idx_pos_refunds_store_refunded_at
  on public.pos_refunds(store_id, refunded_at desc);

create unique index if not exists uq_pos_refunds_order_void_once
  on public.pos_refunds(order_id)
  where refund_type = 'void';

create table if not exists public.cash_drawer_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id uuid not null references public.pos_sessions(id) on delete cascade,
  event_type text not null check (event_type in ('cash_in', 'cash_out', 'adjustment')),
  amount numeric not null default 0 check (amount >= 0),
  reason text,
  happened_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists idx_cash_drawer_events_store_happened_at
  on public.cash_drawer_events(store_id, happened_at desc);

create index if not exists idx_cash_drawer_events_store_session
  on public.cash_drawer_events(store_id, session_id, happened_at desc);

alter table public.invoice_lines
  drop constraint if exists invoice_lines_source_type_check;

alter table public.invoice_lines
  add constraint invoice_lines_source_type_check
  check (source_type in ('appointment_menu', 'hotel_stay_item', 'manual_adjustment', 'pos_product'));

do $$
declare
  t text;
begin
  foreach t in array array[
    'pos_sessions',
    'pos_orders',
    'pos_order_lines',
    'pos_payments',
    'pos_refunds',
    'cash_drawer_events'
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
