begin;

create index if not exists idx_appointments_store_start_time
  on public.appointments(store_id, start_time desc);

create index if not exists idx_appointments_store_customer_status
  on public.appointments(store_id, customer_id, status);

create index if not exists idx_medical_records_store_record_date
  on public.medical_records(store_id, record_date desc);

create index if not exists idx_customers_store_created_at
  on public.customers(store_id, created_at desc);

create index if not exists idx_pets_store_created_at
  on public.pets(store_id, created_at desc);

create index if not exists idx_staffs_store_created_at
  on public.staffs(store_id, created_at desc);

commit;
