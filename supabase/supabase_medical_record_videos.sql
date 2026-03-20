create table if not exists public.medical_record_videos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  storage_path text not null,
  thumbnail_path text,
  line_short_path text,
  duration_sec integer,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  source_type text not null default 'uploaded' check (source_type in ('uploaded', 'ai_generated')),
  comment text,
  sort_order integer not null default 0,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medical_record_videos_record_id
  on public.medical_record_videos (medical_record_id, sort_order, created_at);

create index if not exists idx_medical_record_videos_pet_taken_at
  on public.medical_record_videos (pet_id, taken_at desc, created_at desc);
