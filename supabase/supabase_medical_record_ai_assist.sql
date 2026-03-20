create table if not exists public.medical_record_ai_assist_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'queued',
  source text not null default 'manual',
  provider text not null default 'assist_light_v1',
  attempts integer not null default 0,
  result_payload jsonb,
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
    where conname = 'medical_record_ai_assist_jobs_status_check'
  ) then
    alter table public.medical_record_ai_assist_jobs
      add constraint medical_record_ai_assist_jobs_status_check
      check (status in ('queued', 'processing', 'completed', 'failed', 'canceled'));
  end if;
end $$;

create index if not exists idx_medical_record_ai_assist_jobs_status
  on public.medical_record_ai_assist_jobs (status, queued_at asc, created_at asc);

create index if not exists idx_medical_record_ai_assist_jobs_record_id
  on public.medical_record_ai_assist_jobs (medical_record_id, created_at desc);

create table if not exists public.medical_record_ai_assist_results (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  generated_tags text[] not null default '{}',
  generated_record_text text not null default '',
  generated_short_video_path text,
  generated_video_id uuid references public.medical_record_videos(id) on delete set null,
  provider text not null default 'assist_light_v1',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medical_record_id)
);

create index if not exists idx_medical_record_ai_assist_results_record_id
  on public.medical_record_ai_assist_results (medical_record_id, generated_at desc);

