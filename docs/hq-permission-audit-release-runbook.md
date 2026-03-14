# 本部権限監査テスト & リリース Runbook（OP-2026-08-05）

## 目的
1. 本部機能の権限境界（owner/admin/staff）に越境がないことを本番前に確認する。
2. リリース可否を同じ基準で判定できるようにする。

## 対象
1. `/hq`
2. `/hq/menu-templates`
3. `/hq/menu-template-deliveries`
4. `/api/hq/menu-templates`
5. `/api/hq/menu-template-deliveries`
6. `/api/hq/menu-template-deliveries/[delivery_id]/approve`
7. `audit_logs`（`actor_scope='hq'`）

## 事前準備
1. `supabase_hq_kpi_views.sql` 適用済み
2. `supabase_audit_logs_actor_scope.sql` 適用済み
3. テスト用ユーザーを3種準備
   - owner（2店舗以上）
   - admin（2店舗以上）
   - staff（1店舗以上）

## 権限監査テスト

### A. UIアクセス
1. owner: `/hq`, `/hq/menu-templates`, `/hq/menu-template-deliveries` が表示される
2. admin: `/hq`, `/hq/menu-template-deliveries` は表示、`/hq/menu-templates` は閲覧のみ
3. staff: `/hq/*` は非表示または403

### B. APIアクセス
1. owner
   - `GET /api/hq/menu-templates`: 200
   - `POST /api/hq/menu-templates`: 200
   - `GET /api/hq/menu-template-deliveries`: 200
   - `POST /api/hq/menu-template-deliveries/[delivery_id]/approve`: 200
2. admin
   - `GET /api/hq/menu-templates`: 200
   - `POST /api/hq/menu-templates`: 403
   - `GET /api/hq/menu-template-deliveries`: 200
   - `POST /api/hq/menu-template-deliveries/[delivery_id]/approve`: 403
3. staff
   - `/api/hq/*`: 403

### C. 店舗スコープ境界
1. 所属外 `store_id` を source/target に指定して `POST /api/hq/menu-templates` すると 403
2. 所属外店舗の delivery 承認を試行すると 403

### D. 監査ログ
1. owner で配信リクエスト作成し、`hq_menu_template_delivery_requested` が記録される
2. 承認/拒否/適用時に `actor_scope='hq'` のイベントが記録される
3. `entity_type='hq_menu_template_delivery'` で追跡できる

## 監査SQL
```sql
select created_at, store_id, actor_user_id, actor_scope, action, payload
from public.audit_logs
where actor_scope = 'hq'
  and entity_type = 'hq_menu_template_delivery'
order by created_at desc
limit 100;
```

## リリース判定
1. A〜D のテストがすべて成功
2. 403 を返すべきケースで 200 が1件もない
3. 本部操作に対応する監査ログが欠落していない

## ロールバック
1. 本部導線を一時的に非表示化（`/hq/*` へのリンクを切る）
2. 必要時に本部APIをデプロイ前バージョンへ戻す
3. 監査ログの異常は `actor_scope='hq'` で抽出し、影響範囲を切り分ける
