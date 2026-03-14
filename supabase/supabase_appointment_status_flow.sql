alter table if exists public.appointments
  add column if not exists checked_in_at timestamptz,
  add column if not exists in_service_at timestamptz,
  add column if not exists payment_waiting_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists idx_appointments_checked_in_at on public.appointments(checked_in_at);
create index if not exists idx_appointments_in_service_at on public.appointments(in_service_at);
create index if not exists idx_appointments_payment_waiting_at on public.appointments(payment_waiting_at);
create index if not exists idx_appointments_completed_at on public.appointments(completed_at);
