begin;

alter table if exists public.stores
  add column if not exists public_reserve_conflict_warn_threshold_percent integer not null default 10,
  add column if not exists public_reserve_staff_bias_warn_threshold_percent integer not null default 70;

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_conflict_warn_threshold_percent_check;
alter table if exists public.stores
  add constraint stores_public_reserve_conflict_warn_threshold_percent_check
  check (
    public_reserve_conflict_warn_threshold_percent >= 0
    and public_reserve_conflict_warn_threshold_percent <= 100
  );

alter table if exists public.stores
  drop constraint if exists stores_public_reserve_staff_bias_warn_threshold_percent_check;
alter table if exists public.stores
  add constraint stores_public_reserve_staff_bias_warn_threshold_percent_check
  check (
    public_reserve_staff_bias_warn_threshold_percent >= 0
    and public_reserve_staff_bias_warn_threshold_percent <= 100
  );

commit;
