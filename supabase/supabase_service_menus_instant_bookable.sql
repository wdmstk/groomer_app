begin;

alter table if exists public.service_menus
  add column if not exists is_instant_bookable boolean not null default false;

create index if not exists idx_service_menus_store_instant_bookable
  on public.service_menus(store_id, is_instant_bookable)
  where is_active = true;

commit;
