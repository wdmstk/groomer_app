create table if not exists public.medical_record_ai_pro_plus_health_insights (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  gait_risk text not null default 'low' check (gait_risk in ('low', 'medium', 'high')),
  skin_risk text not null default 'low' check (skin_risk in ('low', 'medium', 'high')),
  tremor_risk text not null default 'low' check (tremor_risk in ('low', 'medium', 'high')),
  respiration_risk text not null default 'low' check (respiration_risk in ('low', 'medium', 'high')),
  stress_level text not null default 'low' check (stress_level in ('low', 'medium', 'high')),
  fatigue_level text not null default 'low' check (fatigue_level in ('low', 'medium', 'high')),
  summary text not null default '',
  confidence numeric(4, 3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  highlight_video_id uuid references public.medical_record_videos(id) on delete set null,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medical_record_id)
);

create index if not exists idx_medical_record_ai_pro_plus_health_store_record
  on public.medical_record_ai_pro_plus_health_insights (store_id, medical_record_id);

create table if not exists public.store_ai_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  report_month text not null check (report_month ~ '^[0-9]{4}-[0-9]{2}$'),
  summary text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, report_month)
);

create index if not exists idx_store_ai_monthly_reports_store_month
  on public.store_ai_monthly_reports (store_id, report_month desc);

