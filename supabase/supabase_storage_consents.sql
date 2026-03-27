begin;

insert into storage.buckets (id, name, public)
values ('consent-signatures', 'consent-signatures', false)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('consent-pdfs', 'consent-pdfs', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists consent_signatures_select on storage.objects;
create policy consent_signatures_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'consent-signatures'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists consent_pdfs_select on storage.objects;
create policy consent_pdfs_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'consent-pdfs'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
);

commit;
