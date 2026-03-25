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

## TASK運用ルール（2026-03-24）
- `Task ID` を持つタスクのみを「正式タスク」として扱う（形式: `TASK-xxx` または `TASK-<prefix>-xxx`）。
- 正式タスクの表示順は以下で固定する。
  - `in_progress`
  - `todo`
  - `blocked`
  - `done`
- 同一ステータス内は `Task ID` の降順（新しい番号が上）で並べる。
- `Task ID` 未採番のメモ/旧タスクは `Archive` セクションへ置き、正式タスクの並びに混在させない。
- 新規タスク追加時は、必ずこのルールで `TASK INDEX` と該当タスク本文の両方を更新する。

## TASK INDEX（正式タスクの正規順序）

### in_progress
1. `TASK-417` AI動画段階実装（2026-03-21）
2. `TASK-414` 顧客LTV分析
3. `TASK-412` AIタグ活用導線の改善
4. `TASK-411` 写真カルテのAIタグ付け
5. `TASK-410` LINEの自動マーケ
6. `TASK-409` 事前決済
7. `TASK-408` POS機能導入計画（要件定義〜実装）
8. `TASK-401` 統合会計（Invoice方式）
9. `TASK-POS-001` 要件定義・業務フロー確定（`TASK-408`配下）
10. `TASK-POS-002` データモデル・API契約設計（`TASK-408`配下）
11. `TASK-POS-006` 受入試験・移行・運用ドキュメント整備（`TASK-408`配下）

### todo
（なし）

### blocked
1. `TASK-413` AIタグ解析ジョブのRLS修正（Supabase SQL Editor反映待ち）

### done
1. `TASK-420` dev課金操作の安全運用化（2026-03-22）
2. `TASK-419` 法務・規約コンプライアンス是正（2026-03-22）
3. `TASK-418` オプション課金確定ゲート整備（2026-03-22）
4. `TASK-416` サイドバー改善（2026-03-21）
5. `TASK-415` 動画カルテ + AIプラン拡張（非破壊導入）
6. `TASK-407` 開発環境で課金なしのプラン/オプション切替
7. `TASK-406` devサブスク保存後404修正
8. `TASK-405` タスク/ブランチ運用ガード追加とStorage設定導線整理
9. `TASK-404` HP本部運用にホテルメニュー向けテンプレ配信を追加
10. `TASK-403` ペット管理からQR機能を完全削除
11. `TASK-402` appointments更新後POST転送不具合修正
12. `TASK-POS-003` POS会計画面（MVP）実装（`TASK-408`配下）
13. `TASK-POS-004` 在庫連動（自動出庫/返品戻し）実装（`TASK-408`配下）
14. `TASK-POS-005` レジ開閉局・日次締め実装（`TASK-408`配下）
15. `TASK-POS-007` POS一本化（トリミング/ホテル会計統合）（`TASK-408`配下）

## 正式タスク詳細（Task ID採番済み）


## 開発環境で課金なしのプラン/オプション切替を可能にする
- Task ID: `TASK-407`
- ブランチ: `feat/TASK-407-dev-billing-no-payment-switch`
- ステータス: `done`
- 概要: 開発環境では実課金を発生させず、ownerが決済管理画面からプラン/オプションを即時切替できるようにする
- 影響範囲: Billing API（checkout/options）
- リスク: 本番環境へ誤適用すると課金ゲートがバイパスされるため、開発環境限定条件を厳格化する
- 完了条件: 開発環境ではcheckout未実行で切替が反映され、本番環境の課金フローは従来通り維持される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 分岐条件と反映処理の実装
  - [x] テスト実行（対象テスト + lint）
  - [x] `/dev/subscriptions` 更新時の requested/effective 同期不備を修正
  - [x] ライトプラン時にオプション/AI指定が黙って破棄される不具合を修正（明示エラー化）
  - [x] `/dev/subscriptions` のcheckbox受信不備を修正（hidden=false優先読取の解消）

## devサブスク保存後404修正（2026-03-23）
- Task ID: `TASK-406`
- ブランチ: `fix/TASK-406-dev-subscription-save-404`
- ステータス: `done`
- 概要: `/dev/subscriptions` の保存後に発生する404を解消し、POST後に確実に一覧へ戻るようにする
- 進捗:
  - [x] 原因調査（保存APIのリダイレクト方式を確認）
  - [x] API修正（POST後の303リダイレクト）
  - [x] 回帰テスト追加・実行

## タスク/ブランチ運用ガード追加とStorage設定導線整理
- Task ID: `TASK-405`
- ブランチ: `chore/TASK-405-task-branch-guard-storage-cleanup`
- ステータス: `done`
- 概要: CIでタスク/ブランチ命名と`TASKS.md`同時更新を強制し、Storage設定画面から不要になった容量追加課金パネル導線を整理する
- 影響範囲: CI workflow / AGENTS.md / Storage設定UI / TASKS
- リスク: 既存PRで新ガードによりチェック失敗が増える可能性、Storage設定画面の導線変更による運用混乱
- 完了条件: `task-and-branch-guard` workflowが追加され、`AGENTS.md`の運用ルールが反映され、Storage設定画面の不要導線が削除される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 差分整理（AGENTS / workflow / Storage設定）
  - [x] テスト/lint 実行
  - [x] コミット・push・mainマージ

## HP本部運用にホテルメニュー向けテンプレ配信（リクエスト/承認）を追加
- Task ID: `TASK-404`
- ブランチ: `feat/TASK-404-hq-hotel-template-menu-gate`
- ステータス: `done`
- 概要: 施術メニュー向けとは別に、ホテルメニュー向けのテンプレ配信リクエスト/承認フローを本部運用へ追加する
- 影響範囲: HQサイドバー / HQページ / API / 配信ロジック / Supabase SQL / テスト
- リスク: 既存の施術メニュー配信フローとの混線、RLS不足による権限逸脱
- 完了条件: 本部運用にホテル版の配信リクエスト・承認画面とAPIが追加され、全対象店舗承認で`hotel_menu_items`へ適用される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 影響箇所調査
  - [x] ホテル版のUI/API/配信ロジックを追加
  - [x] Supabase SQL（ホテル版配信テーブル/RLS）を追加
  - [x] テスト/lint 実行
  - [ ] PR作成（必要時）

## ペット管理からQR機能を完全削除
- Task ID: `TASK-403`
- ブランチ: `fix/TASK-403-remove-pet-qr-feature`
- ステータス: `done`
- 概要: ペット一覧に残っているQR表示を削除し、ペットQR向けのAPI/DB項目を不要化する
- 影響範囲: ペット管理UI / pets API / Supabaseマイグレーション / テスト
- リスク: 旧QR列参照コードの取り残しによる一覧取得エラー、公開予約QR照合への影響
- 完了条件: ペット一覧にQR列/リンクが表示されず、`qr_code_url` `qr_payload` 依存が除去され、不要DB項目を削除するSQLが追加されている
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 影響箇所調査（UI/API/DB）
  - [x] 実装
  - [x] テスト/lint実行
  - [ ] PR作成（必要時）

## appointments更新後にPOSTが/appointmentsへ転送される不具合修正
- Task ID: `TASK-402`
- ブランチ: `fix/TASK-402-appointments-post-redirect`
- ステータス: `done`
- 概要: 予約更新/作成後の redirect が `307` となり `POST /appointments` が発生して `Failed to find Server Action` エラーになる問題を解消する
- 影響範囲: 予約API redirect 動作
- リスク: redirect status の変更により画面遷移タイミングが変わる可能性
- 完了条件: 予約作成/更新/削除フォーム送信後に `303` で `GET /appointments` へ遷移し、`POST /appointments` が発生しない
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 原因調査（POST後 redirect が 307 で method 維持を確認）
  - [x] API redirect status 修正
  - [x] テスト/lint 実行
  - [ ] PR作成（必要時）

## 統合会計（Invoice方式）
- Task ID: `TASK-401`
- ブランチ: `fix/TASK-401-unified-checkout-playwright-recording`（録画完走対応）
- ステータス: `in_progress`
- 概要: 同一タイミングのトリミング予約とホテル滞在を1回の会計で確定できる `invoice` 基盤を導入する
- 影響範囲: DB / API / UI / 領収書 / 既存会計連携
- リスク: 既存 `payments` の互換性、二重計上、来店履歴自動作成の整合性
- 完了条件: `invoices` / `invoice_lines` 導入、既存会計の `invoice_id` 連携、統合会計作成APIと画面導線、テスト整備が完了している
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 方式決定（invoice新設）
  - [x] DBマイグレーション追加
  - [x] API契約定義
  - [x] Invoice API（作成/取得/更新）初期実装
  - [x] ホテル詳細から統合会計作成ボタンを追加（invoice作成呼び出し）
  - [x] 会計画面に統合請求パネルを追加（invoice一覧/確定）
  - [x] Invoice 支払い確定API（/api/invoices/[invoice_id]/pay）を追加
  - [x] Invoice 共通ロジックのユニットテスト追加（invoices.shared.test.ts）
  - [x] Invoice 支払い判定ロジックのユニットテスト追加（invoices.pay-core.test.ts）
  - [x] Invoice 作成・更新ロジックのユニットテスト追加（invoices.create-core / invoices.detail-core）
  - [x] 会計UI改修（統合請求を主導線、予約単位会計をレガシー導線化）
  - [x] テスト（invoice系ユニットテスト4本を追加・実行）
  - [x] マニュアル更新（会計管理/ホテル管理に統合会計フローを追記）
  - [x] 運用手順書追加（docs/invoice-unified-checkout-user-manual.md）
  - [x] Playwright録画シナリオ作成（e2e/unified-invoice-walkthrough.spec.ts）
  - [x] Playwright E2Eログイン回避の調整（proxyエントリ追加）
  - [x] Playwright録画実行（`e2e/unified-invoice-walkthrough.spec.ts` 実行、動画出力あり）
  - [x] Playwright録画完走（`--retries=0` で 1 passed を確認）
  - [ ] PR作成

