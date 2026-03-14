begin;

alter table public.job_runs
  add column if not exists trigger text not null default 'scheduled'
    check (trigger in ('scheduled', 'manual_rerun', 'manual_direct')),
  add column if not exists requested_by_user_id uuid,
  add column if not exists source_job_run_id uuid references public.job_runs(id) on delete set null;

create index if not exists idx_job_runs_trigger_started_at
  on public.job_runs(trigger, started_at desc);

create index if not exists idx_job_runs_source_job_run_id
  on public.job_runs(source_job_run_id);

commit;
