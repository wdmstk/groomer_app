-- Unified checkout foundation for appointments + hotel stays
-- Task: TASK-401

create extension if not exists pgcrypto;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void')),
  currency text not null default 'JPY',
  subtotal_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  total_amount numeric not null default 0,
  paid_at timestamptz,
  closed_at timestamptz,
  legacy_payment_id uuid unique,
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_invoices_store_created_at on public.invoices(store_id, created_at desc);
create index if not exists idx_invoices_store_customer on public.invoices(store_id, customer_id, created_at desc);
create index if not exists idx_invoices_store_status on public.invoices(store_id, status, created_at desc);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  source_type text not null check (source_type in ('appointment_menu', 'hotel_stay_item', 'manual_adjustment')),
  source_id uuid,
  label text not null,
  quantity numeric not null default 1,
  unit_amount numeric not null default 0,
  tax_rate numeric,
  tax_included boolean,
  line_subtotal numeric not null default 0,
  line_tax numeric not null default 0,
  line_total numeric not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id, sort_order asc, created_at asc);
create index if not exists idx_invoice_lines_store_invoice on public.invoice_lines(store_id, invoice_id);
create unique index if not exists uniq_invoice_lines_invoice_source
  on public.invoice_lines(invoice_id, source_type, source_id)
  where source_id is not null;

alter table public.payments
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists idx_payments_store_invoice on public.payments(store_id, invoice_id);

alter table public.hotel_stays
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists idx_hotel_stays_store_invoice on public.hotel_stays(store_id, invoice_id);

-- Backfill legacy payments into invoices (1 payment = 1 invoice)
insert into public.invoices (
  id,
  created_at,
  updated_at,
  store_id,
  customer_id,
  status,
  currency,
  subtotal_amount,
  tax_amount,
  discount_amount,
  total_amount,
  paid_at,
  closed_at,
  legacy_payment_id,
  notes
)
select
  gen_random_uuid(),
  p.created_at,
  coalesce(p.updated_at, p.created_at, now()),
  p.store_id,
  p.customer_id,
  case when p.paid_at is null then 'open' else 'paid' end,
  'JPY',
  coalesce(p.subtotal_amount, 0),
  coalesce(p.tax_amount, 0),
  coalesce(p.discount_amount, 0),
  coalesce(p.total_amount, 0),
  p.paid_at,
  p.paid_at,
  p.id,
  p.notes
from public.payments p
where p.invoice_id is null
  and not exists (
    select 1
    from public.invoices i
    where i.legacy_payment_id = p.id
  );

-- Link payments to invoices by explicit legacy pointer
update public.payments p
set
  invoice_id = i.id,
  updated_at = now()
from public.invoices i
where p.id = i.legacy_payment_id
  and p.invoice_id is null;

-- Create invoice lines from appointment menus for migrated records
insert into public.invoice_lines (
  store_id,
  invoice_id,
  source_type,
  source_id,
  label,
  quantity,
  unit_amount,
  tax_rate,
  tax_included,
  line_subtotal,
  line_tax,
  line_total,
  sort_order,
  metadata
)
select
  am.store_id,
  p.invoice_id,
  'appointment_menu',
  am.id,
  coalesce(am.menu_name, '施術メニュー'),
  1,
  coalesce(am.price, 0),
  coalesce(am.tax_rate, 0.1),
  coalesce(am.tax_included, true),
  case
    when coalesce(am.tax_included, true) then coalesce(am.price, 0) / (1 + coalesce(am.tax_rate, 0.1))
    else coalesce(am.price, 0)
  end,
  case
    when coalesce(am.tax_included, true) then coalesce(am.price, 0) - (coalesce(am.price, 0) / (1 + coalesce(am.tax_rate, 0.1)))
    else coalesce(am.price, 0) * coalesce(am.tax_rate, 0.1)
  end,
  coalesce(am.price, 0),
  100,
  jsonb_build_object('appointment_id', am.appointment_id, 'menu_id', am.menu_id)
from public.appointment_menus am
join public.payments p
  on p.appointment_id = am.appointment_id
 and p.store_id = am.store_id
where p.invoice_id is not null
on conflict do nothing;

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

drop policy if exists invoices_select_store on public.invoices;
create policy invoices_select_store
on public.invoices
for select
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoices.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists invoices_insert_store on public.invoices;
create policy invoices_insert_store
on public.invoices
for insert
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoices.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists invoices_update_store on public.invoices;
create policy invoices_update_store
on public.invoices
for update
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoices.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoices.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists invoice_lines_select_store on public.invoice_lines;
create policy invoice_lines_select_store
on public.invoice_lines
for select
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoice_lines.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists invoice_lines_insert_store on public.invoice_lines;
create policy invoice_lines_insert_store
on public.invoice_lines
for insert
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoice_lines.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists invoice_lines_update_store on public.invoice_lines;
create policy invoice_lines_update_store
on public.invoice_lines
for update
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoice_lines.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = invoice_lines.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);
