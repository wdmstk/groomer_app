begin;

update public.stores
set public_reserve_slot_days = 7
where public_reserve_slot_days > 7;

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_slot_days_check;

alter table if exists public.stores
  add constraint stores_public_reserve_slot_days_check
  check (public_reserve_slot_days >= 1 and public_reserve_slot_days <= 7);

commit;
