begin;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  author_staff_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  body_text text not null default '',
  visibility text not null default 'owner' check (visibility in ('owner', 'internal')),
  posted_at timestamptz
);

create index if not exists idx_journal_entries_store_posted
  on public.journal_entries(store_id, posted_at desc, created_at desc);

create index if not exists idx_journal_entries_store_customer
  on public.journal_entries(store_id, customer_id, created_at desc);

create table if not exists public.journal_entry_pets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  unique (store_id, entry_id, pet_id)
);

create index if not exists idx_journal_entry_pets_store_pet
  on public.journal_entry_pets(store_id, pet_id, created_at desc);

create table if not exists public.journal_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  storage_key text not null,
  thumbnail_key text,
  duration_sec integer,
  sort_order integer not null default 0
);

create index if not exists idx_journal_media_store_entry_sort
  on public.journal_media(store_id, entry_id, sort_order, created_at);

create table if not exists public.journal_health_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  appetite_level text,
  stool_level text,
  skin_level text,
  energy_level text,
  memo text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_journal_health_checks_store_entry
  on public.journal_health_checks(store_id, entry_id, checked_at desc);

create table if not exists public.journal_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  channel text not null default 'line' check (channel in ('line')),
  recipient_customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  sent_at timestamptz,
  error_code text
);

create index if not exists idx_journal_notifications_store_status
  on public.journal_notifications(store_id, status, created_at desc);

create table if not exists public.journal_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  link_type text not null check (link_type in ('photo_karte', 'video_karte', 'medical_record')),
  linked_record_id uuid not null,
  meta_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_journal_links_store_entry
  on public.journal_links(store_id, entry_id, created_at desc);

create table if not exists public.journal_permissions_override (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  role text not null,
  can_create boolean not null default false,
  can_publish boolean not null default false,
  can_view_internal boolean not null default false,
  can_delete boolean not null default false,
  unique (store_id, role)
);

create index if not exists idx_journal_permissions_override_store_role
  on public.journal_permissions_override(store_id, role);

do $$
declare
  t text;
begin
  foreach t in array array[
    'journal_entries',
    'journal_entry_pets',
    'journal_media',
    'journal_health_checks',
    'journal_notifications',
    'journal_links',
    'journal_permissions_override'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I_select_store on public.%I;', t, t);
    execute format(
      'create policy %I_select_store on public.%I for select to authenticated using (store_id in (select public.current_user_store_ids()));',
      t,
      t
    );

    execute format('drop policy if exists %I_insert_store on public.%I;', t, t);
    execute format(
      'create policy %I_insert_store on public.%I for insert to authenticated with check (store_id in (select public.current_user_store_ids()));',
      t,
      t
    );

    execute format('drop policy if exists %I_update_store on public.%I;', t, t);
    execute format(
      'create policy %I_update_store on public.%I for update to authenticated using (store_id in (select public.current_user_store_ids())) with check (store_id in (select public.current_user_store_ids()));',
      t,
      t
    );

    execute format('drop policy if exists %I_delete_store on public.%I;', t, t);
    execute format(
      'create policy %I_delete_store on public.%I for delete to authenticated using (store_id in (select public.current_user_store_ids()));',
      t,
      t
    );
  end loop;
end
$$;

commit;
