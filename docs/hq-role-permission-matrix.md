# 本部権限マトリクス（OP-2026-08-01）

## 目的
1. 本部機能の権限境界を role ごとに固定し、表示・操作・承認の判定を一貫化する。
2. API/UI/運用で同じ基準を使い、誤実装と越権アクセスを防ぐ。

## 現行ロール定義（2026-03-12）
1. `owner`
2. `admin`
3. `staff`

注: 現行実装は `store_memberships.role` を本部機能にも流用する。

## 権限マトリクス（Capability）

| role | hq_view | hq_template_request | hq_template_approve |
|---|---|---|---|
| owner | 可 | 可 | 可 |
| admin | 可 | 不可 | 不可 |
| staff | 不可 | 不可 | 不可 |

実装参照:
1. `groomer_app/src/lib/auth/hq-access.ts`

## API権限制御

| API | 必要Capability | role要件 | データスコープ |
|---|---|---|---|
| `GET /api/hq/menu-templates` | `hq_view` | owner/admin | 自身が `hq_view` を持つ店舗のみ |
| `POST /api/hq/menu-templates` | `hq_template_request` | owner | source/target とも owner管理可能店舗のみ |
| `GET /api/hq/menu-template-deliveries` | `hq_view` | owner/admin | 自身が `hq_view` を持つ店舗に関連する配信のみ |
| `POST /api/hq/menu-template-deliveries/[delivery_id]/approve` | `hq_template_approve` | owner | 承認対象店舗で owner のみ |

## UI表示制御

| 画面 | owner | admin | staff |
|---|---|---|---|
| `/hq` 本部ダッシュボード | 表示 | 表示 | 非表示/403 |
| `/hq/menu-templates` 配信リクエスト | 表示・実行可 | 表示のみ | 非表示/403 |
| `/hq/menu-template-deliveries` 配信履歴/承認 | 表示・承認可 | 表示のみ | 非表示/403 |

## 運用ルール
1. 権限判定は `hq-access.ts` を唯一の正として扱う。
2. 新しい本部APIは必ず Capability を先に定義してから実装する。
3. `staff` には `/hq/*` 導線を出さない。
4. 監査時は「role」「対象store_id」「要求Capability」をセットで記録する。

## 次フェーズ前提（Phase 2）
1. `organization_group_memberships` 導入時は、Capability 判定を store 単位から group 単位へ拡張する。
2. `hq_owner/hq_admin/hq_viewer` を導入する場合も、本書の Capability テーブルを先に更新してからAPI/UIを変更する。
