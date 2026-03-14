# HQ Menu Template API Contract

## Endpoints

- `GET /api/hq/menu-templates`
- `POST /api/hq/menu-templates` (配信リクエスト作成)
- `GET /api/hq/menu-template-deliveries`
- `POST /api/hq/menu-template-deliveries/[delivery_id]/approve`

## Auth

- ログイン必須
- `GET /api/hq/menu-template-deliveries`: `store_memberships` の `owner/admin` が利用可（閲覧）
- 上記以外の本部メニュー配信API: `store_memberships` の `owner` のみ利用可（操作）

## 1) GET `/api/hq/menu-templates`

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
      "name": "シャンプー",
      "category": "トリミング",
      "price": 5500,
      "duration": 60,
      "tax_rate": 0.1,
      "tax_included": true,
      "is_active": true,
      "is_instant_bookable": false,
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

## 2) POST `/api/hq/menu-templates`

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
  "message": "テンプレ配信リクエストを作成しました。owner 承認後に適用されます。",
  "delivery": {
    "id": "delivery-id",
    "source_store_id": "source-store-id",
    "target_store_ids": ["target-store-a"],
    "overwrite_scope": "price_duration_only",
    "status": "pending",
    "created_at": "2026-03-09T..."
  }
}
```

## 3) GET `/api/hq/menu-template-deliveries`

### Query

- `status` (optional, default: `all`)

### Response 200

`hq_menu_template_deliveries` の配信リクエスト一覧（最新100件）

## 4) POST `/api/hq/menu-template-deliveries/[delivery_id]/approve`

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
  "message": "全店舗承認が揃ったためテンプレ配信を適用しました。",
  "status": "applied",
  "results": [
    { "storeId": "target-store-a", "inserted": 2, "updated": 6 }
  ]
}
```

### overwriteScope

- `price_duration_only`: 既存メニューは `price` / `duration` のみ上書き
- `full`: 既存メニューを `name/category/price/duration/tax/is_active/is_instant_bookable/display_order/notes` で上書き

## Matching Rule

- メニュー同定キー: `lower(trim(name)) + '::' + lower(trim(category))`
- キー一致なしは新規 insert
- キー一致ありは `overwriteScope` に従って update

## Menu Category Standard

- 施術メニューカテゴリは次の4区分を推奨: `トリミング` / `お手入れ` / `セット` / `オプション`

## Error Examples

- `401`: 未ログイン
- `403`: source/target store が owner 管理範囲外、または承認権限（owner）がない
- `400`: 必須パラメータ不足、対象外店舗承認
- `500`: DBエラー
