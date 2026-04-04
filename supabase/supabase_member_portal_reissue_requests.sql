create table if not exists public.member_portal_reissue_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  member_portal_link_id uuid references public.member_portal_links(id) on delete set null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  requested_ip_hash text,
  requested_ua_hash text,
  request_note text,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_portal_reissue_requests_status_check
    check (status in ('pending', 'issued', 'rejected'))
);

create index if not exists idx_member_portal_reissue_requests_store_customer_status
  on public.member_portal_reissue_requests (store_id, customer_id, status, requested_at desc);

create unique index if not exists member_portal_reissue_requests_one_pending
  on public.member_portal_reissue_requests (store_id, customer_id)
  where status = 'pending';

alter table public.member_portal_reissue_requests enable row level security;

drop policy if exists member_portal_reissue_requests_select_store
  on public.member_portal_reissue_requests;
create policy member_portal_reissue_requests_select_store
on public.member_portal_reissue_requests
for select
to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists member_portal_reissue_requests_insert_store
  on public.member_portal_reissue_requests;
create policy member_portal_reissue_requests_insert_store
on public.member_portal_reissue_requests
for insert
to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists member_portal_reissue_requests_update_store
  on public.member_portal_reissue_requests;
create policy member_portal_reissue_requests_update_store
on public.member_portal_reissue_requests
for update
to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));
