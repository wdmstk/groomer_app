begin;

alter table if exists public.stores
  add column if not exists public_reserve_slot_days integer not null default 7,
  add column if not exists public_reserve_slot_interval_minutes integer not null default 30,
  add column if not exists public_reserve_slot_buffer_minutes integer not null default 15,
  add column if not exists public_reserve_business_start_hour_jst integer not null default 10,
  add column if not exists public_reserve_business_end_hour_jst integer not null default 18,
  add column if not exists public_reserve_min_lead_minutes integer not null default 60;

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_slot_days_check;
alter table if exists public.stores
  add constraint stores_public_reserve_slot_days_check
  check (public_reserve_slot_days >= 1 and public_reserve_slot_days <= 14);

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_slot_interval_minutes_check;
alter table if exists public.stores
  add constraint stores_public_reserve_slot_interval_minutes_check
  check (public_reserve_slot_interval_minutes >= 5 and public_reserve_slot_interval_minutes <= 60);

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_slot_buffer_minutes_check;
alter table if exists public.stores
  add constraint stores_public_reserve_slot_buffer_minutes_check
  check (public_reserve_slot_buffer_minutes >= 0 and public_reserve_slot_buffer_minutes <= 60);

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_business_start_hour_jst_check;
alter table if exists public.stores
  add constraint stores_public_reserve_business_start_hour_jst_check
  check (
    public_reserve_business_start_hour_jst >= 0
    and public_reserve_business_start_hour_jst <= 23
  );

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_business_end_hour_jst_check;
alter table if exists public.stores
  add constraint stores_public_reserve_business_end_hour_jst_check
  check (
    public_reserve_business_end_hour_jst >= 1
    and public_reserve_business_end_hour_jst <= 24
  );

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_business_hours_order_check;
alter table if exists public.stores
  add constraint stores_public_reserve_business_hours_order_check
  check (
    public_reserve_business_end_hour_jst > public_reserve_business_start_hour_jst
  );

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_min_lead_minutes_check;
alter table if exists public.stores
  add constraint stores_public_reserve_min_lead_minutes_check
  check (public_reserve_min_lead_minutes >= 0 and public_reserve_min_lead_minutes <= 1440);

commit;
