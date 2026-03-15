alter table public.medical_records
  add column if not exists tags text[],
  add column if not exists ai_tag_status text not null default 'idle',
  add column if not exists ai_tag_error text,
  add column if not exists ai_tag_last_analyzed_at timestamptz,
  add column if not exists ai_tag_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medical_records_ai_tag_status_check'
  ) then
    alter table public.medical_records
      add constraint medical_records_ai_tag_status_check
      check (ai_tag_status in ('idle', 'queued', 'processing', 'completed', 'failed'));
  end if;
end $$;

create index if not exists idx_medical_records_ai_tag_status
  on public.medical_records (store_id, ai_tag_status, updated_at desc nulls last);

create table if not exists public.medical_record_ai_tag_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'queued',
  provider text not null default 'rule_based_v1',
  source text not null default 'manual',
  attempts integer not null default 0,
  result_tags text[],
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medical_record_ai_tag_jobs_status_check'
  ) then
    alter table public.medical_record_ai_tag_jobs
      add constraint medical_record_ai_tag_jobs_status_check
      check (status in ('queued', 'processing', 'completed', 'failed', 'canceled'));
  end if;
end $$;

create index if not exists idx_medical_record_ai_tag_jobs_status
  on public.medical_record_ai_tag_jobs (status, queued_at asc, created_at asc);

create index if not exists idx_medical_record_ai_tag_jobs_record_id
  on public.medical_record_ai_tag_jobs (medical_record_id, created_at desc);
