insert into storage.buckets (id, name, public)
values ('pet-videos', 'pet-videos', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "pet_videos_select" on storage.objects;
create policy "pet_videos_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pet-videos'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists "pet_videos_insert" on storage.objects;
create policy "pet_videos_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pet-videos'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists "pet_videos_update" on storage.objects;
create policy "pet_videos_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pet-videos'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'pet-videos'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists "pet_videos_delete" on storage.objects;
create policy "pet_videos_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pet-videos'
  and exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.store_id::text = split_part(name, '/', 1)
  )
);
