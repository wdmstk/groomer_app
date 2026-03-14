begin;

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