## 事前決済
- Task ID: `TASK-409`
- ブランチ: `feature/prepayment`
- ステータス: `in_progress`
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
- Task ID: `TASK-410`
- ブランチ: `feature/line-auto-marketing`
- ステータス: `in_progress`
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
- Task ID: `TASK-411`
- ブランチ: `feature/ai-photo-tags`
- ステータス: `in_progress`
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

## AIタグ活用導線の改善
- Task ID: `TASK-412`
- ブランチ: `feat/medical-record-ai-tag-usage`
- ステータス: `in_progress`
- 概要: カルテ一覧でAIタグをチップ表示し、タグや解析状態で絞り込めるようにして、詳細を開かなくても要確認カルテを見つけやすくする
- 影響範囲: UI / 一覧導線 / テスト
- リスク: 一覧の情報量増加、モバイル表示の圧迫、タグ絞り込み条件の分かりにくさ
- 完了条件: 一覧のタグ可視化、タグフィルタ、解析状態フィルタ、関連テスト追加が完了している
- 進捗:
  - [x] 既存カルテ一覧UIの調査反映
  - [x] UI実装
  - [x] テスト
  - [ ] PR作成

## AIタグ解析ジョブのRLS修正
- Task ID: `TASK-413`
- ブランチ: `fix/medical-record-ai-tag-jobs-rls`
- ステータス: `blocked`
- 概要: AIタグの「AIタグを解析」実行時に `medical_record_ai_tag_jobs` insert が RLS で拒否される問題を解消する
- 影響範囲: DB(RLS) / AIタグ解析受付API
- リスク: RLS条件の誤設定による他店舗データアクセス、既存ジョブ更新系への影響
- 完了条件: `medical_record_ai_tag_jobs` に store scope の select/insert/update/delete policy が定義され、解析受付時のRLSエラーが解消されている
- 進捗:
  - [x] 原因調査（RLS policy未定義を確認）
  - [x] DB修正SQL追加
  - [ ] Supabase SQL Editor 反映
  - [ ] 動作確認
  - [ ] PR作成

## 顧客LTV分析
- Task ID: `TASK-414`
- ブランチ: `feature/customer-ltv`
- ステータス: `in_progress`
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

## Archive（調査メモ・過去の運用記録）

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

---

## Test Plan

### 全体方針
- 既存の `groomer_app/tests/*.test.ts` と `src/lib/**/services/shared.ts` のバリデーションを優先再利用し、UI 専用ロジックのみ追加でテスト化する
- 画面テストは `page.tsx` / `components/**` の表示整形、API 連携、フォーム入力境界、店舗スコープ整合性を単位に分解する
- 実運用データは犬種・猫種ミックス、多頭飼い、電話番号揺れ、混雑時間帯、メニュー複数選択、当日予約、キャンセル、会計境界値を使う

### ページ別計画
- 予約管理: `/appointments` 一覧表示、状態遷移、次回予約導線、作成/編集モーダル、カレンダー表示、競合検知、店舗整合性
- 顧客管理: `/customers` 一覧、編集、会員証導線、LINE 連携表示、無断キャンセル集計、待機リスト導線
- ペット管理: `/pets` 一覧、編集、顧客ひも付け、犬種/猫種/ミックス入力、体重・年齢の境界、注意事項表示
- メニュー/料金: `/service-menus` メニュー作成編集、所要時間・税込税抜・オプション反映、会計集計との整合
- 来店/会計: `/visits` `/payments` `/receipts/[payment_id]` 来店登録、施術完了、支払方法、割引、税込計算、レシート表示
- カルテ: `/medical-records` 写真カルテ、AI タグ、共有導線、施術前後フロー、既存 appointment/payment 連携
- スタッフ管理: `/staffs` 一覧、編集、招待、権限、表示名必須、予約担当との整合
- 設定: `/settings/notifications` `/settings/public-reserve` `/settings/storage` 営業時間、公開予約設定、通知設定、ストレージ例外フォールバック
- 公開予約: `/reserve/[store_id]` `/reserve/cancel` 顧客入力、ペット入力、多頭予約、キャンセル、QR 参照、空き枠取得
- ダッシュボード/売上: `/dashboard` `/dashboard/appointments-kpi` `/billing` `/billing/history` 売上・課金・KPI 表示、契約制御、将来 POS 連携前提の金額整合
- 補助業務: `/support-chat` `/support-tickets` `/inventory/**` `/hotel` `/ops/today` は画面表示・更新フロー・権限制御を既存 API テストと照合して後続で実施

## Progress

- [x] 2026-03-16: 既存の自動テスト一覧を棚卸しし、`groomer_app/tests` が API / presentation / service 層中心であることを確認
- [x] 2026-03-16: Playwright E2E 基盤の最小セットアップ方針を確定
- [x] 2026-03-16: `/appointments?tab=list` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/appointments?tab=calendar` 用の Playwright 初回シナリオを追加
- [x] 2026-03-16: `/customers?tab=list` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/pets?tab=list` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/service-menus?tab=list` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/payments?tab=list` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/staffs?tab=list` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/settings/notifications` `/settings/public-reserve` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/reserve/[store_id]` `/reserve/cancel` 用の Playwright 初回シナリオを追加
- [x] 2026-03-16: `/billing` `/billing/history` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/dashboard` `/dashboard/appointments-kpi` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/dashboard?tab=operations` `/dashboard?tab=reoffers` 用の Playwright 初回シナリオを追加
- [x] 2026-03-16: `/support-tickets` `/support-chat` 用の Playwright 初回シナリオを追加
- [x] 2026-03-16: `/inventory` `/inventory/reorder-suggestions` `/inventory/products` 用の Playwright 初回シナリオを追加
- [x] 2026-03-16: `/hotel` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/inventory/stocks` `/inventory/history` `/inventory/reports` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/inventory/inbounds` `/inventory/outbounds` `/inventory/purchase-orders` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/inventory/stocktake` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/hotel` の作成・更新・削除・設定保存の Playwright route mock シナリオを追加
- [x] 2026-03-16: `/support-chat` owner view の Playwright route mock シナリオを追加
- [x] 2026-03-16: `/hotel` 商品台帳の保存・削除・シーズン切替 Playwright route mock シナリオを追加
- [x] 2026-03-16: `/dev/support-chat` `/dev/support-tickets` 用の Playwright route mock シナリオを追加
- [x] 2026-03-16: `/dashboard/notification-logs` `/dashboard/audit-logs` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/settings/storage` `/receipts/[payment_id]` 用の Playwright fixture ベース初回シナリオを追加
- [x] 2026-03-16: `/ops/today` 用の Playwright fixture ベース初回シナリオを追加し、focused 実ブラウザ run を通過
- [x] 2026-03-16: Chromium 依存解消後の実ブラウザ実行で `appointments` `customers` `payments` の focused E2E を再検証し、9/9 シナリオを通過
- [x] 2026-03-16: `billing` `dashboard-log` の focused 実ブラウザ run を clean port (`3100`) で再検証し、4/4 シナリオ通過
- [x] 2026-03-16: `dashboard-pages.spec.ts` の focused 実ブラウザ run を再検証し、tab 直遷移へ寄せて 3/3 シナリオを通過
- [x] 既存テスト・バリデーション・ユーティリティの棚卸し
- [x] 全ページの一次棚卸しと優先順の整理
- [x] 予約一覧 `/appointments?tab=list` の表示・状態遷移・次回予約導線テスト
- [x] 予約作成/編集 `/appointments?modal=create` の入力・競合・多頭予約テスト
- [x] 顧客一覧/詳細/編集 `/customers` テスト
- [x] ペット一覧/詳細/編集 `/pets` テスト
- [x] メニュー選択/料金計算 `/service-menus` `/payments` テスト
- [x] カレンダー `/appointments?tab=calendar` テスト
- [x] スタッフ管理 `/staffs` テスト
- [x] 売上管理 `/dashboard` `/billing` `/billing/history` テスト
- [x] 設定画面 `/settings/**` テスト
- [x] 公開予約 `/reserve/[store_id]` `/reserve/cancel` テスト

## Findings

