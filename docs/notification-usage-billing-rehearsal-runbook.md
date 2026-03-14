# 通知従量課金 リハーサル/本番開始 Runbook（OP-2026-05-05）

## 目的
1. 月次請求計算を本番反映前に検証する。
2. 再計算で同一結果になることを確認する。
3. 問題がないことを確認して本番反映（commit）する。

## 実行API
1. `POST /api/admin/billing/notification-usage/rehearsal`
2. 実行権限: `requireDeveloperAdmin` を通過するサポート管理者

## リクエスト例
```json
{
  "targetMonthJst": "2026-02",
  "commit": false
}
```

## パラメータ
1. `targetMonthJst`（必須）: `YYYY-MM`
2. `commit`（任意）: `true` で本番反映。省略または `false` はドライラン。
3. `targetStoreIds`（任意）: 対象店舗を絞る `store_id` 配列。

## 実行フロー
1. ドライラン実行（`commit=false`）
2. レスポンスの `storeSummaries` を確認
3. `notification_usage_billing_monthly` の既存値と比較
4. 差異なしなら commit 実行（`commit=true`）
5. `billing_operations.operation_type=notification_usage_billing_calculated` が記録されたことを確認

## チェック項目
1. `dryRun=true` 時に `insertedOperations=0` であること
2. 同条件で再実行して `storeSummaries` が一致すること
3. `commit=true` 実行後に `month_jst` の upsert が反映されること
4. commit 再実行時に `insertedOperations` が増えないこと（冪等）

## 障害時
1. API失敗時は `message` を確認
2. 対象月と対象店舗を絞って再実行
3. 差異が解消しない場合は `customer_notification_logs` の集計条件を確認

## 本番開始判定
1. サンプル店舗でドライランと再計算結果が一致
2. commit 実行後の `notification_usage_billing_monthly` と `billing_operations` が整合
3. 失敗イベントが残っていない（必要ならWebhook再処理を先に実施）
