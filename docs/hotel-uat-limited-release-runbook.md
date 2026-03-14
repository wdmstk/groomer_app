# ペットホテル UAT/限定リリース Runbook（OP-2026-06-05）

## 目的
1. ホテル機能のUATを実施し、運用可能性を確認する。
2. 限定店舗のみ有効化して段階リリースする。

## 前提
1. `supabase_hotel_management_base.sql` 適用済み
2. `/hotel` UI と `/api/hotel/stays*` API デプロイ済み
3. `HOTEL_ENABLED_STORE_IDS` を設定可能

## 限定リリース設定
1. 対象店舗の `store_id` を確認する。
2. 環境変数 `HOTEL_ENABLED_STORE_IDS` にカンマ区切りで設定する。
3. 全店舗有効化時のみ `*` を設定する。

## UATシナリオ
1. 新規作成: 顧客選択でペット候補が連動すること。
2. 料金計算: 料金ルール選択で明細・合計が生成されること。
3. 更新: チェックイン/アウト時刻更新で延長料金が再計算されること。
4. 削除: 台帳削除で一覧から消えること。
5. 権限: 対象外店舗では `/hotel` が利用不可メッセージになること。

## 検証SQL例
```sql
select id, stay_code, status, total_amount_jpy
from public.hotel_stays
where store_id = '<target_store_id>'
order by created_at desc
limit 20;
```

```sql
select stay_id, charge_type, label, line_amount_jpy
from public.hotel_charges
where store_id = '<target_store_id>'
order by created_at desc
limit 50;
```

## リリース判定
1. UATシナリオ全件成功
2. 重大障害なし
3. 店舗オペレーションで日次運用可能

## ロールバック
1. `HOTEL_ENABLED_STORE_IDS` から対象店舗を除外する。
2. 必要なら空値にして全店舗無効化する。
