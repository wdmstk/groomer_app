begin;

create table if not exists public.job_lock_release_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  released_at timestamptz not null,
  job_run_id uuid not null references public.job_runs(id) on delete cascade,
  job_name text not null,
  requested_by_user_id uuid not null,
  requested_by_email text,
  lock_job_run_id uuid not null,
  lock_job_name text not null
);

create index if not exists idx_job_lock_release_audits_job_run_id_released_at
  on public.job_lock_release_audits(job_run_id, released_at desc);

create index if not exists idx_job_lock_release_audits_job_name_released_at
  on public.job_lock_release_audits(job_name, released_at desc);

create index if not exists idx_job_lock_release_audits_requested_by_user_id_released_at
  on public.job_lock_release_audits(requested_by_user_id, released_at desc);

commit;