- 2026-03-16: `package.json` には Playwright の script / config が未定義で、E2E 基盤はまだ未導入
- 2026-03-16: `/appointments` は server component で Supabase 認証と店舗 cookie に依存するため、初回 E2E は `PLAYWRIGHT_E2E=1` の fixture モードで非破壊に分離する
- 2026-03-16: 予約カレンダーは `sessionStorage` の `appointment_delay_alert` とクライアント側モード切替で表示が変わるため、E2E では `page.addInitScript` による初期値注入が有効
- 2026-03-16: `/customers` も server component に加えて `member_portal_links` の admin client と `LTV` の client fetch を持つため、一覧本体は fixture、LTV は Playwright route mock が最小差分
- 2026-03-16: `/pets` は `qr_code_url` 列の後方互換フォールバックと relation 表示があるため、fixture でも `qr_payload` と顧客 relation を持たせると回帰検知しやすい
- 2026-03-16: `/service-menus` は一覧と同時に直近完了予約からの所要時間推奨を計算するため、fixture に completed appointment サンプルを含めると UI 価値の高い回帰を拾える
- 2026-03-16: `/payments` は `appointment_menus` から会計見込み額を再計算しているため、fixture 側でも税込金額からの逆算を含めた appointment menu 行を持たせるとモーダル検証が安定する
- 2026-03-16: `/staffs` は `InviteManager` の client fetch とプラン制限表示が混在するため、ページ本体は fixture、招待一覧は Playwright route mock に分けると責務を保ったまま E2E 化できる
- 2026-03-16: `/settings/notifications` と `/settings/public-reserve` は権限表示と数値正規化が主眼なので、fixture では意図的に `null` や範囲外の値を与えると presentation helper の補正が確認しやすい
- 2026-03-16: 公開予約フォームはほぼすべて client fetch で完結しているため、アプリコード改修なしでも API route mock だけで QR 照合、空き枠、家族予約、キャンセル導線を E2E 化しやすい
- 2026-03-16: `/billing` `/billing/history` は owner guard と admin client の組み合わせが強いので、ページ全体を fixture 化した方が課金状態・履歴テーブルの回帰を安定して拾える
- 2026-03-16: `/dashboard` `/dashboard/appointments-kpi` は日付依存と集計 view 依存が強いため、E2E では固定時刻 + 集計 fixture を持たせると overview / followups / KPI レポートの回帰が安定する
- 2026-03-16: `/dashboard?tab=reoffers` は `SlotReofferPanel` が client fetch で `/api/reoffers` を読むため、ページ本体は fixture、パネル部分は Playwright route mock に分けると最小差分で扱える
- 2026-03-16: `/support-tickets` は page 側の認可だけ server 依存で、一覧・起票・コメントは client fetch のため、E2E では auth を env でバイパスしつつ `/api/support-tickets` を route mock するのが最小差分
- 2026-03-16: `inventory` 系は server component が中心で一覧の集計ロジックも page 側にあるため、`reorder-suggestions` と `products` は fixture モードで固定した方が表示回帰を拾いやすい
- 2026-03-16: `/hotel` は page 側の認可・feature gate・初期集計に加えて `HotelStaysManager` の client 操作が大きいため、まずは page の fixture 化で一覧/カレンダー/設定/商品台帳の初期表示を固定し、更新系は後続に分けるのが安全
- 2026-03-16: `inventory/stocks` `inventory/history` `inventory/reports` も page 側で在庫集計・日時整形を持つため、既存 fixture を共通利用して low filter と 30 日レポートを固定すると横展開しやすい
- 2026-03-16: `inventory/inbounds` `inventory/outbounds` `inventory/purchase-orders` は action 自体は form post で安定しているため、まずは商品候補・既定値・最新履歴・発注明細の初期表示を fixture で固定するのが最小差分
- 2026-03-16: `inventory/stocktake` は帳簿在庫の算出が page 側責務なので、option 表示と差異履歴を fixture で固定すると棚卸特有の回帰を拾いやすい
- 2026-03-16: `hotel` の更新系は `HotelStaysManager` 内の fetch に閉じているため、fixture で初期表示を固定したうえで route mock を足すと create/update/delete/saveSettings の UI 回帰も非破壊で取れる
- 2026-03-16: `/support-chat` は通常 redirect だが、E2E では owner view を env で直接描画し、`/api/support-chat/messages` を route mock すると会話表示と送信導線を壊さず固定できる
- 2026-03-16: `hotel` 商品台帳の保存系は `reloadAll()` で stays / menu-items / settings を同時再取得するため、route mock では再取得 3 本をまとめて整合させる必要がある
- 2026-03-16: `dev/support-*` も page 側は認可だけ server 依存で、一覧・返信・更新は client fetch のため、E2E では認可を env でバイパスし route mock に寄せるのが最小差分
- 2026-03-16: `dashboard/notification-logs` `dashboard/audit-logs` は server component だが集計・検索・要約生成が page 側にあるため、fixture で rows を固定するとフィルタと要約の回帰を取りやすい
- 2026-03-16: `settings/storage` は owner guard と Storage API フォールバックが page 側責務なので、guard と quota をまとめて fixture 化すると usage warning と容量換算表示を安定して確認できる
- 2026-03-16: `receipts/[payment_id]` は会計一覧 fixture を再利用しつつ `appointment_menus` だけ領収書向けに分けると、JST 支払日時と施術内訳の回帰を最小差分で固定できる
- 2026-03-16: 実ブラウザで見ると一覧ページは mobile / desktop の両方に同じ `data-testid` を持つため、Playwright strict mode では一覧コンテナにスコープしないと失敗しやすい
- 2026-03-16: `AppointmentCalendar` の遅延 alert は `sessionStorage` 注入だけでは実ブラウザで不安定だったため、`PLAYWRIGHT_E2E=1` 専用の初期 alert fixture query を用意すると週表示 alert も安定した
- 2026-03-16: `billing` `dashboard` `dashboard-log` は実ブラウザで `strict mode` による重複テキスト衝突が多く、カード内 span / heading / cell に selector を寄せる必要がある
- 2026-03-16: `dashboard` `dashboard-log` の query 付き再遷移は `page.goto(..., waitUntil: 'load')` だと `ERR_ABORTED` や timeout が出やすく、`domcontentloaded` またはタブリンク click ベースへ寄せると安定しやすい
- 2026-03-16: `dashboard-pages` は実ブラウザだと tab click より `?tab=...` への初回直遷移の方が安定し、`operations` spec は初期 `goto` 抜けが timeout の主因だった
- 2026-03-16: `dashboard-log` の件数サマリー（`1-1 件表示 / 1 件中 / 1 / 1 ページ`）は空白揺れで完全一致が不安定なため、実ブラウザ focused run では whitespace 許容の正規表現 matcher が安定した
- 2026-03-16: `dashboard` `ops-today` `billing` `dashboard-log` の focused bundle は並列 worker 実行で `ERR_ABORTED` / timeout が再発する場合があり、`--workers=1` で再実行すると 8/8 で安定通過した
- 2026-03-16: `/ops/today` は fixture を UTC で持ちつつ画面は JST 表示のため、focused 実ブラウザ E2E では KPI と時刻の期待値を JST に合わせる必要がある
- 2026-03-16: 予約一覧は `data-testid` がなかったため、状態遷移ボタンや次回予約リンクの UI 回帰検知が不安定
- 2026-03-16: sandbox 内では `next dev` のポート待受けが `EPERM` で失敗したため、Playwright 実行には権限付き実行が必要
- 2026-03-16: Playwright Chromium は `libnspr4.so` など OS 依存ライブラリ不足で起動失敗。`npx playwright install-deps chromium` は `sudo` パスワード要求で未完了
- 2026-03-16: 既存自動テストは `groomer_app/tests` 配下の API / service 層が中心で、`page.tsx` の表示整形や画面導線の自動テストは限定的
- 2026-03-16: 日時整形や `未登録` フォールバックなどの画面ロジックが `appointments` `visits` `medical-records` など複数ページに分散しており、表示仕様の回帰検知がしづらい
- 2026-03-16: 予約一覧ページは状態遷移ボタン表示、完了時の次回予約リンク、関連レコード未登録時フォールバックが UI 仕様の要点で、service 層既存テストだけでは回帰を拾い切れない
- 2026-03-16: 予約作成モーダルは 409 競合エラー文言、前回予約コピー対象選定、家族単位の継続予約サマリーが UI 固有仕様で、API テストだけでは担保不足

## Fix Plan

- Playwright を `groomer_app` 配下へ最小構成で導入し、Next.js 開発サーバーを `webServer` で自動起動する
- `/appointments` 一覧は test fixture で server-side data 依存を分離し、実運用データに近い犬種・多頭・無断キャンセル・未登録値を E2E に反映する
- 今後は `/customers` `/pets` `/service-menus` `/payments` `/settings/**` へ同じ fixture / selector 方針を横展開する

## Completed

