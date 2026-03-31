-- =========================================================
-- Groomer App: Electronic Consent (Treatment Agreement)
-- Task: TASK-422
-- =========================================================
-- Prerequisite:
-- - Apply supabase_multistore_migration.sql
-- - Apply supabase_multistore_rls.sql
-- =========================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null default 'grooming',
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_consent_templates_store_created_at
  on public.consent_templates(store_id, created_at desc);

create index if not exists idx_consent_templates_store_status
  on public.consent_templates(store_id, status, updated_at desc);

create table if not exists public.consent_template_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_id uuid not null references public.consent_templates(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  title text not null,
  body_html text not null,
  body_text text not null,
  document_hash text not null,
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  unique (template_id, version_no)
);

create index if not exists idx_consent_template_versions_store_template
  on public.consent_template_versions(store_id, template_id, version_no desc);

create index if not exists idx_consent_template_versions_store_published
  on public.consent_template_versions(store_id, published_at desc);

alter table public.consent_templates
  drop constraint if exists consent_templates_current_version_id_fkey;

alter table public.consent_templates
  add constraint consent_templates_current_version_id_fkey
  foreign key (current_version_id)
  references public.consent_template_versions(id)
  on delete set null;

create table if not exists public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  template_id uuid not null references public.consent_templates(id) on delete restrict,
  template_version_id uuid not null references public.consent_template_versions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed', 'expired', 'canceled', 'revoked')),
  delivery_channel text not null default 'in_person' check (delivery_channel in ('in_person', 'line', 'email', 'sms')),
  signature_method text not null default 'draw' check (signature_method in ('draw', 'typed')),
  sign_token_hash text,
  token_expires_at timestamptz,
  expires_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  pdf_path text,
  revoked_at timestamptz,
  revoked_reason text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_consent_documents_store_customer_pet
  on public.consent_documents(store_id, customer_id, pet_id, created_at desc);

create index if not exists idx_consent_documents_store_appointment
  on public.consent_documents(store_id, appointment_id, created_at desc)
  where appointment_id is not null;

create index if not exists idx_consent_documents_store_status
  on public.consent_documents(store_id, status, created_at desc);

create index if not exists idx_consent_documents_store_signed_at
  on public.consent_documents(store_id, signed_at desc);

create index if not exists idx_consent_documents_store_token
  on public.consent_documents(store_id, sign_token_hash, token_expires_at desc);

create table if not exists public.consent_signatures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  document_id uuid not null references public.consent_documents(id) on delete cascade,
  signer_name text not null,
  signature_image_path text not null,
  signature_strokes jsonb not null default '[]'::jsonb,
  consent_checked boolean not null default true,
  signed_at timestamptz not null default now(),
  ip_hash text,
  ua_hash text,
  device_type text,
  device_os text,
  browser text,
  unique (document_id)
);

create index if not exists idx_consent_signatures_store_signed_at
  on public.consent_signatures(store_id, signed_at desc);

create table if not exists public.consent_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  document_id uuid not null references public.consent_documents(id) on delete cascade,
  channel text not null check (channel in ('line', 'email', 'sms', 'in_person')),
  target text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  sent_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_consent_delivery_logs_store_created_at
  on public.consent_delivery_logs(store_id, created_at desc);

create index if not exists idx_consent_delivery_logs_store_status
  on public.consent_delivery_logs(store_id, status, created_at desc);

create table if not exists public.consent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entity_type text not null check (entity_type in ('template', 'template_version', 'document', 'signature', 'delivery')),
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  before jsonb,
  after jsonb,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_consent_audit_logs_store_created_at
  on public.consent_audit_logs(store_id, created_at desc);

create index if not exists idx_consent_audit_logs_store_entity
  on public.consent_audit_logs(store_id, entity_type, entity_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array[
    'consent_templates',
    'consent_template_versions',
    'consent_documents',
    'consent_signatures',
    'consent_delivery_logs',
    'consent_audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t || '_select_store', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (store_id in (select public.current_user_store_ids()));',
      t || '_select_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_insert_store', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (store_id in (select public.current_user_store_ids()));',
      t || '_insert_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_update_store', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (store_id in (select public.current_user_store_ids())) with check (store_id in (select public.current_user_store_ids()));',
      t || '_update_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_delete_store', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (store_id in (select public.current_user_store_ids()));',
      t || '_delete_store',
      t
    );
  end loop;
end $$;

commit;
