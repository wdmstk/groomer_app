# POS Data Model & API Contract

Task ID: `TASK-POS-002`  
Parent Task: `TASK-408`

## 1. Goal
- POS伝票、会計確定、取消/返金、日次締めを既存会計・在庫基盤に統合するための最小データ契約を定義する。

## 2. Core Data Model

### 2.1 `pos_sessions`
- 用途: レジ開局〜締めのセッション管理
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `opened_at` (timestamptz)
  - `closed_at` (timestamptz, nullable)
  - `status` (`open|closed`)
  - `opened_by_user_id` (uuid)
  - `closed_by_user_id` (uuid, nullable)

### 2.2 `pos_orders`
- 用途: POS伝票ヘッダ
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `session_id` (uuid, nullable)
  - `customer_id` (uuid, nullable)
  - `appointment_id` (uuid, nullable, `appointments.id`)
  - `status` (`draft|confirmed|void|refunded`)
  - `subtotal_amount` (numeric)
  - `tax_amount` (numeric)
  - `discount_amount` (numeric)
  - `total_amount` (numeric)
  - `confirmed_at` (timestamptz, nullable)
  - `payment_id` (uuid, nullable, `payments.id`)
  - `invoice_id` (uuid, nullable, `invoices.id`)

### 2.3 `pos_order_lines`
- 用途: POS伝票明細
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `order_id` (uuid)
  - `line_type` (`service|product|manual_adjustment`)
  - `source_id` (uuid, nullable)
  - `label` (text)
  - `quantity` (numeric)
  - `unit_amount` (numeric)
  - `tax_rate` (numeric)
  - `tax_included` (boolean)
  - `line_subtotal` (numeric)
  - `line_tax` (numeric)
  - `line_total` (numeric)
  - `metadata` (jsonb)

### 2.4 `pos_payments`
- 用途: POS観点の支払情報（`payments`への接続情報を保持）
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `order_id` (uuid)
  - `payment_id` (uuid, `payments.id`)
  - `method` (text)
  - `idempotency_key` (text, unique per store)
  - `paid_at` (timestamptz)

### 2.5 `pos_refunds`
- 用途: 取消/返金記録
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `order_id` (uuid)
  - `refund_type` (`void|refund`)
  - `amount` (numeric)
  - `reason` (text)
  - `refunded_at` (timestamptz)
  - `refunded_by_user_id` (uuid)

### 2.6 `cash_drawer_events`
- 用途: 現金入出金履歴
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `session_id` (uuid)
  - `event_type` (`cash_in|cash_out|adjustment`)
  - `amount` (numeric)
  - `reason` (text)
  - `happened_at` (timestamptz)

## 3. Existing Table Integration
- `payments`: 会計確定の最終ソース。`pos_orders.payment_id` と `pos_payments.payment_id` で接続。
- `invoices` / `invoice_lines`: サービス会計統合用途で接続。POS物販明細は `invoice_lines.source_type=pos_product` 拡張を想定。
- `inventory_movements`: `line_type=product` の確定時に `outbound` 作成。取消時に逆仕訳を作成。

## 3.1 Draft SQL
- たたき台SQL: `supabase/supabase_pos_core.sql`
- 含む内容:
  - `pos_sessions` / `pos_orders` / `pos_order_lines` / `pos_payments` / `pos_refunds` / `cash_drawer_events`
  - `invoice_lines.source_type` への `pos_product` 追加
  - 上記新規テーブルのRLS policy一式
  - 制約:
    - `pos_sessions` の開閉整合（open時は`closed_at`なし、closed時は`closed_at`必須）
    - `pos_orders` / `pos_order_lines` の金額・数量下限制約
    - `pos_payments` の `action_type='confirm'` は1伝票1回
    - `pos_refunds` の `refund_type='void'` は1伝票1回

## 4. API Contract (v1)

### 4.0 共通レスポンス形式
- 成功時:
```json
{
  "ok": true,
  "data": {}
}
```
- 失敗時:
```json
{
  "ok": false,
  "code": "POS_ORDER_NOT_FOUND",
  "message": "order not found."
}
```

### 4.0.1 HTTPステータス方針
- `200`: 正常取得/更新
- `201`: 新規作成
- `400`: 入力不正
- `401`: 未認証
- `403`: 権限不足/店舗スコープ外
- `404`: 対象なし
- `409`: 状態競合（編集不可、締め済み取消など）
- `422`: 在庫不足などドメインバリデーション
- `500`: 想定外エラー

### 4.1 `POST /api/pos/orders`
- 目的: POS伝票作成（draft）
- Request:
```json
{
  "customer_id": "uuid-or-null",
  "appointment_id": "uuid-or-null",
  "session_id": "uuid-or-null",
  "lines": [
    {
      "line_type": "product",
      "source_id": "inventory_item_uuid",
      "label": "シャンプー",
      "quantity": 1,
      "unit_amount": 1800,
      "tax_rate": 0.1,
      "tax_included": true
    }
  ],
  "discount_amount": 0
}
```
- Response 201:
```json
{
  "ok": true,
  "data": {
    "order": {
      "id": "uuid",
      "status": "draft",
      "subtotal_amount": 1636,
      "tax_amount": 164,
      "discount_amount": 0,
      "total_amount": 1800
    }
  }
}
```

