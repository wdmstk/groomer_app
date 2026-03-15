create table if not exists public.appointment_groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  source text not null default 'manual'
);

alter table public.appointments
  add column if not exists group_id uuid references public.appointment_groups(id);

create index if not exists idx_appointment_groups_store_id on public.appointment_groups(store_id);
create index if not exists idx_appointment_groups_customer_id on public.appointment_groups(customer_id);
create index if not exists idx_appointments_group_id on public.appointments(group_id);
