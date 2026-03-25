# POS 移行/初期設定手順（TASK-POS-006）

## 目的
- 既存店舗にPOS機能を安全導入するための、初期設定と確認手順を統一する。

## 1. 事前確認
1. バックアップ取得（DBスナップショット）
2. 適用順の確認
- `supabase_multistore_migration.sql`
- `supabase_multistore_rls.sql`
- `supabase_inventory_management.sql`
- `supabase_invoices_unified_checkout.sql`
- `supabase/supabase_pos_core.sql`
3. パイロット店舗IDを確定

## 2. SQL適用
1. Supabase SQL Editor で `supabase/supabase_pos_core.sql` を実行
2. 実行後に以下を確認
```sql
select to_regclass('public.pos_sessions') as pos_sessions,
       to_regclass('public.pos_orders') as pos_orders,
       to_regclass('public.pos_payments') as pos_payments,
       to_regclass('public.pos_refunds') as pos_refunds,
       to_regclass('public.cash_drawer_events') as cash_drawer_events;
```

## 3. 初期データ/運用設定
1. 商品マスタ（`inventory_items`）に会計対象商品を登録
2. 予約と顧客が会計対象店舗で作成できることを確認
3. 会計担当者へ運用ルールを共有
- 開局前に会計しない
- 取消は領収書画面から実施
- 締めは当日最終会計後に1回のみ実施

## 4. パイロット店舗の受入確認
1. [POS UATチェックリスト](./pos-uat-checklist.md) を実施
2. `pass` 判定後に対象店舗を拡大

## 5. ロールバック方針
1. 画面導線を停止（POS運用を一時停止）
2. 以後の会計は既存導線（レガシー会計）へ切替
3. 追加データは削除せず保持（監査証跡優先）
4. 原因調査後、再開局条件を定義して再リリース
