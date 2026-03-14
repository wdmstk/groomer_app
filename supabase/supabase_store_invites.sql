-- store_invites table for owner/admin invitation flow
create table if not exists public.store_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'staff')),
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  used_by uuid references auth.users(id),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists idx_store_invites_store_id on public.store_invites(store_id);
create index if not exists idx_store_invites_token on public.store_invites(token);
create index if not exists idx_store_invites_email on public.store_invites(email);

alter table public.store_invites enable row level security;

drop policy if exists store_invites_select on public.store_invites;
create policy store_invites_select
on public.store_invites
for select
to authenticated
using (
  store_id in (
    select sm.store_id
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists store_invites_insert on public.store_invites;
create policy store_invites_insert
on public.store_invites
for insert
to authenticated
with check (
  store_id in (
    select sm.store_id
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
  and invited_by = auth.uid()
);

drop policy if exists store_invites_update on public.store_invites;
create policy store_invites_update
on public.store_invites
for update
to authenticated
using (
  store_id in (
    select sm.store_id
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  store_id in (
    select sm.store_id
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);
