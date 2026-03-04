-- Fix staffs.email/user_id uniqueness for multi-store operation
-- Goal:
-- - allow same email in different stores
-- - allow same auth user in different stores
-- - keep uniqueness within the same store

begin;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'staffs_email_key'
  ) then
    alter table public.staffs drop constraint staffs_email_key;
  end if;
end $$;

drop index if exists public.staffs_user_id_unique;
drop index if exists public.uq_staffs_store_user_id;
create unique index if not exists uq_staffs_store_user_id
  on public.staffs(store_id, user_id)
  where user_id is not null;

drop index if exists public.uq_staffs_store_email;
create unique index if not exists uq_staffs_store_email
  on public.staffs(store_id, email)
  where email is not null;

commit;