- 2026-03-16: 既存 E2E / API / 単体テストの棚卸しを実施
- 2026-03-16: Playwright 設定ファイル、npm script、`/appointments` 一覧向け初回 E2E テストを追加
- 2026-03-16: `appointments?tab=calendar` へ週/日切替、遅延影響アラート、予約申請/スタッフ表示を確認する E2E シナリオを追加
- 2026-03-16: `customers` 一覧へ fixture モードと `data-testid` を追加し、LTV / LINE 連携 / 無断キャンセル / `未登録` 表示の E2E シナリオを作成
- 2026-03-16: `pets` 一覧へ fixture モードと `data-testid` を追加し、QR 表示、`0kg`、relation fallback、持病/注意事項表示の E2E シナリオを作成
- 2026-03-16: `service-menus` 一覧へ fixture モードと `data-testid` を追加し、推奨所要時間、税込/税抜、有効/無効、即時確定対象表示の E2E シナリオを作成
- 2026-03-16: `payments` 一覧へ fixture モードと `data-testid` を追加し、予約ラベル、会計済/未会計、印刷導線、合計見込み表示の E2E シナリオを作成
- 2026-03-16: `staffs` 一覧へ fixture モードと `data-testid` を追加し、ライトプラン上限、権限ラベル、未連携表示、招待一覧、新規スタッフモーダルの E2E シナリオを作成
- 2026-03-16: `settings/notifications` と `settings/public-reserve` に fixture モードを追加し、権限表示、既定値補正、閾値/公開枠/除外日の初期表示を確認する E2E シナリオを作成
- 2026-03-16: `reserve/[store_id]` と `reserve/cancel` に API route mock ベースの E2E シナリオを追加し、QR 照合、空き枠、即時確定対象外メッセージ、家族予約サマリー、無効 token/正常キャンセルを確認
- 2026-03-16: `billing` `billing/history` に fixture モードを追加し、past_due アラート、契約サマリー、通知従量課金、Webhook 失敗履歴を確認する E2E シナリオを作成
- 2026-03-16: `dashboard` `dashboard/appointments-kpi` に fixture モードを追加し、overview / followups / KPI レポートの主要集計カード、離脱予兆、担当者別 KPI を確認する E2E シナリオを作成
- 2026-03-16: `dashboard?tab=operations` `dashboard?tab=reoffers` に E2E シナリオを追加し、遅延時間帯、近接予約、未会計アラート、公開予約 KPI アラート、再販パネル初期表示を確認
- 2026-03-16: `support-tickets` `support-chat` に E2E シナリオを追加し、redirect、一覧表示、チケット起票、コメント追記の導線を確認
- 2026-03-16: `inventory` `inventory/reorder-suggestions` `inventory/products` に fixture モードを追加し、不足アラート、発注提案、商品マスタ一覧、作成/編集モーダル初期表示を確認する E2E シナリオを作成
- 2026-03-16: `hotel` に fixture モードを追加し、ホテル台帳一覧、稼働カレンダー、運用設定、商品台帳、新規予約モーダル初期表示を確認する E2E シナリオを作成
- 2026-03-16: `inventory/stocks` `inventory/history` `inventory/reports` に fixture モードを追加し、low filter、履歴整形、30 日入出庫・在庫資産・カテゴリ別出庫量を確認する E2E シナリオを作成
- 2026-03-16: `inventory/inbounds` `inventory/outbounds` `inventory/purchase-orders` に fixture モードを追加し、登録フォーム初期値、最新履歴、発注明細表示を確認する E2E シナリオを作成
- 2026-03-16: `inventory/stocktake` に fixture モードを追加し、帳簿在庫付き商品選択、差異理由の既定値、棚卸調整履歴の表示を確認する E2E シナリオを作成
- 2026-03-16: `hotel` に route mock ベースの更新系 E2E を追加し、予約作成、予約更新、設定保存、削除完了メッセージまで確認
- 2026-03-16: `support-chat` に owner view 向け route mock E2E を追加し、会話表示、送信後再読込、入力欄クリアを確認
- 2026-03-16: `hotel` 商品台帳に route mock ベースの更新系 E2E を追加し、商品作成、商品更新、商品削除、ハイシーズン切替後の件数変化まで確認
- 2026-03-16: `dev/support-chat` `dev/support-tickets` に route mock E2E を追加し、スレッド選択、返信、ステータス更新、店舗別チケット表示を確認
- 2026-03-16: `dashboard/notification-logs` `dashboard/audit-logs` に fixture モードを追加し、通知失敗理由内訳、監査ログ要約、member portal summary、JSON 詳細展開を確認する E2E シナリオを作成
- 2026-03-16: `settings/storage` と `receipts/[payment_id]` に fixture モードを追加し、ストレージ警告表示、容量フォーム初期値、領収書の施術内訳と支払情報を確認する E2E シナリオを作成
- 2026-03-16: Chromium 依存導入後に Playwright 実ブラウザ実行を再開し、`appointments` `customers` `payments` の focused run で strict mode 差分を修正、領収書・会計・顧客一覧・予約一覧の大半を通過
- 2026-03-16: `AppointmentCalendar` に mount 後の `sessionStorage` fallback と Playwright 専用初期 alert fixture を追加し、focused browser run で `appointments` `customers` `payments` 9/9 シナリオ通過を確認
- 2026-03-16: `billing` `dashboard` `dashboard-log` の focused browser run を開始し、まず 7 本中 1 本通過、残りは selector の重複と query 付き再遷移 timeout が中心と切り分け
- 2026-03-16: `/ops/today` に fixture モードと focused E2E を追加し、KPI、予約カード、固定アクションの実ブラウザ確認まで完了
- 2026-03-16: `dashboard-pages.spec.ts` は `?tab=followups|operations|reoffers` への直遷移へ寄せて focused browser run 3/3 通過を確認
- 2026-03-16: `dashboard-log-pages.spec.ts` の件数サマリー assertion を whitespace 許容の正規表現へ修正し、`billing-pages.spec.ts` + `dashboard-log-pages.spec.ts` の focused browser run を clean port (`3100`) で 4/4 通過
- 2026-03-16: `dashboard-pages` `ops-today` `billing-pages` `dashboard-log-pages` を clean port (`3100`) で再検証し、`--workers=1` 条件で focused bundle 8/8 通過を確認
- 2026-03-16: `npm test` 42 件成功、`/appointments` の fixture モードで `HEAD /appointments?tab=list` 200 応答を確認
- 2026-03-16: 顧客一覧は LINE 連携表示、タグ整形、無断キャンセル件数、電話/住所の `未登録` 表示が UI 側仕様として重要
- 2026-03-16: ペット一覧は `0kg` 境界、QR プロフィール URL 再構成、持病一覧の整形、関連顧客のフォールバックが UI 固有で回帰しやすい
- 2026-03-16: メニュー一覧は `tax_included` / `is_active` / `is_instant_bookable` が `null` の場合に既定値へ倒す表示仕様を持たせないと、実際の保存ロジックと見え方がずれる
- 2026-03-16: 会計一覧は予約ラベルの JST 表示と支払日時の整形が UI 側責務で、未整形だと運用画面で時刻解釈を誤りやすい
- 2026-03-16: 予約カレンダーは遅延影響アラートと競合時刻の整形が UI 固有仕様で、予約申請ステータスの色分けも表示ロジックとして固定が必要
- 2026-03-16: スタッフ管理はライトプランの上限 3 人制御、未連携/未所属/非表示の権限ラベル、招待期限の JST 表示が運用判断に直結する
- 2026-03-16: 課金画面は契約終了日・試用終了日・Webhook履歴の JST 整形、ステータスバッジ色、操作種別ラベルが UI 固有で、運用判断に直結する
- 2026-03-16: 設定画面は owner/admin の編集可否表示、通知設定の既定値補正、followup 日数正規化が画面仕様として重要
- 2026-03-16: 公開予約画面は JST スロット表示、即時確定対象外メッセージ、家族予約サマリー、キャンセル画面の無効 URL 判定が UI 固有仕様として重要

## Fix Plan

- 予約一覧から着手し、画面表示に直結する整形ロジックを `src/lib` 配下へ小さく抽出して Node テストで回帰を防ぐ
- 既存の service テストでカバー済みの作成・削除・競合検知は重複実装せず、画面導線で不足しているケースのみ追加する
- 次の着手は予約作成モーダルとカレンダーで、実運用データのメニュー複数選択・多頭予約・当日混雑・無断キャンセル履歴表示を追加検証する
- 次の着手は顧客一覧とペット一覧で、電話番号・住所揺れ、多頭飼い、無断キャンセル表示、LINE 連携表示の実運用ケースを追加検証する
- 次の着手は `service-menus` と `payments` で、税込/税抜、複数メニュー合算、割引、POS 連携前提の境界金額を UI と service の両面で固定する
- 次の着手は `appointments?tab=calendar` と `staffs` で、担当競合、営業時間帯、多スタッフ配置、権限・表示名の運用ケースを固定する
- 次の着手は `dashboard` `billing` `billing/history` と `settings/**` で、課金状態、KPI 表示、設定フォールバック、営業時間・通知設定の画面整合を固定する
- 次の着手は `reserve/[store_id]` と `reserve/cancel` で、多頭予約、電話番号揺れ、QR 参照、キャンセル/再予約の公開導線を固定する
- 次の着手は未対応ページの優先度を棚卸しして残件を整理するか、必要なら `hotel` のカレンダーでより細かい client 操作を追加 E2E 化する

## Completed

