begin;

create table if not exists public.store_reservation_payment_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  prepayment_enabled boolean not null default false,
  card_hold_enabled boolean not null default false,
  cancellation_day_before_percent integer not null default 0 check (cancellation_day_before_percent between 0 and 100),
  cancellation_same_day_percent integer not null default 50 check (cancellation_same_day_percent between 0 and 100),
  cancellation_no_show_percent integer not null default 100 check (cancellation_no_show_percent between 0 and 100),
  no_show_charge_mode text not null default 'manual' check (no_show_charge_mode in ('manual', 'auto'))
);

alter table if exists public.appointments
  add column if not exists reservation_payment_method text not null default 'none'
    check (reservation_payment_method in ('none', 'prepayment', 'card_hold')),
  add column if not exists reservation_payment_status text not null default 'unpaid'
    check (reservation_payment_status in ('unpaid', 'authorized', 'paid', 'captured', 'charge_pending', 'failed', 'waived')),
  add column if not exists reservation_payment_paid_at timestamptz,
  add column if not exists reservation_payment_authorized_at timestamptz;

create index if not exists idx_appointments_reservation_payment_status
  on public.appointments(store_id, reservation_payment_status);

alter table public.store_reservation_payment_settings enable row level security;

drop policy if exists store_reservation_payment_settings_select_store on public.store_reservation_payment_settings;
create policy store_reservation_payment_settings_select_store
on public.store_reservation_payment_settings
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists store_reservation_payment_settings_modify_owner_admin on public.store_reservation_payment_settings;
create policy store_reservation_payment_settings_modify_owner_admin
on public.store_reservation_payment_settings
for all to authenticated
using (public.current_user_store_role(store_id) in ('owner', 'admin'))
with check (public.current_user_store_role(store_id) in ('owner', 'admin'));

commit;
