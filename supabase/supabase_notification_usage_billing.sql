begin;

create table if not exists public.notification_usage_billing_monthly (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  month_jst date not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  counted_sent_messages integer not null default 0 check (counted_sent_messages >= 0),
  applied_limit integer not null default 0 check (applied_limit >= 0),
  billable_messages integer not null default 0 check (billable_messages >= 0),
  unit_price_jpy integer not null default 3 check (unit_price_jpy >= 0),
  amount_jpy integer not null default 0 check (amount_jpy >= 0),
  option_enabled boolean not null default false,
  detail jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  calculated_by_job_run_id uuid references public.job_runs(id) on delete set null,
  unique (store_id, month_jst)
);

create index if not exists idx_notification_usage_billing_monthly_store_month
  on public.notification_usage_billing_monthly(store_id, month_jst desc);

alter table public.notification_usage_billing_monthly enable row level security;

drop policy if exists notification_usage_billing_monthly_owner_select on public.notification_usage_billing_monthly;
create policy notification_usage_billing_monthly_owner_select
on public.notification_usage_billing_monthly
for select to authenticated
using (public.is_store_owner(store_id));

alter table public.store_notification_settings
  add column if not exists notification_option_enabled boolean not null default false;

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
      'storage_addon_paid',
      'notification_usage_billing_calculated'
    )
  );

commit;
