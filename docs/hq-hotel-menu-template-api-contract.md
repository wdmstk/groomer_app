# HQ Hotel Menu Template API Contract

## Endpoints

- `GET /api/hq/hotel-menu-templates`
- `POST /api/hq/hotel-menu-templates` (配信リクエスト作成)
- `GET /api/hq/hotel-menu-template-deliveries`
- `POST /api/hq/hotel-menu-template-deliveries/[delivery_id]/approve`

## Auth

- ログイン必須
- `GET /api/hq/hotel-menu-template-deliveries`: `store_memberships` の `owner/admin` が利用可（閲覧）
- 上記以外のホテルメニューテンプレ配信API: `store_memberships` の `owner` のみ利用可（操作）
- 追加条件: `Pro` かつ `hotel option` 有効店舗のみ対象

## 1) GET `/api/hq/hotel-menu-templates`

### Query

- `source_store_id` (optional)

### Response 200

```json
{
  "sourceStoreId": "store-id",
  "sourceMenus": [
    {
      "id": "...",
      "store_id": "...",
      "item_type": "stay_base",
      "name": "小型犬 1泊",
      "price": 6800,
      "billing_unit": "night",
      "default_quantity": 1,
      "duration_minutes": null,
      "counts_toward_capacity": true,
      "tax_rate": 0.1,
      "tax_included": true,
      "is_active": true,
      "display_order": 1,
      "notes": null
    }
  ],
  "stores": [
    { "id": "...", "name": "渋谷店", "isSource": true }
  ],
  "overwriteScopeOptions": ["price_duration_only", "full"]
}
```

## 2) POST `/api/hq/hotel-menu-templates`

テンプレ即時適用ではなく、配信リクエストを作成する。

### Request

```json
{
  "sourceStoreId": "source-store-id",
  "targetStoreIds": ["target-store-a", "target-store-b"],
  "overwriteScope": "price_duration_only"
}
```

### Response 200

```json
{
  "message": "ホテルメニューテンプレ配信リクエストを作成しました。owner 承認後に適用されます。",
  "delivery": {
    "id": "delivery-id",
    "source_store_id": "source-store-id",
    "target_store_ids": ["target-store-a"],
    "overwrite_scope": "price_duration_only",
    "status": "pending",
    "created_at": "2026-03-23T..."
  }
}
```

## 3) GET `/api/hq/hotel-menu-template-deliveries`

### Query

- `status` (optional, default: `all`)

### Response 200

`hq_hotel_menu_template_deliveries` の配信リクエスト一覧（最新100件）

## 4) POST `/api/hq/hotel-menu-template-deliveries/[delivery_id]/approve`

対象店舗ごとの owner が承認または拒否を行う。
全対象店舗の承認が揃うと配布を自動適用する。

### Request

```json
{
  "storeId": "target-store-a",
  "decision": "approved",
  "comment": "ok"
}
```

### decision

- `approved`
- `rejected`

### Response 200 (pending)

```json
{
  "message": "承認を記録しました。全対象店舗の承認待ちです。",
  "approvedStoreIds": ["target-store-a"],
  "requiredStoreIds": ["target-store-a", "target-store-b"],
  "status": "pending"
}
```

### Response 200 (applied)

```json
{
  "message": "全店舗承認が揃ったためホテルメニューテンプレ配信を適用しました。",
  "status": "applied",
  "results": [
    { "storeId": "target-store-a", "inserted": 2, "updated": 6 }
  ]
}
```

### overwriteScope

- `price_duration_only`: 既存メニューは `price` / `duration_minutes` のみ上書き
- `full`: 既存メニューを `item_type/name/price/billing_unit/default_quantity/duration_minutes/counts_toward_capacity/tax_rate/tax_included/is_active/display_order/notes` で上書き

## Matching Rule

- メニュー同定キー: `lower(trim(item_type)) + '::' + lower(trim(name))`
- キー一致なしは新規 insert
- キー一致ありは `overwriteScope` に従って update

## Error Examples

- `401`: 未ログイン
- `403`: source/target store が owner 管理範囲外、承認権限（owner）がない、または `Pro + hotel option` 条件未達
- `400`: 必須パラメータ不足、対象外店舗承認
- `500`: DBエラー
