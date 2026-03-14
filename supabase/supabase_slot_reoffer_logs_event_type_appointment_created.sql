begin;

alter table public.slot_reoffer_logs
  drop constraint if exists slot_reoffer_logs_event_type_check;

alter table public.slot_reoffer_logs
  add constraint slot_reoffer_logs_event_type_check
  check (
    event_type in (
      'slot_opened',
      'candidate_selected',
      'sent',
      'accepted',
      'expired',
      'canceled',
      'appointment_created'
    )
  );

commit;
