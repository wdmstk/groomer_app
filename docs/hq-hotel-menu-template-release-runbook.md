# 本部ホテルメニューテンプレ配信 テスト & リリース Runbook（2026-03-23）

## 目的
1. ホテルメニュー向けテンプレ配信（リクエスト/承認/適用）が本番前に正常動作することを確認する。
2. 権限境界（owner/admin/staff）と店舗スコープ越境がないことを確認する。

## 対象
1. `/hq/hotel-menu-templates`
2. `/hq/hotel-menu-template-deliveries`
3. `/api/hq/hotel-menu-templates`
4. `/api/hq/hotel-menu-template-deliveries`
5. `/api/hq/hotel-menu-template-deliveries/[delivery_id]/approve`
6. `audit_logs`（`actor_scope='hq'` / `entity_type='hq_hotel_menu_template_delivery'`）
7. `hq_hotel_menu_template_deliveries`
8. `hq_hotel_menu_template_delivery_approvals`
9. `hotel_menu_items`

## 事前準備
1. `supabase_hq_hotel_menu_template_deliveries.sql` を適用済み
2. `hotel_menu_items` が source/target 店舗に存在する
3. テスト用ユーザー
   - owner（2店舗以上、Pro + hotel option有効）
   - admin（2店舗以上、Pro + hotel option有効）
   - staff（1店舗以上）

## 本番SQL適用手順
1. 実行前バックアップ
   - `hq_hotel_menu_template_deliveries` / `hq_hotel_menu_template_delivery_approvals` は新規だが、念のため `audit_logs` と `store_memberships` の参照整合を確認する。
2. メンテ判断
   - 書き込み停止は不要（新規テーブル作成のみ）が、業務低負荷時間帯に実施する。
3. SQL適用
   - Supabase SQL Editor で `supabase/supabase_hq_hotel_menu_template_deliveries.sql` をそのまま実行する。
4. 適用直後確認
   - テーブル作成確認:
```sql
select to_regclass('public.hq_hotel_menu_template_deliveries') as deliveries,
       to_regclass('public.hq_hotel_menu_template_delivery_approvals') as approvals;
```
   - RLS有効確認:
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'hq_hotel_menu_template_deliveries',
    'hq_hotel_menu_template_delivery_approvals'
  );
```
5. API疎通確認（owner）
   - `GET /api/hq/hotel-menu-template-deliveries` が 200
   - `POST /api/hq/hotel-menu-templates` が 200
6. 問題発生時
   - 新規機能導線を非表示化し、APIを前バージョンへ戻す（テーブルは保持して調査）。

## UIチェック
1. owner
   - 本部運用に `ホテルテンプレ配信リクエスト` / `ホテルテンプレ配信承認` が表示される
   - `/hq/hotel-menu-templates` で配信リクエスト作成が可能
2. admin
   - `ホテルテンプレ配信承認` は表示される
   - `ホテルテンプレ配信リクエスト` は表示されない（ownerのみ）
3. staff
   - `/hq/*` 非表示または403

## APIチェック
1. owner
   - `GET /api/hq/hotel-menu-templates` = 200
   - `POST /api/hq/hotel-menu-templates` = 200
   - `GET /api/hq/hotel-menu-template-deliveries` = 200
   - `POST /api/hq/hotel-menu-template-deliveries/[delivery_id]/approve` = 200
2. admin
   - `GET /api/hq/hotel-menu-template-deliveries` = 200
   - `POST /api/hq/hotel-menu-template-deliveries/[delivery_id]/approve` = 403
3. staff
   - 上記APIは 403

## 配信フローE2E
1. owner(A)で配信リクエスト作成
   - source: 店舗A
   - target: 店舗B, 店舗C
   - overwriteScope: `price_duration_only`
2. owner(B)で承認
   - 返却 `status` が `pending`
3. owner(C)で承認
   - 返却 `status` が `applied`
4. `hotel_menu_items` の target 店舗に適用されていることを確認
   - 一致キー: `lower(trim(item_type)) + '::' + lower(trim(name))`
   - `price_duration_only` は `price` / `duration_minutes` のみ更新
   - `full` は主要属性を更新

## 拒否フロー
1. owner(B)が `decision='rejected'` で承認API実行
2. `hq_hotel_menu_template_deliveries.status='rejected'` を確認
3. `last_error` にコメントまたは拒否メッセージが残ることを確認

## 店舗スコープ境界
1. 所属外 `storeId` を source/target に指定して `POST /api/hq/hotel-menu-templates`
   - 期待: 403
2. 対象外 `storeId` で承認
   - 期待: 400 または 403

## 監査ログ確認SQL
```sql
select created_at, store_id, actor_user_id, actor_scope, entity_type, action, payload
from public.audit_logs
where actor_scope = 'hq'
  and entity_type = 'hq_hotel_menu_template_delivery'
order by created_at desc
limit 100;
```

## 配信テーブル確認SQL
```sql
select id, source_store_id, target_store_ids, overwrite_scope, status, applied_at, last_error, created_at
from public.hq_hotel_menu_template_deliveries
order by created_at desc
limit 50;
```

```sql
select delivery_id, store_id, approver_user_id, approver_role, status, comment, updated_at
from public.hq_hotel_menu_template_delivery_approvals
order by updated_at desc
limit 100;
```

## リリース判定
1. UI/API/配信フロー/拒否フロー/スコープ境界の全ケース成功
2. 本来403のケースで200が出ない
3. 監査ログが欠落しない

## ロールバック
1. 本部メニューからホテル版リンクを一時非表示
2. API差分を直前安定版へ戻す
3. 影響deliveryを `status` / `last_error` / `audit_logs` で追跡して店舗連絡

## 実施結果記録テンプレ
```md
# 本部ホテルメニューテンプレ配信 リリース確認記録

- 実施日: YYYY-MM-DD
- 実施者: 
- 環境: local / staging / production
- 対象リビジョン: (branch / commit hash)
- SQL適用: 未/済（`supabase_hq_hotel_menu_template_deliveries.sql`）

## 1. UIチェック
- owner: OK / NG
- admin: OK / NG
- staff: OK / NG
- 証跡URL/スクショ:

## 2. APIチェック
- GET /api/hq/hotel-menu-templates: OK / NG
- POST /api/hq/hotel-menu-templates: OK / NG
- GET /api/hq/hotel-menu-template-deliveries: OK / NG
- POST /api/hq/hotel-menu-template-deliveries/[delivery_id]/approve: OK / NG
- 証跡（ログ/レスポンス）:

## 3. 配信フローE2E
- request作成: OK / NG
- 途中承認（pending）: OK / NG
- 最終承認（applied）: OK / NG
- `hotel_menu_items` 反映確認: OK / NG
- 証跡（delivery_id / SQL結果）:

## 4. 拒否フロー
- rejected遷移: OK / NG
- last_error記録: OK / NG
- 証跡:

## 5. 店舗スコープ境界
- 所属外source/targetで403: OK / NG
- 対象外storeId承認を拒否: OK / NG
- 証跡:

## 6. 監査ログ
- entity_type=`hq_hotel_menu_template_delivery` 記録: OK / NG
- action欠落なし: OK / NG
- 証跡（SQL結果）:

## 総合判定
- 判定: GO / NO-GO
- 判定理由:
- 残課題:
- フォロー担当:
```
