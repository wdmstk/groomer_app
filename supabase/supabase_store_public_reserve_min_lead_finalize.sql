begin;

update public.stores
set public_reserve_min_lead_minutes = 60
where public_reserve_min_lead_minutes < 60;

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_min_lead_minutes_check;

alter table if exists public.stores
  add constraint stores_public_reserve_min_lead_minutes_check
  check (public_reserve_min_lead_minutes >= 60 and public_reserve_min_lead_minutes <= 1440);

commit;
