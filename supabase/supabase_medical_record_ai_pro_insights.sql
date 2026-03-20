create table if not exists public.medical_record_ai_pro_insights (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  model_tier text not null default 'pro' check (model_tier in ('pro', 'pro_plus')),
  personality_traits text[] not null default '{}',
  behavior_score integer not null default 0 check (behavior_score between 0 and 100),
  cooperation_score integer not null default 0 check (cooperation_score between 0 and 100),
  stress_score integer not null default 0 check (stress_score between 0 and 100),
  estimated_next_duration_min integer check (estimated_next_duration_min is null or estimated_next_duration_min > 0),
  matting_risk text not null default 'low' check (matting_risk in ('low', 'medium', 'high')),
  surcharge_risk text not null default 'low' check (surcharge_risk in ('low', 'medium', 'high')),
  highlighted_scenes jsonb not null default '[]'::jsonb,
  confidence numeric(4, 3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  source_video_count integer not null default 0 check (source_video_count >= 0),
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medical_record_id)
);

create index if not exists idx_medical_record_ai_pro_insights_store_record
  on public.medical_record_ai_pro_insights (store_id, medical_record_id);

create index if not exists idx_medical_record_ai_pro_insights_analyzed_at
  on public.medical_record_ai_pro_insights (store_id, analyzed_at desc);

