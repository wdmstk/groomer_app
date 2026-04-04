alter table public.stores
  add column if not exists member_portal_ttl_days integer not null default 90;

alter table public.stores
  drop constraint if exists stores_member_portal_ttl_days_check;

alter table public.stores
  add constraint stores_member_portal_ttl_days_check
  check (member_portal_ttl_days in (30, 90, 180));

comment on column public.stores.member_portal_ttl_days is
  '会員証URL失効判定に使うTTL（日）。30/90/180から選択。';
