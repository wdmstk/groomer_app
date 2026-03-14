-- Prevent multiple visits from being registered for the same appointment.
-- If this fails because duplicates already exist, run `supabase_visits_deduplicate.sql` first.
do $$
begin
  if exists (
    select 1
    from public.visits
    where appointment_id is not null
    group by appointment_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate visits already exist. Resolve duplicates in public.visits before applying this guard.';
  end if;
end
$$;

create unique index if not exists idx_visits_appointment_id_unique
  on public.visits(appointment_id)
  where appointment_id is not null;
