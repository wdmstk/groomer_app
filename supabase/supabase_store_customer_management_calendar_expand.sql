alter table if exists public.store_customer_management_settings
  add column if not exists calendar_expand_out_of_range_appointments boolean not null default false;
