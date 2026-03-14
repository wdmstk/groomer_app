# HQ/店舗 ナビゲーション再設計案

## 目的

- 本部機能と店舗機能の混在を解消し、誤遷移と誤操作を減らす。
- `owner/admin/staff` で見せるべき操作範囲を明確化する。

## 結論（推奨案）

- サイドバーに「運用モード切替」を導入する。
- モードは `店舗運用` / `本部運用` の2種類。
- サイドバーリンクはモードごとに完全分離する。
- `staff` は `店舗運用` 固定にする（本部モード非表示）。

## ロール × モード

| role | 店舗運用 | 本部運用 |
| --- | --- | --- |
| owner | 可 | 可 |
| admin | 可 | 可（制限付き） |
| staff | 可 | 不可 |

## メニュー定義（案）

### 1) 店舗運用モード

- ダッシュボード (`/dashboard`)
- 顧客管理 (`/customers`)
- ペット管理 (`/pets`)
- 予約管理 (`/appointments`)
- モバイル当日運用 (`/ops/today`)
- 施術メニュー管理 (`/service-menus`)
- ペットカルテ管理 (`/medical-records`)
- 来店履歴 (`/visits`)
- 在庫管理 (`/inventory`)
- 会計管理 (`/payments`)
- 通知ログ (`/dashboard/notification-logs`)
- 監査ログ (`/dashboard/audit-logs`)
- 店舗設定
  - 新しい店舗を追加 (`/dashboard/setup-store`) ※ownerのみ
  - スタッフ管理 (`/staffs`)
  - サブスク課金 (`/billing`) ※ownerのみ
  - 課金履歴 (`/billing/history`) ※ownerのみ
  - 問い合わせ (`/support-tickets`)

### 2) 本部運用モード

- 本部ダッシュボード (`/hq`)
- テンプレ配信リクエスト (`/hq/menu-templates`)
- テンプレ配信承認 (`/hq/menu-template-deliveries`)

注: 将来本部機能を増やす場合は `/hq/*` 配下に追加し、店舗運用メニューには混ぜない。

## 画面遷移ルール

- `/hq/*` に入ったら自動で本部運用モードを選択。
- `/hq/*` 以外に入ったら店舗運用モードを選択。
- 手動切替も可能（ただし `staff` には本部切替を表示しない）。
- 画面上部に常時表示:
  - `現在: 本部運用` or `現在: 店舗運用`
  - `対象店舗: {storeName}`（店舗運用時のみ）

## UXガード

- 本部運用モード時はサイドバーに本部用の色帯/ラベルを表示して視覚分離する。
- 本部モードで店舗ページを開こうとした場合、確認トースト:
  - 「店舗運用に切り替えて移動しました」
- 権限不足ページは 403 で統一し、サイドバーにもリンクを出さない。

## 実装方針（段階導入）

### Phase 1: 最小改修（1PR）

- `Sidebar.tsx` に `mode: 'store' | 'hq'` を導入。
- `navSections` を `storeNavSections` / `hqNavSections` に分離。
- `pathname.startsWith('/hq')` で初期モード決定。
- `staff` はモード切替UIを非表示にする。

### Phase 2: 体験改善（1PR）

- ヘッダーに現在モードバッジを追加。
- 本部モード専用の説明文（権限・対象範囲）を追加。

### Phase 3: 権限精緻化（必要時）

- `owner/admin` で本部内機能の表示可否を細分化。
- 例: `admin` は閲覧のみ、承認は `owner` のみ等。
- 現在の採用方針: `admin` は本部閲覧のみ、`テンプレ配信リクエスト作成` と `承認/却下` は `owner` のみ。

## 受け入れ条件

- `staff` ログイン時に本部メニューが一切表示されない。
- `owner/admin` は本部モードと店舗モードを切替できる。
- `/hq/*` 直アクセス時に本部モード表示へ揃う。
- 本部機能が店舗管理セクションに混在しない。

## 既存コードへの主な影響箇所

- `groomer_app/src/components/ui/Sidebar.tsx`
- `groomer_app/src/lib/auth/hq-access.ts`（HQ権限ポリシーの単一管理）
- 必要に応じて:
  - `groomer_app/src/app/hq/layout.tsx`
  - `groomer_app/src/app/dashboard/layout.tsx`
