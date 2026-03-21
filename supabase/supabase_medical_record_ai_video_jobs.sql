create table if not exists public.medical_record_ai_video_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  medical_record_video_id uuid not null references public.medical_record_videos(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  tier text not null check (tier in ('assist', 'pro', 'pro_plus')),
  status text not null default 'queued',
  source text not null default 'manual',
  provider text,
  attempts integer not null default 0,
  result_payload jsonb,
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medical_record_ai_video_jobs_status
  on public.medical_record_ai_video_jobs (status, queued_at asc, created_at asc);

create index if not exists idx_medical_record_ai_video_jobs_video_tier
  on public.medical_record_ai_video_jobs (medical_record_video_id, tier, created_at desc);