### 4.2 `PATCH /api/pos/orders/:order_id`
- 目的: 伝票明細更新（draft時のみ）
- Rules:
  - `confirmed|void|refunded` は更新不可
  - 再計算後の金額を返却
- Response 200:
```json
{
  "ok": true,
  "data": {
    "order": {
      "id": "uuid",
      "status": "draft",
      "subtotal_amount": 3000,
      "tax_amount": 273,
      "discount_amount": 200,
      "total_amount": 2800
    }
  }
}
```

### 4.3 `POST /api/pos/orders/:order_id/confirm`
- 目的: 会計確定
- Request:
```json
{
  "method": "現金",
  "idempotency_key": "uuid",
  "notes": "任意"
}
```
- Behavior:
  - `payments` 生成（または既存再利用）
  - `pos_orders.status=confirmed`
  - `product` 明細在庫を `inventory_movements(outbound)` へ反映
- Rule:
  - 現行`payments`互換のため `appointment_id` と `customer_id` は必須（未指定時は `409 POS_APPOINTMENT_REQUIRED` / `POS_CUSTOMER_REQUIRED`）
- Response 200:
```json
{
  "ok": true,
  "data": {
    "order_id": "uuid",
    "status": "confirmed",
    "payment_id": "uuid",
    "receipt_path": "/receipts/uuid",
    "reused": false
  }
}
```

### 4.4 `POST /api/pos/orders/:order_id/void`
- 目的: 取消（未締めセッションのみ）
- Request:
```json
{
  "reason": "誤入力",
  "idempotency_key": "uuid"
}
```
- Behavior:
  - `pos_orders.status=void`（`confirmed` 伝票のみ取消可能）
  - `payments.status` を `取消` に更新
  - 在庫戻し仕訳（`inventory_movements.inbound`）を作成
  - `pos_refunds` 記録
  - 領収書画面（`/receipts/[payment_id]`）から実行可能
- Response 200:
```json
{
  "ok": true,
  "data": {
    "order_id": "uuid",
    "status": "void",
    "refund_id": "uuid"
  }
}
```

### 4.5 `POST /api/pos/sessions/open`
- 目的: レジ開局
- Response 201:
```json
{
  "ok": true,
  "data": {
    "session": {
      "id": "uuid",
      "status": "open",
      "opened_at": "2026-03-25T01:00:00.000Z"
    }
  }
}
```

### 4.6 `POST /api/pos/sessions/:session_id/close`
- 目的: レジ締め
- Request:
```json
{
  "cash_counted_amount": 50000,
  "note": "任意"
}
```
- Response 200:
```json
{
  "ok": true,
  "data": {
    "session_id": "uuid",
    "status": "closed",
    "closed_at": "2026-03-25T10:00:00.000Z",
    "summary": {
      "sales_total": 128000,
      "cash_expected": 52000,
      "cash_counted": 50000,
      "cash_diff": -2000
    }
  }
}
```

### 4.7 `POST /api/pos/cash-drawer-events`
- 目的: 現金入出金登録
- Response 201:
```json
{
  "ok": true,
  "data": {
    "event": {
      "id": "uuid",
      "event_type": "cash_in",
      "amount": 10000
    }
  }
}
```

## 4.8 状態遷移ルール
- `pos_orders.status`
  - `draft -> confirmed`
  - `draft -> void`
  - `confirmed -> refunded`（後続返金API）
  - `void|refunded` から他状態への遷移は禁止
- `pos_sessions.status`
  - `open -> closed`
  - `closed` から `open` へは戻さない（新規セッションを開く）

## 5. RLS/Authorization
- 全テーブルで `store_id in current_user_store_ids()` を適用。
- `void|refund|session_close` は `owner|admin` のみ許可。
- `staff` は `order create/update/confirm` と `receipt read` のみ許可。

## 6. Idempotency Rules
- `confirm` / `void` / `refund` は `idempotency_key` 必須。
- unique key: `(store_id, action_type, idempotency_key)`。
- 再送時は副作用を起こさず同一結果を返す。

## 7. Error Codes
- `POS_SCOPE_MISMATCH`
- `POS_ORDER_NOT_FOUND`
- `POS_ORDER_NOT_EDITABLE`
- `POS_OUT_OF_STOCK`
- `POS_CONFIRM_DUPLICATED`
- `POS_VOID_NOT_ALLOWED`
- `POS_SESSION_ALREADY_CLOSED`
- `POS_PAYMENT_METHOD_REQUIRED`
- `POS_INVALID_DISCOUNT_AMOUNT`
- `POS_SESSION_NOT_FOUND`

## 8. Migration Notes
- 先行でDDL追加 + RLS追加 + read API追加
- 次に confirm/voidのwrite API導入
- 最後にUIを段階切替（既存`/payments`互換を保ったまま）
