begin;

create table if not exists public.line_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid references public.stores(id) on delete set null,
  matched_customer_id uuid references public.customers(id) on delete set null,
  line_user_id text,
  destination text,
  event_type text not null,
  event_id text unique,
  signature text,
  status text not null default 'received'
    check (status in ('received', 'linked', 'failed')),
  payload jsonb not null
);

create index if not exists idx_line_webhook_events_created_at
  on public.line_webhook_events(created_at desc);

create index if not exists idx_line_webhook_events_store_created_at
  on public.line_webhook_events(store_id, created_at desc);

create index if not exists idx_line_webhook_events_line_user_id
  on public.line_webhook_events(line_user_id);

alter table public.line_webhook_events enable row level security;

drop policy if exists line_webhook_events_owner_select on public.line_webhook_events;
create policy line_webhook_events_owner_select on public.line_webhook_events
  for select to authenticated
  using (store_id is not null and public.is_store_owner(store_id));

commit;
