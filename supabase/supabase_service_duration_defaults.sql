-- =========================================================
-- Groomer App: Service duration defaults + staff factors
-- =========================================================
-- Purpose:
-- - Breed x menu standard duration management.
-- - Staff-level duration coefficient (faster/slower adjustment).
-- =========================================================

begin;

create table if not exists public.service_duration_defaults (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  breed text not null,
  menu_id uuid not null references public.service_menus(id) on delete cascade,
  duration_min integer not null check (duration_min > 0)
);

create unique index if not exists uq_service_duration_defaults_store_breed_menu
  on public.service_duration_defaults(store_id, breed, menu_id);

create index if not exists idx_service_duration_defaults_store_id
  on public.service_duration_defaults(store_id);

create table if not exists public.staff_duration_factors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  factor numeric(4,2) not null default 1.00 check (factor >= 0.50 and factor <= 1.50)
);

create unique index if not exists uq_staff_duration_factors_store_staff
  on public.staff_duration_factors(store_id, staff_id);

create index if not exists idx_staff_duration_factors_store_id
  on public.staff_duration_factors(store_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'service_duration_defaults',
    'staff_duration_factors'
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
