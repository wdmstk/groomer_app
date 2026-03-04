begin;

alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists idx_payments_store_idempotency_key_unique
  on public.payments(store_id, idempotency_key)
  where idempotency_key is not null;

commit;
