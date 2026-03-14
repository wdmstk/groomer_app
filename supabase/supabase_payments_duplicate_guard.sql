-- Prevent multiple payments from being registered for the same appointment.
-- If this fails because duplicates already exist, run `supabase_payments_deduplicate.sql` first.
do $$
begin
  if exists (
    select 1
    from public.payments
    group by appointment_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate payments already exist. Resolve duplicates in public.payments before applying this guard.';
  end if;
end
$$;

create unique index if not exists idx_payments_appointment_id_unique
  on public.payments(appointment_id);
