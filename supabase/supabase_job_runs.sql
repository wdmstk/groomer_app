begin;

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  job_name text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  retries integer not null default 0 check (retries >= 0),
  last_error text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_job_runs_job_name_started_at
  on public.job_runs(job_name, started_at desc);

create index if not exists idx_job_runs_status_started_at
  on public.job_runs(status, started_at desc);

alter table public.job_runs enable row level security;

drop policy if exists job_runs_owner_select on public.job_runs;
create policy job_runs_owner_select
  on public.job_runs
  for select
  to authenticated
  using (true);

commit;
