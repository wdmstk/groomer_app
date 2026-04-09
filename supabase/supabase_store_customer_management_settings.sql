begin;

create table if not exists public.store_customer_management_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  medical_record_list_limit integer not null default 10,
  journal_visibility_mode text not null default 'published_only',
  followup_snoozed_refollow_days integer not null default 7,
  followup_no_need_refollow_days integer not null default 60,
  followup_lost_refollow_days integer not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_customer_management_settings_medical_record_list_limit_check
    check (medical_record_list_limit >= 5 and medical_record_list_limit <= 100),
  constraint store_customer_management_settings_journal_visibility_mode_check
    check (journal_visibility_mode in ('published_only', 'include_drafts')),
  constraint store_customer_management_settings_followup_snoozed_refollow_days_check
    check (followup_snoozed_refollow_days >= 1 and followup_snoozed_refollow_days <= 365),
  constraint store_customer_management_settings_followup_no_need_refollow_days_check
    check (followup_no_need_refollow_days >= 1 and followup_no_need_refollow_days <= 365),
  constraint store_customer_management_settings_followup_lost_refollow_days_check
    check (followup_lost_refollow_days >= 1 and followup_lost_refollow_days <= 365)
);

alter table public.store_customer_management_settings enable row level security;

drop policy if exists store_customer_management_settings_select
  on public.store_customer_management_settings;

create policy store_customer_management_settings_select
  on public.store_customer_management_settings
  for select
  using (
    exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = store_customer_management_settings.store_id
        and sm.user_id = auth.uid()
        and sm.is_active = true
    )
  );

drop policy if exists store_customer_management_settings_upsert
  on public.store_customer_management_settings;

create policy store_customer_management_settings_upsert
  on public.store_customer_management_settings
  for all
  using (
    exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = store_customer_management_settings.store_id
        and sm.user_id = auth.uid()
        and sm.is_active = true
        and sm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = store_customer_management_settings.store_id
        and sm.user_id = auth.uid()
        and sm.is_active = true
        and sm.role in ('owner', 'admin')
    )
  );

create or replace function public.set_store_customer_management_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_store_customer_management_settings_updated_at
  on public.store_customer_management_settings;

create trigger trg_store_customer_management_settings_updated_at
before update on public.store_customer_management_settings
for each row execute function public.set_store_customer_management_settings_updated_at();

comment on table public.store_customer_management_settings is
  '顧客管理（β）ページ向けの店舗表示設定';
comment on column public.store_customer_management_settings.medical_record_list_limit is
  '顧客管理（β）で表示するペット別カルテの件数上限';
comment on column public.store_customer_management_settings.journal_visibility_mode is
  '顧客管理（β）の日誌表示対象（published_only/include_drafts）';
comment on column public.store_customer_management_settings.followup_snoozed_refollow_days is
  '再来店フォローで保留（snoozed）時に再フォロー候補へ戻す日数';
comment on column public.store_customer_management_settings.followup_no_need_refollow_days is
  '再来店フォローで不要（resolved_no_need）時に再フォロー候補へ戻す日数';
comment on column public.store_customer_management_settings.followup_lost_refollow_days is
  '再来店フォローで失注（resolved_lost）時に再フォロー候補へ戻す日数';

commit;
