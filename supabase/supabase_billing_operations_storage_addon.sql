begin;

alter table public.billing_operations
  drop constraint if exists billing_operations_operation_type_check;

alter table public.billing_operations
  add constraint billing_operations_operation_type_check
  check (
    operation_type in (
      'cancel_immediately',
      'cancel_at_period_end',
      'refund_request',
      'setup_assistance_request',
      'setup_assistance_paid',
      'storage_addon_request',
      'storage_addon_paid'
    )
  );

commit;