- 2026-03-16: 既存テスト資産、バリデーション、ページ一覧、主要 API の一次解析完了
- 2026-03-16: `appointments` 一覧表示ロジックを `groomer_app/src/lib/appointments/presentation.ts` へ抽出し、`groomer_app/tests/appointments.presentation.test.ts` を追加
- 2026-03-16: `npm test` 通過、lint は差分確認中セッションの終了時にエラー出力なし
- 2026-03-16: `groomer_app/src/lib/appointments/form-presentation.ts` を追加し、予約作成モーダルの競合メッセージ、前回予約コピー対象、多頭予約継続サマリーを `groomer_app/tests/appointments.form-presentation.test.ts` でカバー
- 2026-03-16: `npm test` 33件成功、予約フォーム差分 lint 完了
- 2026-03-16: `groomer_app/src/lib/customers/presentation.ts` と `groomer_app/src/lib/pets/presentation.ts` を追加し、顧客一覧/ペット一覧の表示ルールを `groomer_app/tests/customers.presentation.test.ts` と `groomer_app/tests/pets.presentation.test.ts` でカバー
- 2026-03-16: `npm test` 35件成功、顧客/ペット差分 lint 完了
- 2026-03-16: `groomer_app/src/lib/service-menus/presentation.ts` と `groomer_app/src/lib/payments/presentation.ts` を追加し、メニュー一覧と会計一覧の表示ルールを `groomer_app/tests/service-menus.presentation.test.ts` と `groomer_app/tests/payments.presentation.test.ts` でカバー
- 2026-03-16: `npm test` 37件成功、メニュー/会計差分 lint 完了
- 2026-03-16: `groomer_app/src/lib/appointments/calendar-presentation.ts` と `groomer_app/src/lib/staffs/presentation.ts` を追加し、予約カレンダーとスタッフ管理/招待の表示ルールを `groomer_app/tests/appointments.calendar-presentation.test.ts` と `groomer_app/tests/staffs.presentation.test.ts` でカバー
- 2026-03-16: `npm test` 39件成功、カレンダー/スタッフ差分 lint 完了
- 2026-03-16: `groomer_app/src/lib/billing/presentation.ts` と `groomer_app/src/lib/settings/presentation.ts` を追加し、課金/設定画面の日時整形・権限表示・既定値補正を `groomer_app/tests/billing.presentation.test.ts` と `groomer_app/tests/settings.presentation.test.ts` でカバー
- 2026-03-16: `npm test` 41件成功、課金/設定差分 lint 完了
- 2026-03-16: `groomer_app/src/lib/public-reservations/presentation.ts` を追加し、公開予約フォーム/キャンセル画面のスロット表示・多頭予約サマリー・無効 URL 判定を `groomer_app/tests/public-reservations.presentation.test.ts` でカバー
- 2026-03-16: `npm test` 42件成功、公開予約差分 lint 完了

---

## 動画カルテ + AIプラン拡張（非破壊導入）
- Task ID: `TASK-415`
- ブランチ: `feature/video-mvp` -> `feature/ai-assist` -> `feature/ai-pro` -> `feature/ai-pro-plus`
- ステータス: `done`

### 運用前提
- 既存の写真カルテ（`medical_records` / `medical_record_photos` / 既存API / 既存UI）は挙動変更しない
- 新規機能は追加テーブル・追加API・追加UIで実装し、既存レスポンス契約は維持する
- 容量上限判定と追加容量課金導線は既存ロジックを再利用し、新規課金ロジックは追加しない
- 各フェーズは専用ブランチで実装し、PRレビュー完了後に `main` へ順次マージする

### Phase 1: MVP（branch: `feature/video-mvp`）

#### タスク1: 動画保存基盤（DB/Storage/API）
- タスク名: 動画保存基盤（DB/Storage/API）
- 目的: カルテに紐づく動画のアップロード・保存・再生URL払い出しを追加する
- 影響範囲: Supabase SQL、動画API、Storageポリシー（既存写真API/UIは変更なし）
- リスク: Storageポリシー誤設定による参照不可、容量計測漏れ
- 非破壊的移行案: 新規テーブル `medical_record_videos` と新規バケットを追加し、既存 `medical_record_photos` は不変更
- 完了条件: アップロードURL発行/完了/再生URL APIが稼働し、既存写真保存フローの回帰なし
- GitHubブランチ名: `feature/video-mvp`
- PR作成: `feat(video-mvp): add medical record video storage foundation`
- レビュー手順: DB migration差分、RLS、署名URLTTL、既存写真アップロード回帰を確認
- main へのマージ手順: `main` 最新取り込み -> CI green -> squash merge -> migration適用順序をRunbookへ記録
- 進捗:
  - [x] `medical_record_videos` 追加SQLを作成
  - [x] `supabase_multistore_rls.sql` の対象テーブルに `medical_record_videos` を追加
  - [x] 動画アップロード/再生APIの追加
  - [x] 動画Storageポリシー追加

#### タスク2: 写真+動画混在一覧UI
- タスク名: 写真+動画混在一覧UI
- 目的: カルテ詳細で写真と動画を同一タイムラインに表示し、種別バッジで判別可能にする
- 影響範囲: `/medical-records` 一覧/詳細UI、新規混在フィードAPI
- リスク: 既存写真表示順の崩れ、モバイル描画負荷
- 非破壊的移行案: 既存写真描画コンポーネントを残し、`mediaType` 分岐で動画カードを追加
- 完了条件: 混在一覧表示、動画サムネ/再生、既存写真編集導線が維持される
- GitHubブランチ名: `feature/video-mvp`
- PR作成: `feat(video-mvp): integrate mixed media feed in medical records`
- レビュー手順: UI差分比較、アクセシビリティ、E2Eで写真のみ店舗の表示維持を確認
- main へのマージ手順: デザイン確認承認 -> E2E pass -> merge
- 進捗:
  - [x] カルテ一覧のメディア件数を「写真 + 動画」表示へ拡張
  - [x] 最新メディア（写真・動画）混在セクションを一覧タブに追加
  - [x] カルテモーダルに「施術動画を撮る」ボタンを追加（写真2ボタンは維持）
  - [x] 動画サムネイル生成ジョブとの接続
  - [x] 混在一覧のE2Eテスト追加
  - [x] 最新メディア写真で署名URL生成対象に `recentPhotos` を追加し、`プレビューなし` 表示不具合を修正

#### タスク3: LINE短尺動画生成（10-20秒）と容量連動
- タスク名: LINE短尺動画生成と容量連動
- 目的: 既存LINE共有導線に短尺動画生成結果を接続し、容量加算を反映する
- 影響範囲: 動画ジョブAPI、Storage使用量集計、共有UI
- リスク: 生成失敗時の再試行ループ、容量二重加算
- 非破壊的移行案: 生成物を新規 `source_type=ai_generated` で分離し、容量加算は既存集計関数へ統合
- 完了条件: 10-20秒生成、LINE共有、容量上限時に既存追加容量導線へ遷移
- GitHubブランチ名: `feature/video-mvp`
- PR作成: `feat(video-mvp): add line short video generation and quota integration`
- レビュー手順: 実動画で生成時間/失敗時挙動/容量閾値の境界値テスト確認
- main へのマージ手順: 監視項目追加後に merge
- 進捗:
  - [x] 10〜20秒動画のみをLINE短尺として扱うAPIを追加
  - [x] LINE短尺をStorage内で複製保存し、容量消費に連動
  - [x] 既存LINE通知ログ基盤を使った動画送信APIを追加
  - [x] LINE送信失敗時の運用再試行UI

### Phase 2: AI Assist（branch: `feature/ai-assist`）

#### タスク4: AI Assist推論ジョブ基盤
- タスク名: AI Assist推論ジョブ基盤
- 目的: 自動サムネ・タグ・カルテ文・ショート動画生成を非同期実行する
- 影響範囲: `ai_jobs` / `ai_results` テーブル、新規ワーカー、Assist API
- リスク: ジョブ詰まり、推論遅延、誤タグ
- 非破壊的移行案: 手動入力導線を残し、AI結果は追記扱いで上書きしない
- 完了条件: Assistジョブ投入/進捗/結果保存、失敗時リトライ、UI反映が可能
- GitHubブランチ名: `feature/ai-assist`
- PR作成: `feat(ai-assist): add async assist inference pipeline`
- レビュー手順: キュー再実行、タイムアウト、再試行上限、監査ログを確認
- main へのマージ手順: ステージング負荷試験通過後に merge
- 進捗:
  - [x] `ai_jobs` / `ai_results` 相当のジョブテーブル追加
  - [x] Assist推論ワーカー（サムネ/タグ/カルテ文/ショート動画）実装
  - [x] ジョブ投入API・進捗取得API・再試行制御を追加
  - [x] Assist結果のUI反映（既存手入力優先）を実装

#### タスク5: AI Assist課金オプション追加（¥1,280）
- タスク名: AI Assist課金オプション追加
- 目的: 既存「ホテル/通知強化」と同形式でAssistの契約ON/OFFを可能にする
- 影響範囲: `/billing` UI、billing options API、価格表示
- リスク: 既存オプション請求額計算との競合
- 非破壊的移行案: 既存オプション構造を拡張（列追加 or 子テーブル）し既存項目は不変更
- 完了条件: 価格・説明・契約状態表示、変更注意文、アップグレード導線が表示される
- GitHubブランチ名: `feature/ai-assist`
- PR作成: `feat(ai-assist): add ai assist option to billing page`
- レビュー手順: 金額表示、状態遷移、既存ホテル/通知切替の回帰確認
- main へのマージ手順: 請求シミュレーション結果確認後に merge
- 進捗:
  - [x] `store_subscriptions.ai_plan_code` 追加SQLを作成
  - [x] 課金ページに AI Assist / Pro / Pro+ 切替UIを追加
  - [x] `/api/billing/options` で AIプラン変更を受け付け
  - [x] 決済checkout連携の価格ID分岐（AIプラン込み）を追加

