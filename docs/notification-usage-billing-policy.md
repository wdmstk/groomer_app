# 通知従量課金ルール（OP-2026-05-01）

## 目的
- 通知強化オプションにおける従量課金の判定条件と請求計算ルールを固定する。

## 適用対象
1. チャネル: `line`（初期）
2. 通知種別: `reminder`, `followup`, `slot_reoffer`
3. ログ基準: `customer_notification_logs`

## 課金判定
1. 課金対象は `status = sent` のみ
2. `notification_type = test_send` は課金対象外
3. 同一 `dedupe_key` の重複送信は1通として計上
4. `queued`, `failed`, `canceled` は課金対象外

## 料金ルール
1. 標準プラン月次上限: 1,000通
2. 通知強化オプション月次上限: 3,000通
3. 従量課金単価: 3円 / 通
4. 従量課金は「上限超過分」のみ

## 締めと請求期間
1. 請求期間は日本時間（JST）で当月1日 00:00:00 から末日 23:59:59
2. 請求確定は翌月初日のバッチで算出
3. 返金/調整が必要な場合は `billing_operations` に調整記録を残す

## 請求計算式
1. `billable_count = max(0, sent_count - monthly_limit)`
2. `amount_jpy = billable_count * 3`

## 集計仕様（実装前提）
1. 集計キー: `store_id`, `month_jst`
2. 契約状態は `store_subscriptions.notification_option_enabled` を参照する
3. 通知強化オプション契約中は `monthly_limit_with_option` を上限として使用
4. 未契約時は `monthly_limit` を使用
5. 月次確定値は再計算可能な形で保存する

## 監査要件
1. 集計元ログ件数と請求件数の突合が可能であること
2. 店舗別の請求内訳（対象期間、送信数、上限、超過数、金額）を追跡可能にすること

## 除外条件
1. 開発者手動送信
2. テスト送信
3. 障害復旧時の再送で、同一 `dedupe_key` を持つ重複分

## 変更管理
1. 単価・上限・対象種別の変更は月初適用を原則とする
2. 月中変更時は旧ルール・新ルールの適用境界日時を明記する
