begin;

alter table public.store_subscriptions
  add column if not exists hotel_option_enabled boolean not null default false;

commit;