### Phase 3: AI Pro（branch: `feature/ai-pro`）

#### タスク6: AI Pro分析（性格/行動/予測）
- タスク名: AI Pro分析機能
- 目的: 性格分析・行動分析・施術時間予測・毛玉/追加料金予測を追加する
- 影響範囲: Pro推論API、結果表示UI、推論結果スキーマ
- リスク: 予測誤差、説明可能性不足
- 非破壊的移行案: 予測値は「提案値」として表示し、既存手入力値を優先保存
- 完了条件: Pro契約店舗のみ分析実行/表示、重要シーン抽出が機能する
- GitHubブランチ名: `feature/ai-pro`
- PR作成: `feat(ai-pro): add behavior and estimate predictions`
- レビュー手順: プランゲート、推論結果のnull耐性、既存カルテ保存との整合確認
- main へのマージ手順: QAチェックリスト完了後に merge
- 進捗:
  - [x] `medical_record_ai_pro_insights` 追加SQLを作成
  - [x] AI Pro分析API（`/api/medical-records/[record_id]/ai-pro`）を追加
  - [x] カルテ一覧に AI Pro提案表示と解析実行ボタンを追加（pro/pro_plusのみ）
  - [x] AI Pro推論ロジックの単体テストを追加

#### タスク7: AI Pro課金オプション追加（¥1,980）
- タスク名: AI Pro課金オプション追加
- 目的: AssistからProへのアップグレード導線と契約状態表示を追加する
- 影響範囲: `/billing` UI、プラン変更API、注意文表示
- リスク: 即時反映/次月反映の誤表示
- 非破壊的移行案: 反映タイミングは既存課金基盤の判定結果を表示のみで扱う
- 完了条件: Pro価格・機能・状態表示、変更確認フローが動作する
- GitHubブランチ名: `feature/ai-pro`
- PR作成: `feat(ai-pro): add ai pro option and upgrade flow`
- レビュー手順: アップ/ダウングレード文言、課金履歴表示、監査ログ確認
- main へのマージ手順: Billingレビュー承認後に merge
- 進捗:
  - [x] 課金ページのAIプラン切替UIで Pro 選択導線を有効化
  - [x] `/api/billing/options` で Pro への切替保存を実装
  - [x] 決済checkout連携の価格ID分岐で Pro を反映
  - [x] 契約状態表示（現在のAIプラン）に Pro を反映

### Phase 4: AI Pro+（branch: `feature/ai-pro-plus`）

#### タスク8: AI Pro+高度分析/レポート
- タスク名: AI Pro+高度分析/レポート
- 目的: 健康異常気づき、月次レポート、教育用ハイライト生成を追加する
- 影響範囲: 高精度推論パイプライン、月次集計、レポートUI
- リスク: 誤検知、処理コスト増、夜間バッチ遅延
- 非破壊的移行案: 通知は「注意喚起」表示に限定し、医療判断を行わない注記を固定表示
- 完了条件: Pro+契約店舗でのみ実行・閲覧可能、月次レポートが生成保存される
- GitHubブランチ名: `feature/ai-pro-plus`
- PR作成: `feat(ai-pro-plus): add advanced health insights and monthly reports`
- レビュー手順: 性能計測、誤検知時UI、レポート再生成動線を確認
- main へのマージ手順: 段階リリース設定後に merge
- 進捗:
  - [x] `medical_record_ai_pro_plus_health_insights` / `store_ai_monthly_reports` 追加SQLを作成
  - [x] AI Pro+解析API（`/api/medical-records/[record_id]/ai-pro-plus`）を追加
  - [x] AI Pro+月次レポートAPI（`/api/ai-reports/monthly`）を追加
  - [x] カルテ一覧に AI Pro+気づき表示と解析実行ボタンを追加（pro_plusのみ）

#### タスク9: AI Pro+課金オプション追加（¥2,480）
- タスク名: AI Pro+課金オプション追加
- 目的: AI Pro+の契約切替とPro機能強化版の表示制御を追加する
- 影響範囲: `/billing` UI、価格表示、契約状態判定
- リスク: 既存課金明細の分類不整合
- 非破壊的移行案: 既存明細テーブルに新しい `subscription_scope`/`option_code` を追加し旧データはそのまま
- 完了条件: Pro+価格・機能比較・契約状態・変更注意文が反映される
- GitHubブランチ名: `feature/ai-pro-plus`
- PR作成: `feat(ai-pro-plus): add ai pro plus option on billing`
- レビュー手順: 明細整合、UI表示崩れ、既存オプション回帰の確認
- main へのマージ手順: 監視アラート設定完了後に merge
- 進捗:
  - [x] 課金ページのAIプラン切替UIで Pro+ 選択導線を有効化
  - [x] `/api/billing/options` で Pro+ への切替保存を実装
  - [x] 決済checkout連携の価格ID分岐で Pro+ を反映
  - [x] 契約状態表示（現在のAIプラン）に Pro+ を反映

### フェーズ横断の共通完了条件
- 既存の写真カルテ作成/編集/共有が回帰していない
- 容量上限到達時に既存追加容量課金導線へ遷移できる
- `npm run lint` / `npm run build` / 主要テストが通過する
- PRテンプレートに「後方互換性」「非破壊移行」「容量連動」の確認結果を記載する

### 推奨マージ順
1. `feature/video-mvp`
2. `feature/ai-assist`
3. `feature/ai-pro`
4. `feature/ai-pro-plus`

## サイドバー改善（2026-03-21）
- Task ID: `TASK-416`
- ブランチ: `feature/sidebar-navigation-improvement`
- ステータス: `done`
- 概要: サイドバーの名称・並び順を再編し、設定系/課金系をそれぞれタブ統合ページへ集約する
- 完了条件:
  - `店舗設定` を `店舗管理` へ改名
  - `公開予約設定 / 通知設定 / 容量設定 / 新しい店舗を追加` を単一の `店舗管理` ページ内タブで運用
  - `サブスク課金 / 課金履歴` を単一の `課金管理` ページ内タブで運用
  - `サブスク課金 -> 決済管理`、`課金履歴 -> 決済履歴` に改名
  - `ペットホテル管理` を `来店履歴` の上へ移動
  - `モバイル当日運用` を `顧客管理` の上へ移動
  - `ユーザーマニュアル` と `問い合わせ` を `その他` カテゴリに移し、`店舗管理` の次に配置
- 進捗:
  - [x] 専用ブランチ作成
  - [x] サイドバー再編
  - [x] 店舗管理タブページ実装
  - [x] 課金管理タブページ実装
  - [x] 旧URLの互換リダイレクト整備
  - [x] テスト更新
  - [x] lint/test 実行

### 追記事項: 優先度見直し（2026-03-21）
- 概要: サイドバーの情報設計を業務優先に見直し、メイン上段から分析系リンクを下段へ移動する
- 完了条件:
  - `メイン` セクションは `ダッシュボード` のみ表示
  - `KPIレポート / 通知ログ / 監査ログ` は下段の `運用分析` セクションへ移動
- 進捗:
  - [x] TASKS追記
  - [x] サイドバー実装

### 追記事項: カテゴリ視認性（2026-03-21）
- 概要: カテゴリ名とメニューの境界を明確にするため、カテゴリ見出しに横線を追加する
- 完了条件:
  - 店舗/HQ サイドバーのカテゴリ見出しに「カテゴリ名 + 横線」を適用
  - Dev サイドバーにも同様のカテゴリ見出しスタイルを適用
- 進捗:
  - [x] TASKS追記
  - [x] UI実装

### 追記事項: 並び順調整（2026-03-21）
- 概要: 日次運用導線を優先するため、メニューとカテゴリの順序を再調整する
- 完了条件:
  - `モバイル当日運用` を `ダッシュボード` の直下に移動
  - `施術メニュー管理` を `ペット管理` の直下に移動
  - `運用分析` カテゴリを `店舗管理` カテゴリの上に移動
- 進捗:
  - [x] TASKS追記
  - [x] サイドバー実装

### 追記事項: マニュアル整合（2026-03-21）
- 概要: サイドバー改修後の名称・導線にあわせてユーザーマニュアルを棚卸しし、旧表記/旧URLを更新する
- 完了条件:
  - `サブスク課金 / 課金履歴` を `決済管理 / 決済履歴` に更新
  - マニュアル内の設定/課金導線をタブ統合後のURLへ更新
  - 修正要否の判断結果をTASKSへ記録
- 進捗:
  - [x] 影響確認
  - [x] manual-data修正

## AI動画段階実装（2026-03-21）
- Task ID: `TASK-417`
- ブランチ: `feature/ai-video-tiered-rollout`
- ステータス: `in_progress`
- 概要: Assist / Pro / Pro+ の境界を守りつつ、動画機能を段階導入する
- 完了条件:
  - Assist: 動画AI非使用で短尺化・テロップ・要約・LINE最適化ジョブを実装
  - Pro: Vision LLM相当の工程推定・協力度/ストレス・文章下書きジョブを実装
  - Pro+: GPT-4o Vision相当の健康気づきと動画AIハイライトジョブを実装
  - プランゲートを共通化し、Pro+以外で動画AIが呼ばれない
  - カルテ画面の動画タブにプラン別操作を追加し、既存導線を破壊しない
