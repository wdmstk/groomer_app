alter table if exists public.pets
  add column if not exists qr_code_url text,
  add column if not exists qr_payload text;

create index if not exists idx_pets_qr_code_url on public.pets(qr_code_url);
