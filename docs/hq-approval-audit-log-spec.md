# 本部承認フロー監査ログ仕様（OP-2026-08-03）

## 対象
1. `POST /api/hq/menu-templates`
2. `POST /api/hq/menu-template-deliveries/[delivery_id]/approve`

## 監査ログテーブル拡張
1. `audit_logs.actor_scope` を追加（`store` / `hq`）
2. 本部操作は `actor_scope='hq'` を記録

## 記録イベント
1. `hq_menu_template_delivery_requested`
2. `hq_menu_template_delivery_approval_recorded`
3. `hq_menu_template_delivery_rejected`
4. `hq_menu_template_delivery_waiting_remaining_approvals`
5. `hq_menu_template_delivery_apply_failed`
6. `hq_menu_template_delivery_applied`

## 共通レコード方針
1. `entity_type`: `hq_menu_template_delivery`
2. `entity_id`: `hq_menu_template_deliveries.id`
3. `store_id`: 操作主体の対象店舗（承認時は `storeId`）
4. `payload.actor_scope`: `hq`（後方互換のため併記）

## 運用確認SQL
```sql
select created_at, store_id, actor_user_id, actor_scope, action, payload
from public.audit_logs
where actor_scope = 'hq'
  and entity_type = 'hq_menu_template_delivery'
order by created_at desc
limit 100;
```