- 進捗:
  - [x] Step 1: 既存コード解析（動画アップロード/プラン判定/UI/ジョブ）
  - [x] Step 2: Assist軽量動画ジョブ基盤実装
  - [x] Step 3: Pro工程推定ジョブ基盤実装
  - [x] Step 4: Pro+動画AI/健康気づきジョブ基盤実装
  - [x] Step 5: 動画タブUIのプラン別操作追加
  - [x] Step 6: lint/testと差分確認
  - [x] Step 7: LLM/動画AI adapter の外部API切替基盤（envでmock/external切替）を追加
  - [x] Step 8: `.env` サンプルと開発者向け設定手順（Runbook/Manual）を追記
  - [ ] Step 9: ステージングで実API疎通確認（Assist/Pro/Pro+の課金・失敗時挙動）
    - [x] Step 9-1: 検証マトリクス/確認SQL/記録観点を Runbook に追加
    - [ ] Step 9-2: ステージング実行（mock→openai→external動画AI）と結果記録
  - [x] Step 10: adapter 安全化（timeout/retry）を実装
  - [x] Step 11: 課金ログ基盤（provider/billing情報を result_payload/metrics に保存）を実装
  - [x] Step 12: 差分検証（lint/build）を実施
  - [x] Step 13: 運用監視整備（failed閾値アラート / dashboard SQL固定化 / lint warning解消 / PR差分整理）
    - [x] Step 13-1: failed閾値アラート（1時間で5件超）を実装
    - [x] Step 13-2: `job_runs` + `medical_record_ai_video_jobs` のダッシュボードSQLをRunbookへ固定化
    - [x] Step 13-3: lint warning（`_request`未使用）を解消
    - [x] Step 13-4: TASKS更新とPR用差分整理
  - [x] Step 14: Step 9-2 実行支援（staging実行コマンド/結果記録テンプレート）を整備
    - [x] Step 14-1: Runbookにステージング実行コマンドを追記
    - [x] Step 14-2: 実行結果記録テンプレートを追加
  - [x] Step 15: `/dev/cron` 可視化強化（job_runs + medical_record_ai_video_jobs 監視カード）を追加
  - [x] Step 16: `/dev/cron` 監視カードに failed 閾値超過アラート表示を追加
  - [x] Step 17: PR提出向け最終整理（RunbookへPRテンプレ/確認観点/スクショ項目）を追加

## オプション課金確定ゲート整備（2026-03-22）
- Task ID: `TASK-418`
- ブランチ: `feature/billing-option-entitlement-gate`
- ステータス: `done`
- 概要: AI / ホテル / 通知強化を「申込即時有効」ではなく「支払い確定後有効」に統一する
- 完了条件:
  - `requested`（申込状態）と `effective`（利用可状態）を分離
  - `/api/billing/options` は `requested` のみ更新
  - webhook 成功イベントで `effective` を更新
  - AI / ホテル / 通知強化の利用ゲートは `effective` を参照
  - Billing UI に「申込中 / 有効」の状態表示を追加
  - 既存店舗は後方互換で安全に移行できる
- 進捗:
  - [x] Step 1: 現状調査（AI/ホテル/通知強化が即時有効化される経路）を確認
  - [x] Step 2: DB拡張設計（requested/effective列、移行方針）を確定
    - `store_subscriptions` に `ai_plan_code_requested / ai_plan_code_effective` を追加（`none|assist|pro|pro_plus`）
    - `store_subscriptions` に `hotel_option_requested / hotel_option_effective` を追加（boolean）
    - `store_subscriptions` に `notification_option_requested / notification_option_effective` を追加（boolean）
    - 初期移行は既存値を `requested` と `effective` の両方へ backfill（既存挙動を維持）
    - 互換期間は既存列を残し、アプリ側は `effective` 優先・既存列fallbackで段階移行
  - [x] Step 3: `/api/billing/options` を申込状態更新へ変更
    - `hotel_option_requested / notification_option_requested / ai_plan_code_requested` のみ更新
    - `amount_jpy` の即時更新を停止（支払い確定前の見かけ上アップグレードを防止）
    - 未マイグレーション環境は `_requested` 列不足を明示エラーで通知
  - [x] Step 4: webhook連動で有効化状態を更新
    - Stripe/KOMOJU の成功イベントで `applyRequestedOptionEntitlements` を実行
    - `requested -> effective` 反映時に既存列（`ai_plan_code` / `hotel_option_enabled` / `notification_option_enabled`）も同期
    - `supabase_store_subscriptions_option_entitlements.sql` を追加（列追加+backfill+制約）
  - [x] Step 5: 機能ゲート（AI/ホテル/通知強化）を effective 参照に統一
    - AI API（record/video/月次レポート）とカルテ画面のAI表示判定を `ai_plan_code_effective` 優先へ変更
    - `store-plan-options` を `hotel_option_effective / notification_option_effective / ai_plan_code_effective` 優先に更新
    - ホテル通知ジョブと通知従量課金ジョブを `*_option_effective` 優先へ変更（旧列fallback維持）
  - [x] Step 6: Billing UI 表示（申込中/有効）を追加
    - 決済管理画面で `effective`（有効）と `requested`（申込中）を分離表示
    - ホテル/通知/AI それぞれに pending 表示（申込中の有効化/無効化）を追加
    - 決済開始時のオプション計算は `requested` を利用するよう調整
  - [x] Step 7: lint/build と回帰確認
    - `npm run lint` 成功
    - `npm run build` 成功
  - [x] Step 8: Runbook / Manual / TASKS 更新とPR差分整理
    - Runbook に `supabase_store_subscriptions_option_entitlements.sql` 追加と requested/effective 運用方針を追記
    - TASKS を Step 8 まで更新し、PR作成前の差分整理状態に移行

## 法務・規約コンプライアンス是正（2026-03-22）
- Task ID: `TASK-419`
- ブランチ: `feature/legal-compliance-hardening`
- ステータス: `done`
- 概要: 規約同意取得・課金条件明示・解約導線明示・法務文書具体化を行い、国内SaaS実務レベルの説明責任を補強する
- 完了条件:
  - 新規登録で規約/プライバシー/特商法への同意を必須化
  - 決済前に法務リンクと同意導線を表示
  - LPに無料トライアルから自動課金までの条件を明示
  - 利用規約に予約トラブル責任分界、写真/動画権利、外部依存免責、異議申立てを追記
  - プライバシーポリシーに保存期間の具体値と退会後削除方針を追記
  - 特商法表記に解約方法の画面導線と返金例外を追記
  - `docs/legal/CHANGELOG.md` を更新
- 進捗:
  - [x] ブランチ作成
  - [x] 新規登録の同意取得UI実装
  - [x] 課金前同意導線実装
  - [x] LP課金条件表示の明確化
  - [x] 規約文面の具体化
  - [x] プライバシーポリシー文面の具体化
  - [x] 特商法文面の具体化
  - [x] legal CHANGELOG更新
  - [x] lint/test 実行

## dev課金操作の安全運用化（2026-03-22）
- Task ID: `TASK-420`
- ブランチ: `feature/dev-billing-safe-ops`
- ステータス: `done`
- 概要: devサブスク管理を requested/effective 前提の請求フローへ揃え、誤課金・未課金有効化・状態不整合を防ぐ
- 完了条件:
  - `/dev/subscriptions` でオプション/AIプランを legacy `*_enabled` 直更新しない
  - dev更新APIは `hotel_option_requested / notification_option_requested / ai_plan_code_requested` を更新し、移行未適用時は明示エラーにする
  - `billing-trial-rollover` の料金計算を requested/effective + AIプラン考慮に揃える
  - 課金確定後に requested -> effective を反映する経路（webhook/cron）の安全性を強化
  - 関連テストを追加または更新し、回帰観点を固定する
- 進捗:
  - [x] ブランチ作成
  - [x] TASKS追記
  - [x] devサブスク管理UI/APIの安全化
  - [x] trial rollover課金計算の整合化
  - [x] 回帰テスト整備
  - [x] lint/test 実行

## POS機能導入計画（要件定義〜実装）
- Task ID: `TASK-408`
- ブランチ: `feat/TASK-408-pos-implementation-plan`
- ステータス: `in_progress`
- 概要: 既存の会計（payments/invoices）・在庫（inventory）基盤を活かし、店舗運用で使えるPOS機能を段階導入する
- 影響範囲: POS UI / Invoice・Payment API / Inventory Movement / Receipt / Manual・Runbook / E2E
- リスク:
  - 既存統合会計（TASK-401）との二重計上
  - 返品/取消時の在庫戻し漏れ
  - 締め処理の現金差異集計ミス
  - 店舗スコープ/RLS逸脱
- 完了条件:
  - 要件定義書（MVP範囲、非機能要件、受け入れ基準）を確定
  - 実装タスクを `TASK-POS-001` 〜 `TASK-POS-006` に分解し、依存順を明示
  - 既存会計・在庫基盤との統合方針（拡張点/非対応点）を明記
  - 各タスクに DoD（定義済み完了条件）とテスト観点を設定
