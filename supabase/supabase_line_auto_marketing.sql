begin;

alter table if exists public.pets
  add column if not exists coat_volume text
    check (coat_volume in ('light', 'normal', 'heavy'));

alter table if exists public.store_notification_settings
  add column if not exists next_visit_line_enabled boolean not null default true,
  add column if not exists next_visit_notice_days_before integer not null default 3
    check (next_visit_notice_days_before >= 0 and next_visit_notice_days_before <= 30);

commit;
