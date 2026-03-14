# 通知リマインド運用手順（OP-2026-04-05）

## 目的
- 通知設定追加後のE2E確認手順と、本番反映時の運用手順を標準化する。

## 対象
- 通知設定画面: `/settings/notifications`
- 通知テンプレAPI: `/api/notification-templates`
- リマインドCron: `/api/cron/remind-appointments`

## 事前準備
1. `store_notification_settings` マイグレーションを適用する。
2. `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `RESEND_API_KEY` を設定する。
3. テスト対象店舗に、以下データを用意する。
   - 顧客（`line_id` あり、`email` あり）
   - 予約（`status=予約済`、当日または翌日開始）
   - 通知テンプレ（`reminder_line` / `reminder_email`）

## E2E確認手順

### A. 設定保存確認
1. `/settings/notifications` を開く。
2. 前日/当日の時刻、チャネルON/OFF、上限値を変更して保存する。
3. `store_notification_settings` に反映されることを確認する。

### B. テンプレ送信確認
1. 同ページのテンプレ管理でテスト送信先を入力する。
2. LINE/メールのテスト送信を実行する。
3. `customer_notification_logs` に `notification_type=test_send` が記録されることを確認する。

### C. Cron送信確認（前日/当日）
1. 該当時刻（JST）に合わせて `/api/cron/remind-appointments` を実行する。
2. 対象予約に対して `customer_notification_logs` が `queued -> sent` になることを確認する。
3. 実行メタに `scannedByTiming` / `sentByTiming` が出力されることを確認する。

### D. dedupe確認
1. 同一時刻に `/api/cron/remind-appointments` を再実行する。
2. 同一 `dedupe_key` で二重送信されないことを確認する。

### E. チャネル無効化確認
1. 通知設定で `reminder_line_enabled=false` を保存する。
2. Cron実行時にLINE送信が行われず、スキップカウンタに反映されることを確認する。

## 本番反映手順
1. DB反映
   - `supabase_store_notification_settings.sql` を適用
2. アプリ反映
   - API/画面を含むアプリをデプロイ
3. 反映直後確認
   - `/settings/notifications` が表示できる
   - 保存APIが200を返す
4. Cron確認
   - ステージング店舗で1回実行し、ログ反映を確認
5. 監視
   - 初週は `customer_notification_logs` の失敗率を日次確認

## 障害時の一次対応
1. 送信失敗率が急上昇した場合
   - LINE/Resendの資格情報と外部障害有無を確認
2. 重複送信が発生した場合
   - `dedupe_key` 生成ルール変更有無を確認
3. 設定保存不可の場合
   - `store_notification_settings` のRLSとロールを確認

## ロールバック方針
1. 重大障害時は通知設定でチャネルを一括OFF（LINE/Email）にする。
2. 必要に応じてCron実行を一時停止する。
3. 根本原因修正後に段階的にONへ戻す。