- 進捗:
  - [x] 既存資産調査（payments / invoices / inventory / receipts）
  - [x] POS計画の初版作成
  - [x] TASKSへのタスク分解反映
  - [x] 実装フェーズ開始（TASK-POS-001 から着手）
  - [x] `docs/pos-requirements-definition.md` を追加（MVP要件・GWT12ケース）
  - [x] `docs/pos-data-api-contract.md` を追加（データモデル/API契約ドラフト）
  - [x] `supabase/supabase_pos_core.sql` を追加（DDL + RLS草案）

### POS実装タスク分解

#### TASK-POS-001 要件定義・業務フロー確定
- ブランチ: `feat/TASK-POS-001-pos-requirements`
- ステータス: `in_progress`
- 目的: 店舗運用に必要なPOS業務（通常会計/返品/取消/締め）を仕様化する
- スコープ:
  - ユースケース定義（トリミング会計、ホテル会計、物販会計、混在会計）
  - 支払手段と運用ルール（現金/カード/QR/電子マネー/その他）
  - 値引き/クーポン/端数処理方針
  - 返品・取消・再発行の監査方針
- DoD:
  - 要件定義ドキュメントを `docs/` に追加
  - 受け入れ基準（Given/When/Then）を主要10ケース以上で定義
  - 非機能要件（性能/監査/可用性）を確定
- テスト観点:
  - 仕様テストケース一覧の作成
  - 既存会計導線との互換確認項目の確定
- 進捗:
  - [x] 要件定義ドキュメント作成（`docs/pos-requirements-definition.md`）
  - [x] 受け入れ基準（Given/When/Then）12ケース定義
  - [x] 非機能要件（性能/監査/可用性/セキュリティ）定義
  - [ ] レビュー反映と確定版化

#### TASK-POS-002 データモデル・API契約設計
- ブランチ: `feat/TASK-POS-002-pos-data-contract`
- ステータス: `in_progress`
- 目的: POS伝票・レジ締め・返金を扱うDB/API基盤を設計する
- スコープ:
  - 新規テーブル案: `pos_sessions`, `pos_orders`, `pos_order_lines`, `pos_payments`, `pos_refunds`, `cash_drawer_events`
  - 既存拡張: `invoice_lines` の物販行対応、`payments` との紐づけ
  - API契約: 作成/確定/取消/返金/締め処理
- DoD:
  - SQLマイグレーションを `supabase/` に追加
  - API contract を `docs/` に追加
  - RLS方針・監査ログ方針を定義
- テスト観点:
  - スキーマ整合性テスト
  - RLS観点（他店舗アクセス不可）の検証項目
- 進捗:
  - [x] 契約ドラフト作成（`docs/pos-data-api-contract.md`）
  - [x] 新規テーブル案・既存テーブル連携方針を定義
  - [x] SQLマイグレーション草案作成（`supabase/supabase_pos_core.sql`）
  - [x] SQLマイグレーション案の確定（主要制約・一意性を反映）
  - [x] APIレスポンス契約の最終化（status/code/response schema を明記）

#### TASK-POS-003 POS会計画面（MVP）実装
- ブランチ: `feat/TASK-POS-003-pos-checkout-ui`
- ステータス: `done`
- 目的: サービス＋物販を1画面で会計確定できるPOS UIを実装する
- スコープ:
  - POSカート（明細追加/数量変更/値引き）
  - 支払方法選択と会計確定
  - 領収書表示への遷移
  - 既存`/payments`導線との棲み分け
- DoD:
  - `/payments` またはPOS専用画面でMVP操作が完了する
  - エラー時の再実行/重複防止（idempotency）が機能する
  - モバイル幅で操作できる
- テスト観点:
  - 単体: 税・割引・合計計算
  - E2E: 伝票作成→会計確定→領収書遷移
- 進捗:
  - [x] `/payments` に POS会計（β）パネルを追加
  - [x] POSカート合計計算ロジックを `src/lib/pos/checkout.ts` に追加
  - [x] 単体テスト追加（`tests/pos.checkout.test.ts`）
  - [x] 会計確定API（`/api/pos/orders/:order_id/confirm`）接続
  - [x] 確定後の領収書遷移を本実装
  - [x] 取消導線（`/receipts/[payment_id]` から `/api/pos/orders/:order_id/void` 実行）を実装

#### TASK-POS-004 在庫連動（自動出庫/返品戻し）実装
- ブランチ: `feat/TASK-POS-004-pos-inventory-link`
- ステータス: `done`
- 目的: 物販会計・返品時に在庫を自動で増減させる
- スコープ:
  - 会計確定時の `inventory_movements` 自動起票
  - 返品/取消時の逆仕訳
  - 在庫不足時のエラーハンドリング
- DoD:
  - 会計/返品の在庫反映が一貫して実行される
  - 手動出庫との二重起票を防止する
  - 在庫履歴画面で追跡可能
- テスト観点:
  - 単体: 増減ロジック
  - 結合: POS会計→在庫履歴の整合
- 進捗:
  - [x] POS会計確定時の自動出庫起票を実装（`confirm` API）
  - [x] POS取消時の在庫戻し起票を実装（`void` API）
  - [x] notesキー（`POS_OUTBOUND:*` / `POS_VOID_REVERT:*`）による重複起票防止を実装
  - [x] 増減ロジック単体テストを追加（`tests/pos.inventory.test.ts`）
  - [x] 在庫履歴画面でPOS自動起票フィルタを追加（`/inventory/history?source=pos_auto`）

#### TASK-POS-005 レジ開閉局・日次締め実装
- ブランチ: `feat/TASK-POS-005-pos-day-close`
- ステータス: `done`
- 目的: 現場で必要なレジ開局/中間入出金/締め処理を追加する
- スコープ:
  - レジセッション開始/終了
  - 現金入出金イベント記録
  - 日次売上集計・現金差異入力
- DoD:
  - 日次締めレポート（支払手段別・差異含む）を出力
  - 締め確定後の再編集制約を実装
  - 監査ログに操作主体が残る
- テスト観点:
  - 集計ロジックの単体テスト
  - 締め処理のE2E（開局→会計→締め）
- 進捗:
  - [x] レジ開局APIを追加（`POST /api/pos/sessions/open`）
  - [x] 現金入出金APIを追加（`POST /api/pos/cash-drawer-events`）
  - [x] 日次締めAPIを追加（`POST /api/pos/sessions/:session_id/close`）
  - [x] 集計ロジック単体テストを追加（`tests/pos.session-close.test.ts`）
  - [x] 締め処理の画面導線実装（`/payments` POSパネルで開局→会計→締め）

#### TASK-POS-006 受入試験・移行・運用ドキュメント整備
- ブランチ: `feat/TASK-POS-006-pos-uat-rollout`
- ステータス: `in_progress`
- 目的: パイロット導入に必要な検証・運用資料を完了する
- スコープ:
  - 店舗UAT（通常会計/返品/締め）
  - データ移行/初期設定手順
  - 障害時ロールバック手順
  - マニュアル更新
- DoD:
  - UATチェックリスト完了
  - `docs/` の運用手順が最新化
  - 本番段階展開計画（pilot→full）が承認済み
- テスト観点:
  - 回帰テスト（既存会計/在庫/予約への影響）
  - 負荷・運用手順リハーサル
- 進捗:
  - [x] UATチェックリストを追加（`docs/pos-uat-checklist.md`）
  - [x] 移行/初期設定手順を追加（`docs/pos-migration-initial-setup.md`）
  - [x] pilot→full展開Runbookを追加（`docs/pos-pilot-rollout-runbook.md`）
  - [x] pilot→full承認記録テンプレを追加（`docs/pos-pilot-approval-record.md`）
  - [x] 店舗向けPOS操作マニュアルを追加（`docs/pos-operations-user-manual.md`）
  - [ ] パイロット店舗でUAT実施（チェックリスト実測）
  - [ ] pilot→full承認記録の反映

#### TASK-POS-007 POS一本化（トリミング/ホテル会計統合）
- ブランチ: `feat/TASK-POS-007-pos-unification`
- ステータス: `done`
- 目的: 既存のInvoice中心導線をPOS中心導線へ段階統合し、会計画面を一本化する
- スコープ:
  - 予約メニュー（トリミング）明細のPOS取り込み
  - ホテル明細のPOS取り込み
  - POS会計APIで `service` 明細を正式処理
  - 既存Invoice導線との整合（段階的縮退）
- DoD:
  - `/payments` のPOSでトリミング/ホテル/店販を同一カートで会計確定できる
  - 既存在庫連動・取消・締め処理と矛盾しない
  - 運用マニュアルと契約書が一本化方針へ更新されている
- テスト観点:
  - 単体: カート合計（service+product混在）
  - E2E: 開局→明細取込→会計確定→領収書→取消→締め
- 進捗:
  - [x] TASK登録・ブランチ作成
  - [x] POSカートで `line_type=service|product` を扱えるように改修
  - [x] 予約メニュー取込ボタンを追加
  - [x] ホテル明細取込ボタンを追加
  - [x] API契約・運用マニュアル更新
  - [x] E2Eケース追加（`e2e/payments-list.spec.ts`）
  - [x] E2E実行の安定化（webServer起動失敗/ブラウザインストール問題を解消）

### 依存順
1. `TASK-POS-001`
2. `TASK-POS-002`
3. `TASK-POS-003`
4. `TASK-POS-004`
5. `TASK-POS-005`
6. `TASK-POS-006`
7. `TASK-POS-007`
