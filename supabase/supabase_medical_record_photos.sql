create table if not exists public.medical_record_photos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  photo_type text not null check (photo_type in ('before', 'after')),
  storage_path text not null,
  comment text,
  sort_order integer not null default 0,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medical_record_photos_record_id
  on public.medical_record_photos (medical_record_id, sort_order, created_at);

create index if not exists idx_medical_record_photos_pet_taken_at
  on public.medical_record_photos (pet_id, taken_at desc, created_at desc);

create table if not exists public.medical_record_share_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_medical_record_share_links_record_id
  on public.medical_record_share_links (medical_record_id, expires_at desc);

create unique index if not exists idx_medical_records_unique_appointment
  on public.medical_records (appointment_id)
  where appointment_id is not null;
