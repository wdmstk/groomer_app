begin;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_key text not null,
  channel text not null check (channel in ('line', 'phone', 'manual', 'email')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  unique (store_id, template_key, channel)
);

create index if not exists idx_notification_templates_store_key
  on public.notification_templates(store_id, template_key, channel);

alter table public.notification_templates enable row level security;

drop policy if exists notification_templates_select_store on public.notification_templates;
create policy notification_templates_select_store
on public.notification_templates
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists notification_templates_insert_store on public.notification_templates;
create policy notification_templates_insert_store
on public.notification_templates
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists notification_templates_update_store on public.notification_templates;
create policy notification_templates_update_store
on public.notification_templates
for update to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists notification_templates_delete_store on public.notification_templates;
create policy notification_templates_delete_store
on public.notification_templates
for delete to authenticated
using (store_id in (select public.current_user_store_ids()));

insert into public.notification_templates (store_id, template_key, channel, subject, body)
select
  stores.id,
  'slot_reoffer_line',
  'line',
  'キャンセル枠のご案内',
  '{{customer_name}}様
キャンセル枠がご案内可能になりました。

日時: {{appointment_range}}
メニュー: {{menu}}
対象: {{pet_name}}

{{note}}
先着順のため、埋まり次第ご案内終了となります。'
from public.stores
on conflict (store_id, template_key, channel) do nothing;

insert into public.notification_templates (store_id, template_key, channel, subject, body)
select
  stores.id,
  'followup_line',
  'line',
  '再来店フォロー',
  '{{customer_name}}様
いつもありがとうございます。前回ご来店日（{{last_visit_date}}）から45日が経過したため、ご連絡しました。
次回のおすすめ来店日は {{recommended_date}} 前後です。ご都合の良い日時をご連絡ください。'
from public.stores
on conflict (store_id, template_key, channel) do nothing;

insert into public.notification_templates (store_id, template_key, channel, subject, body)
select
  stores.id,
  'reminder_line',
  'line',
  '前日リマインド',
  '{{customer_name}}様、明日のトリミング予約のご案内です。
店舗: {{store_name}}
日時: {{appointment_range}}
メニュー: {{menu}}
ご来店を心よりお待ちしております。'
from public.stores
on conflict (store_id, template_key, channel) do nothing;

insert into public.notification_templates (store_id, template_key, channel, subject, body)
select
  stores.id,
  'reminder_email',
  'email',
  '【リマインド】明日のご予約について: {{menu}}',
  '{{customer_name}}様

明日のトリミング予約のご案内です。
店舗: {{store_name}}
日時: {{appointment_range}}
メニュー: {{menu}}

ご来店を心よりお待ちしております。'
from public.stores
on conflict (store_id, template_key, channel) do nothing;

insert into public.notification_templates (store_id, template_key, channel, subject, body)
select
  stores.id,
  'hotel_stay_report_line',
  'line',
  '宿泊レポート',
  '{{customer_name}}様
{{pet_name}}ちゃんの宿泊レポートをお送りします。

現在ステータス: {{stay_status}}
チェックイン予定: {{planned_check_in_at}}
チェックアウト予定: {{planned_check_out_at}}

{{report_body}}

ご不明点があれば店舗までご連絡ください。'
from public.stores
on conflict (store_id, template_key, channel) do nothing;

commit;
