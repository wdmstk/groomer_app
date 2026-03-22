drop index if exists public.idx_pets_qr_code_url;

alter table if exists public.pets
  drop column if exists qr_code_url,
  drop column if exists qr_payload;
