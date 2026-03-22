# Invoice Unified Checkout API Contract

Task ID: `TASK-401`

## Goal
同一タイミングのトリミング予約とホテル滞在を1回の会計で確定できるようにする。

## Core Model
- `invoices`: 請求ヘッダ
- `invoice_lines`: 請求明細
- `payments`: 入金記録（`invoice_id` を参照）

## Source Mapping
- トリミング明細: `source_type=appointment_menu`, `source_id=appointment_menus.id`
- ホテル明細: `source_type=hotel_stay_item`, `source_id=hotel_stay_items.id`
- 調整行: `source_type=manual_adjustment`, `source_id=NULL`

## Endpoints

### 1) POST `/api/invoices`
新規請求を作成。

Request (JSON):
```json
{
  "customer_id": "uuid",
  "appointment_ids": ["uuid"],
  "hotel_stay_ids": ["uuid"],
  "notes": "任意"
}
```

Response 201:
```json
{
  "invoice": {
    "id": "uuid",
    "status": "open",
    "customer_id": "uuid",
    "subtotal_amount": 12000,
    "tax_amount": 1091,
    "discount_amount": 0,
    "total_amount": 12000
  }
}
```

Validation:
- 同一 `store_id` 内データのみ許可
- `appointment_ids` / `hotel_stay_ids` は同一 `customer_id` に解決できること
- すでに他 `open|paid` invoice に紐づく source は重複追加不可

### 2) GET `/api/invoices/:invoice_id`
請求詳細（ヘッダ + 明細）取得。

Response 200:
```json
{
  "invoice": {
    "id": "uuid",
    "status": "open",
    "customer_id": "uuid",
    "subtotal_amount": 12000,
    "tax_amount": 1091,
    "discount_amount": 500,
    "total_amount": 11500,
    "lines": [
      {
        "id": "uuid",
        "source_type": "appointment_menu",
        "source_id": "uuid",
        "label": "シャンプー",
        "quantity": 1,
        "unit_amount": 6000,
        "line_total": 6000
      }
    ]
  }
}
```

### 3) PATCH `/api/invoices/:invoice_id`
割引・備考・状態を更新。

Request (JSON):
```json
{
  "discount_amount": 500,
  "notes": "メモ",
  "status": "open"
}
```

Rules:
- `paid` は `void` に戻せない（返金フローは別API）
- `paid` 後は明細編集不可

### 4) POST `/api/invoices/:invoice_id/pay`
請求を支払い確定。

Request (Form or JSON):
```json
{
  "method": "現金",
  "idempotency_key": "uuid",
  "notes": "任意"
}
```

Behavior:
- `payments` に1レコード作成（`appointment_id` は代表予約IDまたはNULL移行段階）
- `invoices.status` を `paid` に更新
- `paid_at` 設定
- 既存の来店履歴連携は段階移行中は従来処理を維持

### 5) POST `/api/invoices/:invoice_id/lines`
手動調整明細を追加。

Request:
```json
{
  "label": "時間延長",
  "quantity": 1,
  "unit_amount": 1000,
  "tax_rate": 0.1,
  "tax_included": true
}
```

## UI Integration
- `/hotel`: 選択予約に `統合会計へ` ボタンを追加
- `/ops/today`: 顧客単位で `統合会計` ボタンを表示
- `/payments`: 新規登録は `invoice` 選択ベースへ段階移行

## Migration Strategy
1. `invoices` / `invoice_lines` を先行追加
2. 既存 `payments` を 1:1 で `invoices` にバックフィル
3. 既存フローは維持しつつ内部で `invoice_id` を生成
4. UIとレシートを `invoice` 主体へ切替

## Error Codes
- `INVOICE_SCOPE_MISMATCH`: store/customer 不整合
- `INVOICE_SOURCE_ALREADY_LINKED`: source 二重紐付け
- `INVOICE_NOT_EDITABLE`: paid/void で編集不可
- `INVOICE_PAY_DUPLICATED`: idempotency 重複
