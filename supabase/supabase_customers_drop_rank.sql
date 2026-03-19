begin;

alter table if exists public.customers
  drop column if exists rank;

commit;
