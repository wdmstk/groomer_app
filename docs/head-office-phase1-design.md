# 本部機能 Phase 1 設計

## 決定事項（2026-03-08）

1. 対象モデル
- Phase 1 の主対象は `1オーナー複数店舗` とする。
- `本部-加盟店` は Phase 2 以降で同一テナント構造へ載せる前提とし、Phase 1 実装では必須要件にしない。

2. テナントモデル
- 既存の `store_memberships`（店舗単位ロール）は維持する。
- 本部単位の境界として `organization_groups` を追加する。
- 店舗と本部の関連は `organization_store_links`（`group_id` + `store_id`）で管理する。
- 本部ユーザー所属は `organization_group_memberships`（`group_id` + `user_id` + `role`）で管理する。
- 既存店舗のみ運用の店舗は `group_id` 未所属でも動作可能とし、段階移行を許容する。

3. 権限差分（本部ロール vs 店舗ロール）
- 店舗ロールは現行どおり `owner/admin/staff` を継続する。
- 本部ロールは Phase 1 で `hq_owner/hq_admin/hq_viewer` の 3 種とする。
- Phase 1 の本部操作は `閲覧中心` とし、店舗データの直接更新は不可にする。
- 例外としてテンプレ作成ドラフトのみ本部側で作成可（適用は店舗 owner/admin 承認後）。

## データモデル（Phase 1）

### `organization_groups`
- `id uuid primary key`
- `name text not null`
- `created_at timestamptz not null default now()`

### `organization_group_memberships`
- `id uuid primary key`
- `group_id uuid not null references organization_groups(id)`
- `user_id uuid not null references auth.users(id)`
- `role text not null check (role in ('hq_owner','hq_admin','hq_viewer'))`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- unique: `(group_id, user_id)`

### `organization_store_links`
- `id uuid primary key`
- `group_id uuid not null references organization_groups(id)`
- `store_id uuid not null references stores(id)`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- unique: `(group_id, store_id)`

## 認可方針（Phase 1）

- 本部画面/APIは `organization_group_memberships` を基準に認可する。
- 店舗画面/APIは引き続き `store_memberships` + `active_store_id` を基準に認可する。
- 本部 API の返却対象店舗は `organization_store_links` で join し、所属外店舗は返さない。
- 監査ログは `actor_scope` を追加し、`store` / `hq` を区別して保存する。

## 集計基盤（Phase 1）

- 本部向け横断集計は `appointments` / `payments` を日次集計した SQL View で開始する。
- 初期は materialized view を使わず、`date` + `store_id` 単位の通常 view（例: `hq_store_daily_metrics_v1`）とする。
- 集計列は `store_id`, `metric_date_jst`, `appointments_count`, `completed_count`, `sales_amount` を最小セットに固定する。
- 期間フィルタは API 側で `metric_date_jst BETWEEN from AND to` を適用する。
- 件数増加時は Phase 2 で日次バッチテーブル化（`hq_store_daily_metrics`）へ移行する。

## 確定メモ（未完了チェック対応）

- `対象モデル最終確定`: Phase 1 は `1オーナー複数店舗` 主対象で固定。
- `テナント境界主キー`: `organization_groups.id` を境界キー（group_id）として採用。
- `本部向け集計基盤`: まずは SQL View 集計で運用し、重くなったらバッチ化する。
- `本部ロール操作上限`: Phase 1 は `閲覧 + テンプレ下書き作成` まで。店舗データ更新・代理実行は不可。
- `横断KPI最小セット`: `売上 / 予約数 / 完了率 / キャンセル率` の 4 指標で開始する。
- `テンプレ反映方式`: `本部で下書き作成 -> 店舗 owner/admin 承認後に反映` を採用する。

## 互換性と移行

- 既存機能は `group_id` 非依存でそのまま稼働させる。
- 本部機能導入店舗のみ `organization_groups` を作成し、紐づく `store_id` を段階登録する。
- まず読み取り API から本部機能を導入し、書き込みは Phase 2 で段階拡張する。
