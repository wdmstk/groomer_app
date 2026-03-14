alter table if exists public.medical_records
  add column if not exists appointment_id uuid references public.appointments(id),
  add column if not exists payment_id uuid references public.payments(id),
  add column if not exists status text not null default 'draft',
  add column if not exists finalized_at timestamptz;

create index if not exists idx_medical_records_appointment_id on public.medical_records(appointment_id);
create index if not exists idx_medical_records_payment_id on public.medical_records(payment_id);
create index if not exists idx_medical_records_status on public.medical_records(status);

alter table public.medical_records
  drop constraint if exists medical_records_status_check;

alter table public.medical_records
  add constraint medical_records_status_check
  check (status in ('draft', 'finalized'));

alter table public.medical_records
  drop constraint if exists medical_records_finalized_payment_required_check;

alter table public.medical_records
  add constraint medical_records_finalized_payment_required_check
  check (status <> 'finalized' or payment_id is not null);
