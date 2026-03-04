-- =========================================================
-- Groomer App: Multi-store migration
-- =========================================================
-- Purpose:
-- 1) Add stores and store_memberships tables
-- 2) Add store_id to business tables
-- 3) Backfill existing rows into a default store
-- 4) Add indexes and per-store uniqueness
--
-- Run this in a maintenance window. Back up DB before applying.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1) Core multi-store tables
-- ---------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  code text unique,
  timezone text not null default 'Asia/Tokyo',
  is_active boolean not null default true
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  is_active boolean not null default true,
  unique (store_id, user_id)
);

create index if not exists idx_store_memberships_user_id on public.store_memberships(user_id);
create index if not exists idx_store_memberships_store_id on public.store_memberships(store_id);

-- ---------------------------------------------------------
-- 2) Add store_id columns to business tables
-- ---------------------------------------------------------
alter table if exists public.customers add column if not exists store_id uuid;
alter table if exists public.service_menus add column if not exists store_id uuid;
alter table if exists public.pets add column if not exists store_id uuid;
alter table if exists public.staffs add column if not exists store_id uuid;
alter table if exists public.appointments add column if not exists store_id uuid;
alter table if exists public.appointment_menus add column if not exists store_id uuid;
alter table if exists public.visits add column if not exists store_id uuid;
alter table if exists public.visit_menus add column if not exists store_id uuid;
alter table if exists public.payments add column if not exists store_id uuid;
alter table if exists public.medical_records add column if not exists store_id uuid;

do $$
declare
  default_store_id uuid;
begin
  -- Create or reuse default store for existing single-store data.
  select id into default_store_id
  from public.stores
  where code = 'default'
  limit 1;

  if default_store_id is null then
    insert into public.stores (name, code, timezone, is_active)
    values ('Default Store', 'default', 'Asia/Tokyo', true)
    returning id into default_store_id;
  end if;

  update public.customers set store_id = default_store_id where store_id is null;
  update public.service_menus set store_id = default_store_id where store_id is null;
  update public.pets set store_id = default_store_id where store_id is null;
  update public.staffs set store_id = default_store_id where store_id is null;
  update public.appointments set store_id = default_store_id where store_id is null;
  update public.appointment_menus set store_id = default_store_id where store_id is null;
  update public.visits set store_id = default_store_id where store_id is null;
  update public.visit_menus set store_id = default_store_id where store_id is null;
  update public.payments set store_id = default_store_id where store_id is null;
  update public.medical_records set store_id = default_store_id where store_id is null;
end $$;

-- ---------------------------------------------------------
-- 3) Foreign keys for store_id
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_store_id_fkey'
  ) then
    alter table public.customers
      add constraint customers_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_menus_store_id_fkey'
  ) then
    alter table public.service_menus
      add constraint service_menus_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pets_store_id_fkey'
  ) then
    alter table public.pets
      add constraint pets_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staffs_store_id_fkey'
  ) then
    alter table public.staffs
      add constraint staffs_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_store_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_menus_store_id_fkey'
  ) then
    alter table public.appointment_menus
      add constraint appointment_menus_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'visits_store_id_fkey'
  ) then
    alter table public.visits
      add constraint visits_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'visit_menus_store_id_fkey'
  ) then
    alter table public.visit_menus
      add constraint visit_menus_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_store_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'medical_records_store_id_fkey'
  ) then
    alter table public.medical_records
      add constraint medical_records_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------
-- 4) Enforce not null and indexes
-- ---------------------------------------------------------
alter table public.customers alter column store_id set not null;
alter table public.service_menus alter column store_id set not null;
alter table public.pets alter column store_id set not null;
alter table public.staffs alter column store_id set not null;
alter table public.appointments alter column store_id set not null;
alter table public.appointment_menus alter column store_id set not null;
alter table public.visits alter column store_id set not null;
alter table public.visit_menus alter column store_id set not null;
alter table public.payments alter column store_id set not null;
alter table public.medical_records alter column store_id set not null;

create index if not exists idx_customers_store_id on public.customers(store_id);
create index if not exists idx_service_menus_store_id on public.service_menus(store_id);
create index if not exists idx_pets_store_id on public.pets(store_id);
create index if not exists idx_staffs_store_id on public.staffs(store_id);
create index if not exists idx_appointments_store_id on public.appointments(store_id);
create index if not exists idx_appointment_menus_store_id on public.appointment_menus(store_id);
create index if not exists idx_visits_store_id on public.visits(store_id);
create index if not exists idx_visit_menus_store_id on public.visit_menus(store_id);
create index if not exists idx_payments_store_id on public.payments(store_id);
create index if not exists idx_medical_records_store_id on public.medical_records(store_id);

-- ---------------------------------------------------------
-- 5) Replace global unique constraints with per-store unique indexes
-- ---------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'customers_email_key'
  ) then
    alter table public.customers drop constraint customers_email_key;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'customers_line_id_key'
  ) then
    alter table public.customers drop constraint customers_line_id_key;
  end if;
end $$;

create unique index if not exists uq_customers_store_email
  on public.customers(store_id, email)
  where email is not null;

create unique index if not exists uq_customers_store_line_id
  on public.customers(store_id, line_id)
  where line_id is not null;

commit;
