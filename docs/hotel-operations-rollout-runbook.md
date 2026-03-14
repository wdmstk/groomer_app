# ペットホテル運用展開 Runbook（OP-2026-07-05）

## 目的
1. 送迎管理、ワクチン期限通知、宿泊レポート送信を含むホテル機能の通し検証を標準化する。
2. 本番展開時の確認ポイントとロールバック手順を明確化する。

## 対象範囲
1. UI: `/hotel`
2. API: `/api/hotel/stays*`, `/api/hotel/transports*`, `/api/hotel/stays/[stay_id]/report-line`
3. Cron: `/api/cron/hotel-vaccine-alerts`

## 事前準備
1. SQL適用
   - `supabase_hotel_management_base.sql`
   - `supabase_hotel_transports.sql`
   - `supabase_notification_templates.sql`
   - `supabase_hotel_stay_report_template.sql`
2. 環境変数
   - `HOTEL_ENABLED_STORE_IDS`（限定公開の対象店舗を設定）
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
3. テストデータ
   - `line_id` 登録済み顧客
   - 顧客に紐づくペット
   - `vaccine_expires_on` 設定済みのホテル台帳

## 通し検証シナリオ

### A. 台帳作成と顧客/ペット連動
1. `/hotel` で新規台帳を作成する。
2. 顧客を選ぶとペット候補が絞り込まれることを確認する。
3. 保存後、台帳一覧と詳細が更新されることを確認する。

### B. 送迎管理フロー
1. 迎え/送りの送迎ステータスを `pending -> scheduled -> completed` に更新する。
2. 予定時刻・担当ID・メモを保存する。
3. 再読込後に状態が保持されることを確認する。

### C. ワクチン期限表示と通知
1. 台帳の `vaccine_expires_on` を当日/7日以内/期限超過で切り替える。
2. `/hotel` 画面の残日数表示が想定どおり変化することを確認する。
3. `/api/cron/hotel-vaccine-alerts` 実行後、`customer_notification_logs` に `kind=hotel_vaccine_expiry` が記録されることを確認する。

### D. 宿泊レポート送信
1. 宿泊レポート本文を入力してLINE送信する。
2. `customer_notification_logs` が `queued -> sent` で更新されることを確認する。
3. 同一本文で同日再送した場合に重複拒否されること（409）を確認する。

## 検証SQL
```sql
select id, stay_code, status, customer_id, pet_id, vaccine_expires_on, total_amount_jpy
from public.hotel_stays
where store_id = '<target_store_id>'
order by created_at desc
limit 20;
```

```sql
select id, stay_id, transport_type, status, scheduled_at, completed_at, canceled_at
from public.hotel_transports
where store_id = '<target_store_id>'
order by updated_at desc
limit 20;
```

```sql
select created_at, channel, notification_type, status, dedupe_key, payload
from public.customer_notification_logs
where store_id = '<target_store_id>'
  and (
    payload->>'kind' = 'hotel_vaccine_expiry'
    or payload->>'kind' = 'hotel_stay_report'
  )
order by created_at desc
limit 50;
```

## 本番展開手順
1. SQLを本番へ適用する。
2. アプリを本番デプロイする。
3. 限定対象店舗の `HOTEL_ENABLED_STORE_IDS` を設定し、反映する。
4. 店舗1件で通し検証シナリオ A〜D を実施する。
5. `hotel-vaccine-alerts` Cronを1回手動実行し、実行結果と通知ログを確認する。
6. 問題がなければ対象店舗を段階的に追加する。

## リリース判定
1. 通し検証シナリオ A〜D がすべて成功。
2. `customer_notification_logs` で `failed` が連続発生していない。
3. 送迎・通知・レポートの主要導線で重大障害（P1/P0）がない。

## ロールバック
1. `HOTEL_ENABLED_STORE_IDS` から対象店舗を除外する。
2. 必要に応じて `HOTEL_ENABLED_STORE_IDS` を空にして全店舗無効化する。
3. 宿泊レポート送信のみ停止する場合は `notification_templates` の `hotel_stay_report_line.is_active=false` を設定する。
