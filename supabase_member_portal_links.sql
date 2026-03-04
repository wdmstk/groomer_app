create table if not exists public.member_portal_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null default 'member_portal',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_portal_links_customer_active
  on public.member_portal_links (customer_id, expires_at desc)
  where revoked_at is null;

create index if not exists idx_member_portal_links_store_customer
  on public.member_portal_links (store_id, customer_id, created_at desc);

alter table public.member_portal_links
  drop constraint if exists member_portal_links_purpose_check;

alter table public.member_portal_links
  add constraint member_portal_links_purpose_check
  check (purpose in ('member_portal'));
