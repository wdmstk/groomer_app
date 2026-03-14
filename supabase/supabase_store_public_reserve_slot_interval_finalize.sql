begin;

update public.stores
set public_reserve_slot_interval_minutes = 30
where public_reserve_slot_interval_minutes <> 30;

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_slot_interval_minutes_check;

alter table if exists public.stores
  add constraint stores_public_reserve_slot_interval_minutes_check
  check (public_reserve_slot_interval_minutes = 30);

commit;
