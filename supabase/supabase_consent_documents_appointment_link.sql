-- Link consent documents to appointments for operational unsigned-consent checks.
alter table public.consent_documents
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

create index if not exists idx_consent_documents_store_appointment
  on public.consent_documents(store_id, appointment_id, created_at desc)
  where appointment_id is not null;
