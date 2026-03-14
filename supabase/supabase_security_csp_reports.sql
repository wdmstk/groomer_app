-- CSP violation reports (Report-Only / Enforced) storage
create extension if not exists pgcrypto;

create table if not exists public.security_csp_reports (
  id uuid primary key default gen_random_uuid(),
  document_uri text,
  violated_directive text,
  effective_directive text,
  blocked_uri text,
  source_file text,
  line_number integer,
  column_number integer,
  disposition text,
  referrer text,
  status_code integer,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists security_csp_reports_created_at_idx
  on public.security_csp_reports (created_at desc);

create index if not exists security_csp_reports_effective_directive_idx
  on public.security_csp_reports (effective_directive);

alter table public.security_csp_reports enable row level security;

-- Service-role ingestion from backend API.
drop policy if exists security_csp_reports_service_role_all on public.security_csp_reports;
create policy security_csp_reports_service_role_all
  on public.security_csp_reports
  for all
  to service_role
  using (true)
  with check (true);
