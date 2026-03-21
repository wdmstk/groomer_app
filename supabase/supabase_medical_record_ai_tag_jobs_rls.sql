begin;

alter table public.medical_record_ai_tag_jobs enable row level security;

drop policy if exists medical_record_ai_tag_jobs_select_store on public.medical_record_ai_tag_jobs;
create policy medical_record_ai_tag_jobs_select_store
on public.medical_record_ai_tag_jobs
for select
to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists medical_record_ai_tag_jobs_insert_store on public.medical_record_ai_tag_jobs;
create policy medical_record_ai_tag_jobs_insert_store
on public.medical_record_ai_tag_jobs
for insert
to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists medical_record_ai_tag_jobs_update_store on public.medical_record_ai_tag_jobs;
create policy medical_record_ai_tag_jobs_update_store
on public.medical_record_ai_tag_jobs
for update
to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists medical_record_ai_tag_jobs_delete_store on public.medical_record_ai_tag_jobs;
create policy medical_record_ai_tag_jobs_delete_store
on public.medical_record_ai_tag_jobs
for delete
to authenticated
using (store_id in (select public.current_user_store_ids()));

commit;
