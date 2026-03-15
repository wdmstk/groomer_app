# TASKS.md

Development Task List

This file contains the list of development tasks for the project.
AI agents should prioritize unfinished tasks.

---

# Current Tasks

## Differentiation Features

### Phase 1: Photo Medical Record UX

* [x] Create branch `feat/medical-record-fast-flow`
* [x] Add appointment/payment driven prefill into photo medical record flow
* [x] Replace generic photo upload entry with `施術前を撮る` / `施術後を撮る`
* [x] Optimize photo medical record modal for mobile-first operation
* [x] Show share actions immediately after save
* [x] Add one-tap LINE send when customer has `line_id`
* [ ] Add tests for photo upload/share flow where feasible

### Phase 2: Deep LINE Integration

* [x] Create branch `feat/medical-record-line-share`
* [x] Add medical record LINE share sending path using existing `line_id`
* [x] Store notification logs for medical record share sends
* [x] Create branch `feat/line-webhook-linking`
* [x] Add LINE webhook endpoint
* [x] Verify LINE signature and persist webhook events
* [x] Design or implement customer auto-link flow from LINE events
* [x] Update customer screens to show LINE linked/unlinked state clearly

### Phase 3: Multi-pet Booking UX

* [x] Create branch `feat/multi-pet-booking-ui`
* [x] Add sequential family booking flow for same customer
* [x] Add `別のペットを続けて予約` action after first booking
* [x] Extend public reservation flow to add another pet in one session
* [x] Add family-level booking confirmation UI

### Phase 4: Multi-pet Booking Data Model

* [x] Create branch `feat/multi-pet-booking-group-model`
* [x] Design `appointment_groups` or equivalent grouping model
* [x] Define backward-compatible migration strategy
* [x] Update booking APIs to support grouped bookings
* [x] Update notifications and cancellation flows for grouped bookings
* [x] Add DB migrations and tests

### Supporting Work

* [x] Keep `docs/differentiation-feature-roadmap.md` updated as implementation decisions evolve
* [ ] Run lint/tests for each feature branch
* [ ] Update README or runbooks when user-facing behavior changes

## Core Features

* [ ] Implement CSV file parser
* [ ] Add input validation
* [ ] Implement data analysis module
* [ ] Add Excel export functionality
* [ ] Create command-line interface

---

## Testing

* [ ] Add unit tests for parser
* [ ] Add unit tests for analysis
* [ ] Add integration tests for full pipeline

---

## Improvements

* [ ] Improve error handling
* [ ] Improve logging
* [ ] Add configuration file support

---

## Documentation

* [ ] Update README
* [ ] Add usage examples
* [ ] Document main modules

---

# Task Strategy

When implementing a task:

1. Identify the relevant module
2. Implement the feature
3. Write tests
4. Run linting
5. Commit changes

Agents should update this file when tasks are completed.

Completed tasks should be marked:

[x] Task name

---

# TASKS

## 事前決済
- ブランチ: `feature/prepayment`
- 概要: 予約時に事前決済またはカード仮押さえを選択できるようにし、無断キャンセル請求とキャンセルポリシー管理を追加する
- 影響範囲: API / DB / UI
- リスク: 予約作成と既存会計フローの二重課金、無断キャンセル時の請求判定、既存予約画面の一覧表示崩れ
- 完了条件: 予約時の決済方式選択、設定画面でのキャンセルポリシー管理、無断キャンセル請求導線、予約一覧バッジ表示、テスト追加が完了している
- 進捗:
  - [x] 既存予約/会計/課金連携の調査反映
  - [x] DB拡張
  - [x] API追加
  - [x] UI実装
  - [ ] テスト
  - [ ] PR作成

## LINEの自動マーケ
- ブランチ: `feature/line-auto-marketing`
- 概要: 施術日、犬種、毛量から次回来店推奨日を算出し、既存LINE通知基盤で自動送信する
- 影響範囲: API / DB / UI
- リスク: 推奨日ロジックの過剰送信、既存 reminder/followup 通知との重複、テンプレート互換性
- 完了条件: 推奨日計算、送信ジョブ、テンプレート編集、通知ログ記録、テスト追加が完了している
- 進捗:
  - [x] 既存LINE/通知テンプレ/cron基盤の調査反映
  - [x] DB拡張
  - [x] テンプレート基盤の拡張開始
  - [x] API追加
  - [x] UI実装
  - [ ] テスト
  - [ ] PR作成

## 写真カルテのAIタグ付け
- ブランチ: `feature/ai-photo-tags`
- 概要: 写真カルテにAI解析タグを非同期付与し、カルテ画面で確認と編集ができるようにする
- 影響範囲: API / DB / UI
- リスク: 推論遅延、タグ誤判定、写真保存フローとの競合、既存カルテ作成UXの劣化
- 完了条件: 非同期推論API、タグ保存、カルテ画面表示/編集、失敗時の再試行導線、テスト追加が完了している
- 進捗:
  - [x] 既存カルテ/写真保存フローの調査反映
  - [x] DB拡張
  - [x] API追加
  - [x] UI実装
  - [x] テスト
  - [ ] PR作成

## 顧客LTV分析
- ブランチ: `feature/customer-ltv`
- 概要: 既存の visits / payments を集計して年間売上、来店回数、平均単価、オプション利用率、LTVランクを可視化する
- 影響範囲: API / DB / UI
- リスク: 売上集計の整合性、会計未確定データの扱い、一覧画面の負荷、店舗スコープ漏れ
- 完了条件: 集計方針決定、一覧表示、指標計算、LTVランク表示、テスト追加が完了している
- 進捗:
  - [x] 既存売上/来店データ構造の調査反映
  - [x] 集計方式の決定
  - [x] DB拡張またはView追加
  - [x] API追加
  - [x] UI実装
  - [x] テスト
  - [ ] PR作成

## Issues
- `main` から4本の専用ブランチを作成済み。実装は依存順の都合で `feature/prepayment` から着手している
- 現時点の外部決済連携は店舗サブスク課金向け `KOMOJU` が中心で、予約事前決済向けの顧客課金APIは未実装
- AI推論基盤は未導入のため、写真カルテAIタグ付けは新規バックエンドAPIとジョブ管理の追加が必要
- 顧客LTVはまず動的集計Viewで実装。データ量増加時のみ nightly snapshot へ移行する方針
- 遅いページ群は DB 側 index 不足の可能性が高く、`appointments / medical_records / customers / pets / staffs` に非破壊 index を追加して検証する
- 2026-03-15 時点の全ページ棚卸しでは、根本原因は「一律 DB 遅延」ではなく、巨大 client component と初期表示で不要なクエリ取得の混在。横展開は `docs/page-performance-audit-2026-03-15.md` の基準で進める
- 2026-03-15 時点で主要ページには performance 横展開を反映済み。残作業は `inventory / billing / settings/storage` の追加計測と、PR 用の差分整理が中心
- `settings/storage` は Storage API の `Bad Gateway` を吸収するため、設定画面のみ 5 秒タイムアウト付きの部分フォールバックを採用。厳密な容量判定は upload 側ロジックを維持する

## Dependencies
- 推奨マージ順: `feature/prepayment` -> `feature/line-auto-marketing` -> `feature/ai-photo-tags` -> `feature/customer-ltv`
- `feature/line-auto-marketing` は既存 `notification_templates` / `customer_notification_logs` / cron 基盤に依存
- `feature/ai-photo-tags` は既存 `medical_records` / `medical_record_photos` 基盤に依存
- `feature/customer-ltv` は既存 `visits` / `visit_menus` / `payments` の整合した集計に依存
