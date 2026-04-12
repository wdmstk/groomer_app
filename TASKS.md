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
1. `TASK-449` ページ/APIルート網羅テストの一括強化（大塊PR運用）
2. `TASK-448` 顧客管理βページ改善（会員証URLカード配色統一）
3. `TASK-408` POS機能導入計画（要件定義〜実装）
4. `TASK-POS-006` 受入試験・移行・運用ドキュメント整備（`TASK-408`配下）

### todo
（なし）

### blocked
1. `TASK-417` AI動画段階実装（2026-04-06・ユーザー指示で保留）

### done
1. `TASK-447` サイドバー見た目改善（カテゴリ名とメニューの視認性分離）（2026-04-06）
2. `TASK-446` `.tsx` 向けVitest導入とUIコンポーネントテスト追加（2026-04-05）
3. `TASK-445` テスト品質/実装原則の運用ルール明文化とガード導入（2026-04-05）
4. `TASK-444` 店舗設定タブ再編と予約カレンダー営業時間連動（2026-04-05）
5. `TASK-443` 予約カレンダーの時間軸横向き化（2026-04-05）
6. `TASK-442` 店舗別決済アカウント接続と通常決済のStripe/KOMOJU対応（2026-04-05）
7. `TASK-441` 会員証URLのセルフ再取得導線（期限切れ時）（2026-04-05）
8. `TASK-440` 会員証URL有効期限の可変TTL設定（30/90/180日）（2026-04-05）
9. `TASK-439` 会員証ポータルからの空き枠待ち自己登録導線追加（2026-04-04）
10. `TASK-438` 顧客管理・ペット管理の統合ページ仕様策定（2026-04-02）
11. `TASK-437` 日誌機能（非破壊追加）仕様策定と実装管理（2026-03-31）
12. `TASK-436` 予約管理の同意書ステータスバッジと状態別導線追加（2026-03-31）
13. `TASK-435` 電子同意書管理のタブ分割・履歴PDF参照/削除・署名導線強化（2026-03-31）
14. `TASK-434` 既存店舗向け同意書テンプレ更新SQL作成（2026-04-06）
15. `TASK-433` 施術同意書標準テンプレート完全版差し替え（2026-03-29）
16. `TASK-432` 施術同意書の表示体裁改善とPDF2ページ化（2026-03-29）
17. `TASK-431` 予約管理起点の同意書作成導線とPDF作成強化（2026-03-29）
18. `TASK-430` 電子同意書管理のレイアウト統一・テンプレ本文再利用・PDF証跡強化（2026-03-28）
19. `TASK-429` アプリ名/会社名の全ページ反映（2026-03-28）
20. `TASK-428` 電子同意書PDF文字化け修正（日本語対応）（2026-03-27）
21. `TASK-427` 電子同意書Storageバケット不足エラー修正（2026-03-27）
22. `TASK-426` 電子同意書テンプレ差し込み表示とプレビュー実装（2026-03-27）
23. `TASK-425` 電子同意書の署名URL再取得導線追加（2026-03-27）
24. `TASK-424` 電子同意書テンプレートUIの用語/入力改善（2026-03-27）
25. `TASK-423` 電子同意書テンプレート標準初期化（店舗作成時の自動投入）（2026-03-27）
26. `TASK-422` 電子同意書（施術同意書）機能追加（2026-03-27）
27. `TASK-421` 競合LPベンチマーク整合のLP改修（2026-03-26）
28. `TASK-420` dev課金操作の安全運用化（2026-03-22）
29. `TASK-419` 法務・規約コンプライアンス是正（2026-03-22）
30. `TASK-418` オプション課金確定ゲート整備（2026-03-22）
31. `TASK-416` サイドバー改善（2026-03-21）
32. `TASK-415` 動画カルテ + AIプラン拡張（非破壊導入）
33. `TASK-414` 顧客LTV分析
34. `TASK-413` AIタグ解析ジョブのRLS修正（2026-04-06）
35. `TASK-412` AIタグ活用導線の改善（2026-04-06）
36. `TASK-411` 写真カルテのAIタグ付け
37. `TASK-410` LINEの自動マーケ
38. `TASK-409` 事前決済
39. `TASK-407` 開発環境で課金なしのプラン/オプション切替
40. `TASK-406` devサブスク保存後404修正
41. `TASK-405` タスク/ブランチ運用ガード追加とStorage設定導線整理
42. `TASK-404` HP本部運用にホテルメニュー向けテンプレ配信を追加
43. `TASK-403` ペット管理からQR機能を完全削除
44. `TASK-402` appointments更新後POST転送不具合修正
45. `TASK-401` 統合会計（Invoice方式）（2026-04-06）
46. `TASK-POS-007` POS一本化（トリミング/ホテル会計統合）（`TASK-408`配下）
47. `TASK-POS-005` レジ開閉局・日次締め実装（`TASK-408`配下）
48. `TASK-POS-004` 在庫連動（自動出庫/返品戻し）実装（`TASK-408`配下）
49. `TASK-POS-003` POS会計画面（MVP）実装（`TASK-408`配下）
50. `TASK-POS-002` データモデル・API契約設計（`TASK-408`配下）（2026-04-06）
51. `TASK-POS-001` 要件定義・業務フロー確定（`TASK-408`配下）（2026-04-06）

## 正式タスク詳細（Task ID採番済み）

## ページ/APIルート網羅テストの一括強化（大塊PR運用）
- Task ID: `TASK-449`
- ブランチ: `test/TASK-449-coverage-batch-rollout`
- 現在の作業ブランチ: `test/TASK-449-coverage-c10-billing-setup-pages-batch`
- ステータス: `in_progress`
- 概要: ページ79件/API176件の全対象を先に棚卸しし、細切れではなく大きな塊（4PR）でテスト網羅を進める。進捗は事前洗い出し済み項目に対して管理する。
- 影響範囲: `TASKS.md`、`docs/test-coverage-master-inventory-2026-04-11.md`、`docs/test-coverage-audit-2026-04-09.md`、`groomer_app/tests/*`、`groomer_app/e2e/*`
- リスク:
  - 1PRあたりの変更量増加によりレビュー負荷が上がる
  - 網羅優先で重複テストが増える可能性
- 完了条件:
  - 全対象（ページ79/API176）の事前洗い出し台帳が存在する
  - 大塊PRごとに対象領域・TRACE対応・検証コマンドが明記される
  - 最終的に「未対応項目ゼロ」または「除外理由付き」で説明可能な状態になる
- 進捗:
  - [x] 対象全件を事前洗い出し（255件）し、台帳を作成
  - [x] 大塊PR運用方針を `TASK-449` として正式登録
  - [x] B1先行着手: `/api/customers` ルート契約テストを追加（`TRACE-091`〜`TRACE-094`）
  - [x] B1追加: `/api/customers/[customer_id]` ルート契約テストを追加（`TRACE-095`〜`TRACE-098`）
  - [x] B1追加: `/api/customers/ltv` と `member-portal-reissue-requests` ルート契約テストを追加（`TRACE-099`〜`TRACE-102`）
  - [x] B1第2弾: `/api/appointments` 系ルート契約テストを追加（`TRACE-103`〜`TRACE-108`）
  - [x] B1第2弾: `/api/visits` 系既存テストの不足ケースを補完（`TRACE-109`〜`TRACE-110`）
  - [x] B1第2弾: `/api/followups` 系既存テストの不足ケースを補完（`TRACE-111`）
  - [x] B1第2弾: 監査レポートへ `TRACE-103`〜`TRACE-111` を追記
  - [x] B1第2弾: `npx vitest run tests/appointments.route.vitest.test.ts tests/appointments.appointment-id-route.vitest.test.ts tests/visits.route.vitest.test.ts tests/followups.route.vitest.test.ts` 実行（54/54 pass）
  - [x] PR-B1（顧客/予約/来店/フォローアップ）を実装・PR作成
  - [x] B2先行着手: `/api/payments` `/api/payments/[payment_id]` ルート契約テストを追加（`TRACE-112`〜`TRACE-119`）
  - [x] B2追加: `TRACE` 追記と監査レポート更新（payments系）
  - [x] B2追加: `npx vitest run tests/payments.route.vitest.test.ts tests/payments.payment-id-route.vitest.test.ts` 実行（8/8 pass）
  - [x] B2追加: `/api/invoices` `/api/invoices/[invoice_id]` `/api/invoices/[invoice_id]/pay` ルート契約テストを追加（`TRACE-120`〜`TRACE-126`）
  - [x] B2追加: `TRACE` 追記と監査レポート更新（invoices系）
  - [x] B2追加: `npx vitest run tests/invoices.route.vitest.test.ts tests/invoices.invoice-id-routes.vitest.test.ts` 実行（7/7 pass）
  - [x] B2追加: `/api/pos/*` ルート契約テストを追加（orders/sessions/drawer）（`TRACE-127`〜`TRACE-132`）
  - [x] B2追加: `/api/inventory/*` ルート契約テストを追加（items/movements/stocktake）（`TRACE-133`〜`TRACE-136`）
  - [x] B2追加: `TRACE` 追記と監査レポート更新（pos/inventory系）
  - [x] B2追加: `npx vitest run tests/pos.routes.vitest.test.ts tests/inventory.routes.vitest.test.ts` 実行（10/10 pass）
  - [x] B2追加: `npx vitest run tests/payments.route.vitest.test.ts tests/payments.payment-id-route.vitest.test.ts tests/invoices.route.vitest.test.ts tests/invoices.invoice-id-routes.vitest.test.ts tests/pos.routes.vitest.test.ts tests/inventory.routes.vitest.test.ts` 実行（25/25 pass）
  - [x] B2追加: `npm run test:traceability` / `npm run lint` 実行（pass）
  - [x] PR-B2（会計/請求/POS/在庫）を実装・PR作成（#66）
  - [x] B3追加: `/api/hotel/*` ルート契約テストを追加（`TRACE-137`〜`TRACE-138`）
  - [x] B3追加: `/api/consents/*` ルート契約テストを追加（`TRACE-139`〜`TRACE-141`）
  - [x] B3追加: `/api/medical-records/*` ルート契約テストを追加（`TRACE-142`〜`TRACE-143`）
  - [x] B3追加: `/api/line/*` `/api/webhooks/*` 通知系ルート契約テストを追加（`TRACE-144`〜`TRACE-146`）
  - [x] B3追加: `TRACE` 追記と監査レポート更新（hotel/consents/medical/notify系）
  - [x] B3追加: `npx vitest run tests/hotel.routes.vitest.test.ts tests/consents.routes.vitest.test.ts tests/medical-records.routes.vitest.test.ts tests/webhooks.routes.vitest.test.ts` 実行（10/10 pass）
  - [x] B3追加: `npm run test:traceability` / `npm run lint` 実行（pass）
  - [x] PR-B3（ホテル/同意書/医療記録/通知）を実装・PR作成（#67）
  - [x] B4追加: `/api/stores/*` 設定系ルート契約テストを追加（`TRACE-147`〜`TRACE-150`）
  - [x] B4追加: `/api/support-tickets*` 運用管理系ルート契約テストを追加（`TRACE-151`〜`TRACE-153`）
  - [x] B4追加: `/api/dev/*` 開発補助系ルート契約テストを追加（`TRACE-154`）
  - [x] B4追加: `/api/hq/*` HQ運用系ルート契約テストを追加（`TRACE-155`〜`TRACE-156`）
  - [x] B4追加: `/api/legal/*` 法務系ルート契約テストは対象ルート未存在（`src/app/api` 配下に `legal/terms/privacy/compliance` なし）
  - [x] B4追加: `TRACE` 追記と監査レポート更新（settings/ops/dev/hq/legal/support系）
  - [x] B4追加: `npx vitest run tests/stores.misc-routes.vitest.test.ts tests/support.routes.vitest.test.ts tests/dev-subscriptions.route.vitest.test.ts tests/hq.kpi-summary.route.vitest.test.ts` 実行（10/10 pass）
  - [x] B4追加: `npm run test:traceability` / `npm run lint` 実行（pass）
  - [x] PR-B4（設定/管理/dev/hq/法務/サポート）を実装・PR作成（#68）
  - [x] 監査レポート更新（最終網羅判定と残リスク明記）
  - [x] C1着手: 認証/課金系API（`/api/auth/*` `/api/billing/*`）のルート契約テストを一括追加（`TRACE-157`〜`TRACE-168`）
  - [x] C1着手: 監査レポートにTRACE行を追加し、網羅対象を更新
  - [x] C1着手: `npx vitest run tests/auth.routes.vitest.test.ts tests/billing.routes.vitest.test.ts` / `npm run test:traceability` / `npm run lint` を通過
  - [x] C1着手: PR作成（大塊運用を維持 / #70）
  - [x] C2着手: 課金チェックアウト系API（`/api/billing/stripe/checkout` `/api/billing/komoju/checkout` `/api/billing/setup-assistance/checkout` `/api/billing/storage-addon/checkout`）のルート契約テストを追加（`TRACE-169`〜`TRACE-174`）
  - [x] C2着手: 監査レポートにTRACE行を追加し、網羅対象を更新
  - [x] C2着手: `npx vitest run tests/billing.checkout-routes.vitest.test.ts` / `npm run test:traceability` / `npm run lint` を通過
  - [x] C2着手: PR作成（大塊運用を維持 / #71）
  - [x] C3着手: 予約事前決済API（`/api/appointments/[appointment_id]/reservation-payment/checkout` `/api/appointments/[appointment_id]/reservation-payment/claim`）のルート契約テストを追加（`TRACE-175`〜`TRACE-182`）
  - [x] C3着手: 監査レポートにTRACE行を追加し、網羅対象を更新
  - [x] C3着手: `npx vitest run tests/appointments.reservation-payment-routes.vitest.test.ts` / `npm run test:traceability` / `npm run lint` を通過
  - [x] C3着手: PR作成（大塊運用を維持 / #72）
  - [x] C4着手: 招待/メンバーシップ系API（`/api/store-invites/accept` `/api/store-invites` `/api/store-memberships/[membership_id]/role`）のルート契約テストを追加（`TRACE-183`〜`TRACE-190`）
  - [x] C4着手: 監査レポートにTRACE行を追加し、網羅対象を更新
  - [x] C4着手: `npx vitest run tests/store-invites-memberships.routes.vitest.test.ts` / `npm run test:traceability` / `npm run lint` を通過
  - [x] C4着手: PR作成（大塊運用を維持 / #73）
  - [x] C5着手: settings系API（`/api/settings/notification-settings` `/api/settings/payment-provider-connections` `/api/settings/reservation-payment-settings` `/api/settings/storage-policy` `/api/settings/theme`）のルート契約テストを追加（`TRACE-191`〜`TRACE-199`）
  - [x] C5着手: 監査レポートにTRACE行を追加し、網羅対象を更新
  - [x] C5着手: `npx vitest run tests/settings.routes.vitest.test.ts` / `npm run test:traceability` / `npm run lint` を通過
  - [x] C5着手: PR作成（大塊運用を維持 / #74）
  - [x] C6事前チェック: 未対応APIルートを機械抽出して再棚卸し（175中61件テスト済み、114件未対応）
  - [x] C6事前チェック: `TASK/TRACE` を先出しで固定し、以降は計画順で実装する方針を明記
  - [x] C6-A: 管理/定期実行系APIの契約テストを一括追加（`TRACE-200`〜`TRACE-219`）
    - 対象: `admin(8)` `cron(14)` `ai-reports(1)` `metrics(1)` `security(1)` `upload(2)` `notification-templates(2)` `notify(2)` `payments/checkout(1)`
  - [x] C6-B: 顧客接点/公開導線APIの契約テストを一括追加（`TRACE-220`〜`TRACE-239`）
    - 対象: `public(10)` `customers/member-portal-link系(2)` `pets(2)` `staffs(3)` `service-menus(3)`
  - [x] C6-B着手: 作業ブランチ `test/TASK-449-coverage-c6b-next-batch` を作成
  - [x] C6-C着手: 作業ブランチ `test/TASK-449-coverage-c6c-domain-batch` を作成
  - [x] C6-D着手: 作業ブランチ `test/TASK-449-coverage-c6d-ops-batch` を作成
  - [x] C6-C: 業務ドメインAPI（ホテル/在庫/HQ/再提案）の契約テストを一括追加（`TRACE-240`〜`TRACE-259`）
    - 対象: `hotel(7)` `inventory未対応(8)` `hq未対応(6)` `reoffers(5)` `consents詳細(5)` `appointments詳細(4)`
  - [x] C6-D: 記録/運用API（カルテ/日誌/dev）の契約テストを一括追加（`TRACE-260`〜`TRACE-279`）
    - 対象: `medical-records詳細(15)` `journal(4)` `dev support系(4)` `stores未対応(4)`
  - [x] C6-E: C6全体のトレーサビリティ更新と回帰実行（`TRACE-200`〜`TRACE-279` の表追記、`test:traceability`、対象Vitest、`lint`）
  - [x] C6-A実行ログ: `npx vitest run tests/admin-cron.routes.vitest.test.ts tests/platform-observability.routes.vitest.test.ts tests/notifications-and-checkout.routes.vitest.test.ts`（20/20 pass）
  - [x] C6-A実行ログ: `npm run test:traceability`（`218 rows verified`）
  - [x] C6-A実行ログ: `npm run lint`（pass）
  - [x] C6-B実行ログ: `npx vitest run tests/customers-public-contact.routes.vitest.test.ts tests/public-member-portal-consents.routes.vitest.test.ts tests/public-reserve.routes.vitest.test.ts`（20/20 pass）
  - [x] C6-B実行ログ: `npm run test:traceability`（`238 rows verified`）
  - [x] C6-B実行ログ: `npm run lint`（pass）
  - [x] C6-C実行ログ: `npx vitest run tests/hotel.routes.vitest.test.ts tests/inventory.routes.vitest.test.ts tests/hq.menu-template-routes.vitest.test.ts tests/reoffers.routes.vitest.test.ts tests/appointments.detail-routes.vitest.test.ts tests/consents.routes.vitest.test.ts`（29/29 pass）
  - [x] C6-C実行ログ: `npm run test:traceability`（`258 rows verified`）
  - [x] C6-C実行ログ: `npm run lint`（pass）
  - [x] C6-D実行ログ: `npx vitest run tests/medical-records.detail-routes.vitest.test.ts tests/journal.routes.vitest.test.ts tests/dev-support.routes.vitest.test.ts tests/stores.additional-routes.vitest.test.ts`（20/20 pass）
  - [x] C6-D実行ログ: `npm run test:traceability`（`278 rows verified`）
  - [x] C6-D実行ログ: `npm run lint`（pass）
  - [x] C7: ページ系の「薄い検証」補強（実データ近似E2Eの拡張バッチ）を事前計画に沿って実施（`TRACE-280`〜`TRACE-287`）
  - [x] C7-A: 公開ページ群（`/lp`・法務）E2Eスモークを追加（`TRACE-280`〜`TRACE-283`）
  - [x] C7-B: 認証導線ページ（`/login` `/signup`）のE2Eスモークを追加（`TRACE-284`〜`TRACE-285`）
  - [x] C7-C: サポート画面（`/support-chat` `/support-tickets`）のE2Eスモークを追加（`TRACE-286`〜`TRACE-287`）
  - [x] C7-A実行ログ: `npx playwright test e2e/public-legal-pages.spec.ts --project=chromium`（4/4 pass）
  - [x] C7-A実行ログ: `npm run test:traceability`（`282 rows verified`）
  - [x] C7-A実行ログ: `npm run lint`（pass）
  - [x] C7-B実行ログ: `npx playwright test e2e/auth-pages.spec.ts --project=chromium`（2/2 pass）
  - [x] C7-B実行ログ: `npm run test:traceability`（`284 rows verified`）
  - [x] C7-B実行ログ: `npm run lint`（pass）
  - [x] C7-C実行ログ: `npx playwright test e2e/support-chat.spec.ts e2e/support-tickets.spec.ts --project=chromium`（3/3 pass）
  - [x] C7-C実行ログ: `npm run test:traceability`（`286 rows verified`）
  - [x] C7-C実行ログ: `npm run lint`（pass）
  - [x] C8: マニュアル系ページのE2Eスモークを一括追加（`TRACE-288`〜`TRACE-294`）
  - [x] C8-A: `/manual` `/manual/glossary` `/manual/[sectionId]` の導線・表示契約を追加（`TRACE-288`〜`TRACE-291`）
  - [x] C8-B: `/dev/manual` `/hq/manual` のアクセス制御時表示（`TRACE-292`〜`TRACE-293`）
  - [x] C8-C: C8全体のトレーサビリティ更新と回帰実行（`TRACE-294`、`test:traceability`、対象Playwright、`lint`）
  - [x] C8実行ログ: `npx playwright test e2e/manual-pages.spec.ts --project=chromium`（7/7 pass）
  - [x] C8実行ログ: `npm run test:traceability`（`293 rows verified`）
  - [x] C8実行ログ: `npm run lint`（pass）
  - [x] C8: PR作成（#80）
  - [x] C9: manualサブルート（dev/hq glossary・section）のE2Eスモークを一括追加（`TRACE-295`〜`TRACE-300`）
  - [x] C9-A: `/dev/manual/glossary` `/dev/manual/[sectionId]` のアクセス制御時表示契約を追加（`TRACE-295`〜`TRACE-296`）
  - [x] C9-B: `/hq/manual/glossary` `/hq/manual/[sectionId]` のfeature gate/アクセス制御契約を追加（`TRACE-297`〜`TRACE-298`）
  - [x] C9-C: manualサブルートのflow導線契約を追加（`TRACE-299`〜`TRACE-300`）
  - [x] C9-D: C9全体のトレーサビリティ更新と回帰実行（対象Playwright、`test:traceability`、`lint`）
  - [x] C9実行ログ: `npx playwright test e2e/manual-pages.spec.ts --project=chromium`（13/13 pass）
  - [x] C9実行ログ: `npm run test:traceability`（`299 rows verified`）
  - [x] C9実行ログ: `npm run lint`（pass）
  - [x] C9: PR作成（#81）
  - [x] C10: 課金ガードページ + setup-store移行ページのE2Eスモークを一括追加（`TRACE-301`〜`TRACE-306`）
  - [x] C10-A: `/billing-required` の文言・決済導線表示契約を追加（`TRACE-301`）
  - [x] C10-B: `/billing/success`（通常/初期設定代行/容量追加）の表示切替契約を追加（`TRACE-302`〜`TRACE-304`）
  - [x] C10-C: `/dashboard/setup-store` `/settings/setup-store` のクエリ保持リダイレクト契約を追加（`TRACE-305`〜`TRACE-306`）
  - [x] C10-D: C10全体のトレーサビリティ更新と回帰実行（対象Playwright、`test:traceability`、`lint`）
  - [x] C10実行ログ: `npx playwright test e2e/billing-setup-pages.spec.ts --project=chromium`（6/6 pass）
  - [x] C10実行ログ: `npm run test:traceability`（`305 rows verified`）
  - [x] C10実行ログ: `npm run lint`（pass）
- 全件洗い出し台帳:
  - `docs/test-coverage-master-inventory-2026-04-11.md`
  - ページ: 79件
  - APIルート: 176件
  - 直接参照ギャップ分析: `docs/test-coverage-gap-scan-2026-04-11.md`
- 大塊PRの分割方針（固定）:
  - B1: 顧客・予約・来店・再来店フォロー
  - B2: 決済・請求・POS・在庫
  - B3: ホテル・同意書・カルテ・通知/Webhook
  - B4: 設定・運用管理・開発補助・HQ・法務・サポート
- 事前チェック（漏れ防止）:
  - [x] ページ/APIルート全件数を再集計（79/176）
  - [x] 台帳と監査レポートの整合方針を決定（TRACE運用継続）
  - [x] 既存テストとの重複/不足の機械抽出結果を台帳へ反映（直接参照スキャンを作成）
  - [x] 除外対象（低リスク静的ページ等）の明示ルールを定義
    - 除外可能対象は「静的案内/法務系でフォーム送信・外部連携・権限制御を持たないページ」に限定する。
    - 除外時は台帳に「除外理由」「代替検証（リンク切れ/表示スモーク）」を明記し、`test:traceability` 対象外であることを明示する。
    - APIルートは原則除外不可。例外は「廃止予定で実運用から切離済み」かつ「呼び出し導線なし」の場合のみ。
  - [x] 大塊PRごとのDoD（必須テスト実行セット）を確定
    - DoD共通: 対象領域のTRACE追加、対象Vitest通過、`npm run test:traceability`、`npm run lint` 通過、TASK更新、PR本文にTRACE記載。
    - DoD-B1: customers/appointments/visits/followups ルート契約テストを含むこと。
    - DoD-B2: payments/invoices/pos/inventory ルート契約テストを含むこと。
    - DoD-B3: hotel/consents/medical/webhooks ルート契約テストを含むこと。
    - DoD-B4: stores/support/dev/hq ルート契約テストを含み、法務は「対象APIなし」を明記すること。

## 顧客管理βページ改善（会員証URLカード配色統一）
- Task ID: `TASK-448`
- ブランチ: `feat/TASK-448-customer-manage-beta-improvements`
- ステータス: `in_progress`
- 概要: 顧客管理（β）ページの基本情報タブで、会員証URLカードの配色を顧客情報カードと統一し視認性を揃える。今後の追加改善は同タスクで継続管理する。
- 影響範囲: `groomer_app/src/app/customers/manage/page.tsx`、`TASKS.md`
- リスク: 色トーン変更により既存の注意喚起（アンバー）の印象が弱まる可能性
- 完了条件:
  - 会員証URLカードが顧客情報カードと同配色（`border-gray-200 bg-white` + グレーテキスト系）になる
  - レイアウト・表示項目・導線は変更しない
- 進捗:
  - [x] タスク起票とブランチ作成
  - [x] 会員証URLカード配色を顧客情報カードへ統一
  - [x] 顧客/ペット削除時の関連データ連動削除（予約・会計・カルテ等）を実装
  - [x] 顧客/ペット削除前に「元に戻せない」確認メッセージを表示し、キャンセル/続行選択後に削除する導線へ変更
  - [x] LINE webhookテーブル未適用時の原因特定とREADME適用手順の明記
  - [x] SidebarのHydration mismatch（展開状態のSSR/CSR不一致）を解消
  - [x] 顧客管理βを `顧客一覧 / ペット一覧 / 顧客詳細` のタブ構成へ変更
  - [x] 来店周期アラートを顧客管理βタブへ移設（`/customers/manage?view=alerts`）
  - [x] 顧客一覧・ペット一覧を表形式（1行1顧客/1行1ペット）へ統一
  - [x] 顧客詳細上部の検索・顧客選択ボタンを削除
  - [x] 顧客一覧にLTV列を追加し、名前横バッジは「空き枠待ち」のみに整理
  - [x] 顧客一覧・ペット一覧に検索機能を追加
  - [x] 顧客一覧・ペット一覧をレスポンシブ化（狭幅時カード表示 / 広幅時テーブル表示）
  - [x] タブラベルの視認性を改善（モバイルは短縮ラベル + 4分割均等幅、横スクロールなし）
  - [x] 顧客一覧・ペット一覧から管理βページ内モーダルで新規追加できる導線を追加
  - [x] 新規追加ボタンを検索行と同一行へ統合し、ボタン文言を「新規追加」に統一
  - [x] 来店周期アラートの表を `未着手候補 / 対応中 / 対応済` の3区分に再編し、主要列+詳細展開で可読性を改善
  - [x] 来店周期アラートで「対応済」と「未着手候補」に同一顧客が重複表示される不整合を修正（既存タスク保有顧客を候補から除外）
  - [x] 来店周期アラートの「対応済」をおすすめ運用に合わせて直近30日表示へ変更
  - [x] 再フォロー日数（保留/不要/失注）を店舗ごとに設定可能化（デフォルト 7/60/90）
  - [x] E2Eで店舗設定の再フォロー日数（7/60/90）表示反映を確認（`e2e/settings-pages.spec.ts`）
  - [x] 設定値（7/60/90）に基づく候補ブロック判定の単体テスト追加と、未着手候補/対応中/対応済テーブル分離のE2E確認を実施
  - [x] 検証ログ更新（`npx vitest run tests/followups.refollow-policy.vitest.test.ts` / `npx playwright test e2e/customers-followup-alerts.spec.ts --project=chromium` / `npm run lint`）
  - [x] ダッシュボードの再来店フォロー文言/導線を顧客管理βと統一（`来店周期アラート` / `再来店フォロー一覧` / `/customers/manage?view=alerts`）
  - [x] 単一タブページのタブUI整理（施術メニュー管理の `メニュー一覧` 単一タブを削除）
  - [x] 単一タブページのタブUI整理を追加適用（`pets` / `payments` / `inventory/products` はタブUIを削除、`staffs` は将来拡張予定のため維持）
  - [x] 単一タブ対象ページの `?tab=list` 導線を新URLへ整理（リンク/E2E/APIリダイレクトを `/pets` `/payments` `/inventory/products` `/service-menus` へ置換）
  - [x] 単一タブ対象ページの受け入れ側から `tab` 依存を撤去（`searchParams.tab` / `tab=new` を廃止し `modal=create` へ統一）
  - [x] 決済管理の同意チェックをCheckout以外にも適用（容量追加・初期設定代行にも共通チェック表示/必須化）
  - [x] 決済管理の同意チェックを3カード共通の1チェックへ統合（基本/容量追加/初期設定代行で同一同意状態を共有）
  - [x] 決済管理/決済履歴のUI整理（`owner専用` 文言・相互導線リンク削除、Webhook障害時カードの可読性改善）
  - [x] 決済タブ再編（`決済接続` タブ追加、顧客決済アカウント接続を分離、プロバイダ状態/最近の操作履歴を決済履歴へ移設、Webhook障害カード再調整）
  - [x] モーダル共通挙動を変更し、モーダル外クリックでは閉じない仕様へ統一（`Esc`/閉じるボタンは維持）
  - [x] 予約モーダル（AppointmentForm）のQR画像読取機能を削除（QR関連state/ハンドラ/UI一式を撤去）
  - [x] 旧 `顧客管理` / `ペット管理` ページを廃止運用化（`/customers` `/pets` は `customers/manage` 系へリダイレクト、サイドメニュー項目は削除）
  - [x] 旧 `/customers` `/pets` 参照導線を `customers/manage` 系へ統一（画面リンク/APIフォールバック/モーダル既定遷移/README/E2E）
  - [x] 「顧客管理β」の名称を「顧客ペット管理」へ統一（ページ見出し/サイドバー/関連導線文言）
  - [x] ペット一覧で飼い主名クリック時に、その飼い主名で検索を即時適用する導線を追加
  - [x] 予約一覧に顧客/ペット/担当の横断検索を追加し、既定では `キャンセル/完了済` を除外、`全表示` チェックで切替可能化
  - [x] 予約一覧の表示密度を再設計（列再編、名称行の非改行化、状態バッジ/操作ボタンの小型統一、列間隔の圧縮、モバイル最適化）
  - [x] ペットカルテ一覧を予約一覧と同一トーンへ再設計（対象情報の集約、状態/操作の可読性向上、ボタンサイズ統一）
  - [x] 一覧UI横展開の第1弾として `visits` / `payments` を予約一覧系デザインへ寄せて再編（対象列の集約・操作ボタン小型化・折返し制御）。※ 顧客ペット一覧は対象外
  - [x] 一覧UI横展開の第2弾として `staffs` / `service-menus` を同一トーンへ再編（列集約・状態バッジ化・操作ボタン小型化・モバイルカード密度改善）。※ 顧客ペット一覧は対象外
  - [x] 一覧UI横展開の第3弾として `inventory/products` / `inventory/stocks` を同一トーンへ再編（モバイルカード追加、PC列集約、状態バッジ化、操作ボタン小型化）
  - [x] 一覧UI横展開の第4弾として `inventory/inbounds` / `inventory/outbounds` / `inventory/history` / `inventory/stocktake` を同一トーンへ再編（履歴表のモバイルカード化、PC列集約、可読性統一）
  - [x] 一覧UI横展開の第5弾として `dashboard/notification-logs` / `dashboard/audit-logs` を同一トーンへ再編（モバイルカード化、PC列集約、状態バッジ/詳細開閉の可読性統一）
  - [x] 一覧UI横展開の第6弾として `billing/BillingHistoryContent` の履歴テーブル群を同一トーンへ再編（共通ヘッダー背景、列幅制御、セル余白統一）
  - [x] 一覧UI横展開の第7弾として `hotel/HotelStaysManager` の台帳・商品一覧テーブルを同一トーンへ再編（ヘッダー/余白統一、列固定、操作ボタン密度統一）
  - [x] 一覧UI横展開の第8弾として `consents/ConsentManagementPanel` と `hq/page` の一覧表を同一トーンへ再編（同意書履歴のモバイルカード化、PC列集約、ヘッダー/余白統一）
  - [x] 一覧UI横展開の第9弾として `hq/menu-templates` 系4ページのテーブルを同一トーンへ再編（`table-fixed`、ヘッダー背景、セル余白統一）
  - [x] 一覧UI横展開の第10弾として `dev` 系テーブル（`CronJobsManager` / `SubscriptionsManager` / `FailedWebhookEventsPanel` / `dev/billing-alerts`）を同一トーンへ再編（`table-fixed`、ヘッダー背景、セル余白統一）
  - [x] 一覧UI横展開の第11弾として `dashboard/page` 内テーブルと `receipts/[payment_id]` 明細表を同一トーンへ再編（`table-fixed`、ヘッダー背景、セル余白統一）
  - [x] 一覧UI横展開の第12弾として `payments/PosCheckoutPanel` 明細表と `settings/StoreOperationsSettingsContent` のLTV設定表を同一トーンへ再編（`table-fixed`、ヘッダー/セル余白統一）
  - [x] 一覧UI横展開の第13弾として `lp/page` の案内表を軽量統一（セル余白のみ統一、訴求優先で `table-fixed` は未適用）
  - [x] `customers/RevisitAlertList` は軽量統一のみ適用（ヘッダー背景 + セル余白、列構成/機能は不変更）
  - [x] 操作ボタン仕様の共通化を適用（`h-7 / px-2 / text-xs / font-semibold / whitespace-nowrap` を基準に、主要一覧の編集・削除・詳細・再発行・PDF操作を統一）
  - [x] 操作ボタン統一の漏れ補修（`RevisitAlertList` の `一括連絡文をコピー` / `キューに追加` / `保存する` を共通仕様へ揃え）
  - [x] E2E不安定の根本修正（`settings-pages.spec.ts` の遷移再試行/タイムアウト設計見直し、`appointments-calendar.spec.ts` の文言依存検証を状態依存へ変更）
  - [x] E2E再検証完了（`settings` 反復24件 pass、`appointments-calendar` 反復10件 pass、フル `npm run test:e2e` で 63/63 pass）
  - [x] 全体テスト観点監査を開始し、ページ/API×テスト対応の監査レポートを作成（`docs/test-coverage-audit-2026-04-09.md`）
  - [x] 来店周期アラートの仕様ズレを修正（`7/30/all` 対象期間、再フォロー期限切れの未着手復帰、候補/対応済の重複解消）し、E2Eを拡張
  - [x] 監査レポート優先ギャップの第1陣を追加（`/visits` E2E、`followups status/events` route、`stores customer-management-settings` route）
  - [x] 監査レポート優先ギャップの第2陣を追加（`/api/visits` / `/api/visits/[visit_id]` の境界値・異常系ルートテスト）
  - [x] `settings` 配下の挙動検証を強化（`/settings/{notifications,storage}` の `saved/error` 表示、レガシーURLリダイレクト、`public-reserve` 保存フォームの `redirect_to` 整合）
  - [x] 監査レポートに仕様トレーサビリティ表（初版）を追加（仕様項目 -> テストファイル -> 検証アサーション + 更新運用ルール）
  - [x] 仕様トレーサビリティ表の更新漏れガードを追加（`npm run test:traceability` / `scripts/verify-traceability.mjs`）
  - [x] トレーサビリティ更新漏れガードをCI組み込み（`.github/workflows/traceability-guard.yml` でPR時に `npm run test:traceability` 実行）
  - [x] トレーサビリティガードを強化（表セクション存在、ヘッダー妥当性、仕様項目重複、列空欄、テストパス接頭辞・実在チェック）
  - [x] トレーサビリティガードに主要カテゴリ欠落検知を追加（顧客/予約/会計/通知/設定）
  - [x] トレーサビリティ参照テストの最低品質チェックを追加（`test/it` と `expect/assert` の存在検証）
  - [x] Level2対応: `Test ID (TRACE-xxx)` を表/テストへ付与し、ID重複・形式・テスト内記載有無を `test:traceability` で自動検証
  - [x] PRテンプレートを追加し、`TRACE-xxx` 更新欄を標準化（`.github/pull_request_template.md`）
  - [x] トレーサビリティ表を在庫/ホテル/サポート領域へ拡張（`TRACE-018`〜`TRACE-020`）
  - [x] Branch protection必須化の実行手順書を追加（`docs/traceability-guard-setup.md`）
  - [x] `main` ブランチで `Traceability Guard / verify` を Required status check として有効化（Branch protection設定）
  - [x] `Journal E2E` の遷移フレーク対策として `gotoStable` 再試行を導入（`e2e/journal-pages.spec.ts`）
  - [x] Playwright E2E起動時の `/` 参照でSupabase必須エラーが出ないよう、`app/page.tsx` に `PLAYWRIGHT_E2E` ガードを追加（`/lp` へ即時リダイレクト）
  - [x] `Journal E2E` ワークフローの Node 実行環境を `24` へ統一し、CI上の `.ts` 実行エラー（`ERR_UNKNOWN_FILE_EXTENSION`）を解消
  - [x] `docs/test-coverage-audit-2026-04-09.md` を再確認し、`次アクション` を実態に合わせて「整備」から「運用継続」へ更新
  - [x] 残存リスク対策として `followups` 再フォロー判定の日付境界テストを追加（`TRACE-021`: ちょうど閾値日の解除判定）
  - [x] 残存リスク対策として `followups` 再フォロー判定の時差境界テストを追加（JST基準日跨ぎでの解除判定）
  - [x] 残存リスク対策として `followups status` の不正状態遷移（解決済み→再開）拒否テストを追加
  - [x] 残存リスク対策として `followups events` の電話連絡resultバリデーション異常系テストを追加
  - [x] 残存リスク対策として `followups events` の同日同チャネル重複送信（409）テストを追加
  - [x] 残存リスク対策として `followups events` の解決済みタスクへの `note_added` 記録許可テストを追加
  - [x] 残存リスク対策として `followups status` の更新対象なしリクエスト拒否（400）テストを追加
  - [x] 残存リスク対策として `followups events` の電話番号未登録時ガード（400）テストを追加
  - [x] 残存リスク対策として `followups status` の不正 `resolution_type` 拒否（400）テストを追加
  - [x] 残存リスク対策として `followups events` の顧客未存在時ガード（404）テストを追加
  - [x] 残存リスク対策として `followups events` のLINE ID未登録時ガード（400）テストを追加
  - [x] 残存リスク対策として `followups status` の `open -> resolved_booked` 不正遷移拒否テストを追加
  - [x] 残存リスク対策として `followups status` の不正 `snoozed_until` 拒否（400）テストを追加
  - [x] 把握済み残タスク（優先順）を先にTASKSへ反映してから着手する
  - [x] [P1] `followups status` 正常系（担当者解除: `assigned_user_id=null`）を追加
  - [x] [P2] `followups status` 正常系（`snoozed` 成功時の応答とイベント整合）を追加
  - [x] [P3] `followups events` 異常系（`contacted_line payload.body` 空白のみ）を追加
  - [x] [P4] `followups events` 異常系（dedupe時の副作用ログinsert失敗ハンドリング）を追加
  - [x] [P5] `/api/visits` `/api/visits/[visit_id]` 境界ケース（時刻/店舗整合）を追補
  - [x] [P6] `/api/visits/[visit_id]` 店舗整合性不正時の `400` をテストで固定
  - [x] [P7] `/api/visits` POST の `total_amount` 数値不正（NaN/非数）を `400` で拒否する
  - [x] [P8] `/api/visits/[visit_id]` PUT の `total_amount` 数値不正（NaN/非数）を `400` で拒否する
  - [x] [P9] `followups status` 正常系（`in_progress -> resolved_no_need` 成功時の `resolved` イベント整合）を追加
  - [x] [P10] `/api/visits/[visit_id]` POST(_method=put/patch) の `total_amount` 非数入力を `400` で拒否する
  - [x] [P11] `/api/visits/[visit_id]` POST(_method=put/patch) の `visit_date` 不正形式を `400` で拒否する
  - [x] [P12] `/api/visits/[visit_id]` POST(_method=patch) の `total_amount` 非数入力を `400` で拒否する
  - [x] [P13] `/api/visits/[visit_id]` POST(_method=patch) の `visit_date` 不正形式を `400` で拒否する
  - [x] [P14] `/api/visits/[visit_id]` POST(_method=patch) の正常系更新（307リダイレクト）を追加し、PUT/patchの契約差分を明示する
  - [x] [P15-0] P15着手準備（作業ブランチ `test/TASK-448-followups-e2e-realistic` を作成）
  - [x] [P15] `followups` のfixture依存が高いE2Eを実データ近似シナリオへ1本追加する（残存リスク対策）
  - [x] [P16] 監査レポートの「残存リスク」更新（追加テストの反映と次の優先ギャップ再定義）
  - [x] [P17] 来店周期アラートE2Eの実データ近似シナリオを追加（担当者変更・フィルタ状態維持）
  - [x] [P18-0] P18着手準備（作業ブランチ `test/TASK-448-followups-route-query-boundaries` を作成）
  - [x] [P18] `followups` APIの `window_days`/`due`/`assignee` 組み合わせ境界をルートテストへ追加
  - [x] [P19] 監査レポートの優先ギャップを再評価し、次PR対象をTASKSへ固定化
  - [x] [P20-0] P20着手準備（作業ブランチ `test/TASK-448-followups-status-invalid-guard` を作成）
  - [x] [P20] `followups` API(GET) の `status` が無効値の場合にフィルタ未適用で安全動作することをルートテストで固定
  - [x] [P21-0] P21着手準備（`include_candidates=true` 経路テスト追加の事前モック設計）
  - [x] [P21] `followups` API(GET) の `include_candidates=true` 経路で、再フォローブロック日数（7/60/90系）が候補除外に効く境界をルートテストで固定
  - [x] [P22-0] P22着手準備（作業ブランチ `test/TASK-448-followups-candidate-window-boundary` を作成）
  - [x] [P22] `include_candidates=true` 経路で `window_days` が候補算出（`recommended_at`）に効く境界をルートテストで固定
  - [x] [P23] 監査レポートの残存リスクと次アクションを再更新（P20/P21反映）
  - [x] [P24-0] P24着手準備（作業ブランチ `test/TASK-448-followups-test-helper-refactor` を作成）
  - [x] [P24] `followups` ルートテストの重複モックをヘルパー化して保守性を改善
  - [x] [P25] `followups` E2Eとルートテストの対応表（TRACE対応）をTASKS内に簡易索引化
  - [x] [P26-0] P26着手準備（作業ブランチ `test/TASK-448-followups-future-booking-exclusion` を作成）
  - [x] [P26] `followups` ルートテストの候補算出ケース（未来予約あり顧客の除外）を追加
  - [x] [P27] 監査レポートに `followups` 候補除外ロジック（未来予約）を追記
  - [x] [P28-0] P28着手準備（作業ブランチ `test/TASK-448-followups-status-query-candidate-invariance` を作成）
  - [x] [P28] `include_candidates=true` 経路の `status` クエリ指定時に候補算出が不変であることをルートテストで固定
  - [x] [P29] 監査レポートに `include_candidates` + `status` 不変性の検証項目を追記
  - [x] [P30-0] P30着手準備（作業ブランチ `test/TASK-448-followups-due-query-candidate-invariance` を作成）
  - [x] [P30] `followups` ルートテストの `due=today/overdue` と `include_candidates=true` 併用時の候補不変性を固定
  - [x] [P31] 監査レポートに `include_candidates` + `due` 不変性の検証項目を追記
  - [x] [P32-0] P32着手準備（作業ブランチ `test/TASK-448-followups-assignee-query-candidate-invariance` を作成）
  - [x] [P32] `include_candidates=true` 経路の `assignee` クエリ指定時に候補算出が不変であることをルートテストで固定
  - [x] [P33] 監査レポートに `include_candidates` + `assignee` 不変性の検証項目を追記
  - [x] [P34-0] P34着手準備（作業ブランチ `test/TASK-448-followups-window-days-30-boundary` を作成）
  - [x] [P34] `include_candidates=true` 経路の `window_days=30` 境界（7/all に加えて30）をルートテストで固定
  - [x] [P35] 監査レポートに `include_candidates` + `window_days=30` 境界の検証項目を追記
  - [x] [P36-0] P36着手準備（作業ブランチ `test/TASK-448-followups-explicit-assignee-candidate-invariance` を作成）
  - [x] [P36] `include_candidates=true` 経路の `assignee=user-xxx`（明示担当）でも候補算出が不変であることをルートテストで固定
  - [x] [P37] 監査レポートに `include_candidates` + `assignee=user-xxx` 不変性の検証項目を追記
  - [x] [P38-0] P38着手準備（作業ブランチ `test/TASK-448-followups-unassigned-candidate-invariance` を作成）
  - [x] [P38] `include_candidates=true` 経路の `assignee=unassigned` でも候補算出が不変であることをルートテストで固定
  - [x] [P39] 監査レポートに `include_candidates` + `assignee=unassigned` 不変性の検証項目を追記
  - [x] [P40-0] P40着手準備（作業ブランチ `test/TASK-448-followups-invalid-status-safety` を作成）
  - [x] [P40] `include_candidates=true` 経路の `status=done`（許可外）指定時の安全動作をルートテストで固定
  - [x] [P41] 監査レポートに `include_candidates` + 不正 `status` 安全動作の検証項目を追記
  - [x] [P42-0] P42着手準備（作業ブランチ `test/TASK-448-followups-due-all-candidate-invariance` を作成）
  - [x] [P42] `include_candidates=true` 経路の `due=all` 指定時の候補不変性をルートテストで固定
  - [x] [P43] 監査レポートに `include_candidates` + `due=all` 不変性の検証項目を追記
  - [x] [P44-0] P44着手準備（作業ブランチ `test/TASK-448-followups-window30-status-invariance` を作成）
  - [x] [P44] `include_candidates=true` 経路で複数クエリ併用（`status`+`due`+`assignee`）時の候補不変性をルートテストで固定
  - [x] [P45] 監査レポートに `include_candidates` + 複数クエリ併用不変性の検証項目を追記
  - [x] [P46-0] P46着手準備（作業ブランチ `test/TASK-448-followups-window30-status-candidate-invariance` を作成）
  - [x] [P46] `include_candidates=true` 経路で `window_days=30` + `status` 併用時の候補不変性をルートテストで固定
  - [x] [P47] 監査レポートに `include_candidates` + `window_days=30`+`status` 併用不変性の検証項目を追記
  - [x] [P48-0] P48着手準備（作業ブランチ `test/TASK-448-followups-window30-assignee-candidate-invariance` を作成）
  - [x] [P48] `include_candidates=true` 経路で `window_days=30` + `assignee` 併用時の候補不変性をルートテストで固定
  - [x] [P49] 監査レポートに `include_candidates` + `window_days=30`+`assignee` 併用不変性の検証項目を追記
  - [x] [P50-0] P50着手準備（作業ブランチ `test/TASK-448-followups-window30-due-candidate-invariance` を作成）
  - [x] [P50] `include_candidates=true` 経路で `window_days=30` + `due` 併用時の候補不変性をルートテストで固定
  - [x] [P51] 監査レポートに `include_candidates` + `window_days=30`+`due` 併用不変性の検証項目を追記
  - [x] [P52-0] P52着手準備（作業ブランチ `test/TASK-448-followups-window7-status-candidate-invariance` を作成）
  - [x] [P52] `include_candidates=true` 経路で `window_days=7` + `status` 併用時の候補不変性をルートテストで固定
  - [x] [P53] 監査レポートに `include_candidates` + `window_days=7`+`status` 併用不変性の検証項目を追記
  - [x] [P54-0] P54着手準備（作業ブランチ `test/TASK-448-followups-window7-due-candidate-invariance` を作成）
  - [x] [P54] `include_candidates=true` 経路で `window_days=7` + `assignee` 併用時の候補不変性をルートテストで固定
  - [x] [P55] 監査レポートに `include_candidates` + `window_days=7`+`assignee` 併用不変性の検証項目を追記
  - [x] [P56-0] P56着手準備（作業ブランチ `test/TASK-448-followups-window7-due-candidate-invariance-v2` を作成）
  - [x] [P56] `include_candidates=true` 経路で `window_days=7` + `due` 併用時の候補不変性をルートテストで固定
  - [x] [P57] 監査レポートに `include_candidates` + `window_days=7`+`due` 併用不変性の検証項目を追記
  - [x] [P58-0] P58着手準備（作業ブランチ `test/TASK-448-followups-all-window-batch` を作成）
  - [x] [P58] `include_candidates=true` 経路の `window_days=all` + 複合クエリ併用不変性をルートテストで固定
  - [x] [P59] 監査レポートに `window_days=all` + 複合クエリ併用不変性（拡張ケース）を追記
  - [x] [P60] followupsテスト索引（IDX-1）へ新規TRACEを反映
  - [x] [P61-0] P61着手準備（作業ブランチ `test/TASK-448-followups-all-window-invariance-v2` を作成）
  - [x] [P61] `include_candidates=true` 経路で `window_days=all` + `due=today` 併用時の候補不変性をルートテストで固定
  - [x] [P62] `include_candidates=true` 経路で `window_days=all` + `status`+`due=today`+`assignee=me` 併用時の候補不変性をルートテストで固定
  - [x] [P63] 監査レポートとTRACE索引へ `TRACE-074`/`TRACE-075` を反映
  - [x] [P64-0] P64着手準備（作業ブランチ `test/TASK-448-followups-all-window-invariance-v3` を作成）
  - [x] [P64] `include_candidates=true` 経路で `window_days=all` + `due=overdue`+`assignee=user-2` 併用時の候補不変性をルートテストで固定
  - [x] [P65] `include_candidates=true` 経路で `window_days=all` + `status=open`+`due=today`+`assignee=user-2` 併用時の候補不変性をルートテストで固定
  - [x] [P66] 監査レポートとTRACE索引へ `TRACE-076`/`TRACE-077` を反映
  - [x] [P67-0] P67着手準備（作業ブランチ `test/TASK-448-followups-all-window-invariance-v4` を作成）
  - [x] [P67] `include_candidates=true` 経路で `window_days=all` + `status=snoozed`+`assignee=unassigned` 併用時の候補不変性をルートテストで固定
  - [x] [P68] `include_candidates=true` 経路で `window_days=all` + `status=in_progress`+`due=all`+`assignee=user-2` 併用時の候補不変性をルートテストで固定
  - [x] [P69] 監査レポートとTRACE索引へ `TRACE-078`/`TRACE-079` を反映
  - [x] [P70-0] P70着手準備（作業ブランチ `test/TASK-448-followups-all-window-invariance-v5` を作成）
  - [x] [P70] `include_candidates=true` 経路で `window_days=all` + `status=resolved_no_need`+`due=overdue`+`assignee=me` 併用時の候補不変性をルートテストで固定
  - [x] [P71] `include_candidates=true` 経路で `window_days=all` + `due=today`+`assignee=unassigned` 併用時の候補不変性をルートテストで固定
  - [x] [P72] 監査レポートとTRACE索引へ `TRACE-080`/`TRACE-081` を反映
  - [x] [P73-0] P73着手準備（作業ブランチ `test/TASK-448-followups-all-window-invariance-v6` を作成）
  - [x] [P73] `include_candidates=true` 経路で `window_days=all` + 不正`due`+`assignee=me` 併用時の候補不変性をルートテストで固定
  - [x] [P74] `include_candidates=true` 経路で `window_days=all` + `due=all`+`assignee=user-999` 併用時の候補不変性をルートテストで固定
  - [x] [P75] 監査レポートとTRACE索引へ `TRACE-082`/`TRACE-083` を反映
  - [x] [P76-0] P76着手準備（作業ブランチ `test/TASK-448-followups-all-window-invariance-v7` を作成）
  - [x] [P76] `include_candidates=true` 経路で `window_days=all` + `status=resolved_lost`+`due=all`+`assignee=me` 併用時の候補不変性をルートテストで固定
  - [x] [P77] `include_candidates=true` 経路で `window_days=all` + 不正`status`+`due=today`+`assignee=unassigned` 併用時の候補不変性をルートテストで固定
  - [x] [P78] 監査レポートとTRACE索引へ `TRACE-084`/`TRACE-085` を反映
  - [x] [P79-0] P79着手準備（作業ブランチ `test/TASK-448-followups-p79-p83-batch` を作成）
  - [x] [P79] `include_candidates=true` 経路で `window_days=all` + `status=resolved_booked` 併用時の候補不変性をルートテストで固定（`TRACE-086`）
  - [x] [P81] `include_candidates=true` 経路で不正 `window_days` 指定を `all` と同等に扱う安全動作をルートテストで固定（`TRACE-088`）
  - [x] [P82] `include_candidates=false` で候補算出を行わず `candidates=[]` を返す契約をルートテストで固定（`TRACE-089`）
  - [x] [P83] `due=today/overdue` の基準日がJST日付境界で評価されることをルートテストと実装で固定（`TRACE-090`）
  - [x] [P84] `include_candidates=true` 経路の `window_days=all` + `status=resolved_lost` 不変性は `TRACE-084` で担保済みを再確認
  - [x] [P85] `include_candidates=true` 経路の `window_days=all` + 不正 `status`+`due=today`+`assignee=unassigned` 不変性は `TRACE-085` で担保済みを再確認
  - [x] [P86] `include_candidates=true` 経路の未来予約除外は `TRACE-056` で担保済みを再確認
  - [x] [P87] 監査レポートとTRACE索引へ `TRACE-086` `TRACE-088` `TRACE-089` `TRACE-090` を反映
  - [ ] 後続の顧客管理β改善指示を反映
  - [x] [IDX-1] `followups` テスト索引（TRACE対応）をTASKSへ記録
    E2E: `TRACE-001` `TRACE-002` `TRACE-003` `TRACE-048` `TRACE-049` -> `groomer_app/e2e/customers-followup-alerts.spec.ts`
    Route: `TRACE-050` `TRACE-051` `TRACE-052` `TRACE-053` `TRACE-054` `TRACE-055` `TRACE-056` `TRACE-057` `TRACE-058` `TRACE-059` `TRACE-060` `TRACE-061` `TRACE-062` `TRACE-063` `TRACE-064` `TRACE-065` `TRACE-066` `TRACE-067` `TRACE-068` `TRACE-069` `TRACE-070` `TRACE-071` `TRACE-072` `TRACE-073` `TRACE-074` `TRACE-075` `TRACE-076` `TRACE-077` `TRACE-078` `TRACE-079` `TRACE-080` `TRACE-081` `TRACE-082` `TRACE-083` `TRACE-084` `TRACE-085` `TRACE-086` `TRACE-088` `TRACE-089` `TRACE-090` -> `groomer_app/tests/followups.route.vitest.test.ts`
    Route(status/events): `TRACE-004`〜`TRACE-007`, `TRACE-022`〜`TRACE-036`, `TRACE-042` -> `groomer_app/tests/followups.status-route.vitest.test.ts` / `groomer_app/tests/followups.events-route.vitest.test.ts`

## サイドバー見た目改善（カテゴリ名とメニューの視認性分離）
- Task ID: `TASK-447`
- ブランチ: `chore/TASK-447-sidebar-visual-separation`
- ステータス: `done`
- 概要: サイドバーのメニュー順は現状維持のまま、`1)カテゴリ名ラベル化` `2)メニュー項目カード化` `4)アクティブ状態強化` を実施して視認性を改善する
- 影響範囲: `groomer_app/src/components/ui/Sidebar.tsx`、必要に応じて `groomer_app/src/app/globals.css`
- リスク: 既存テーマ変数との配色衝突、モバイル表示での密度増加
- 完了条件:
  - カテゴリ名とクリック可能メニューの見た目差が一目で判別できる
  - メニュー並び順・情報設計は変更しない
  - アクティブページの強調が通常/ホバー状態と明確に区別される
  - デスクトップ・モバイル双方でレイアウト破綻がない
- 進捗:
  - [x] タスク起票（1,2,4を実施対象として明記）
  - [x] 実装方針の最終確認
  - [x] UI実装（`1)カテゴリ名ラベル化`）
  - [x] UI実装（`2)メニュー項目カード化`）
  - [x] UI実装（`4)アクティブ状態強化`）
  - [x] ダーク系テーマの可読性調整（テーマ連動色への寄せ直し）
  - [x] 回帰確認（`npx vitest run tests/ui.sidebar.vitest.test.tsx` / `npm run lint`）
  - [x] UI実装（カテゴリクリックで展開するアコーディオン化）
  - [x] UI調整（`1)見出しバー型` + `2)インデント階層型`）

## `.tsx` 向けVitest導入とUIコンポーネントテスト追加
- Task ID: `TASK-446`
- ブランチ: `test/TASK-446-vitest-button-tsx`
- ステータス: `done`
- 概要: `.tsx` コンポーネント向けに Vitest 実行環境を最小導入し、代表例として `Button.tsx` の挙動テストを追加する
- 影響範囲: `groomer_app/package.json`、`groomer_app/package-lock.json`、`groomer_app/vitest.config.ts`、`groomer_app/tests/setup-vitest.ts`、`groomer_app/tests/ui.button.vitest.test.tsx`
- リスク: 既存 `node:test` ベースとの実行対象競合
- 完了条件:
  - `npx vitest run` で `.tsx` 向けテストが実行できる
  - `Button.tsx` の表示/属性/クリックの基本挙動を検証できる
  - 既存テスト運用を壊さない（Vitest対象を限定）
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] テスト対象リスト化（`Button.tsx` / `Input.tsx` / `Card.tsx` / `ThemeHydrator.tsx` / `GlobalFooter.tsx` / `FormModal.tsx` / `StoreSwitcher.tsx` / `Sidebar.tsx` / `app/legal/*.tsx` / `app/lp/page.tsx` / `app/manual/*.tsx` / `app/page.tsx` / `app/(auth)/*.tsx` / `app/billing-required` / `app/member-portal-*e2e` / `app/dev/page.tsx` / `app/dev/support-chat/page.tsx` / `app/manual/[sectionId]` / `app/dev/manual/*` / `app/support-chat|support-tickets` / `app/dev/support-tickets` / `app/hq/page.tsx` / `app/hq/menu-templates` / `app/hq/menu-template-deliveries` / `app/hq/hotel-menu-templates` / `app/hq/hotel-menu-template-deliveries` / `app/hq/manual/*` / `app/invite/[token]` / `app/reserve/*` / `app/consent/sign/[token]` / `app/billing/{page,history/page,success/page}.tsx` / `app/{appointments,billing,customers,pets,payments,support-chat,support-tickets,inventory,dev,hq}/layout.tsx` / `app/inventory/page.tsx` / `app/dashboard/{page,appointments-kpi,notification-logs,audit-logs,setup-store}/page.tsx` / `app/settings/layout.tsx` / `app/settings/page.tsx` / `app/settings/{storage,public-reserve,notifications,setup-store}/page.tsx`）
  - [x] Vitest最小導入（config/setup）
  - [x] `Button.tsx` テスト追加
  - [x] `Input.tsx` テスト追加
  - [x] `Card.tsx` テスト追加
  - [x] `ThemeHydrator.tsx` テスト追加
  - [x] `GlobalFooter.tsx` テスト追加
  - [x] `FormModal.tsx` テスト追加
  - [x] `StoreSwitcher.tsx` テスト追加
  - [x] `Sidebar.tsx` テスト追加
  - [x] `app/legal/privacy|terms|security|tokusho` ページテスト追加
  - [x] `app/lp` / `app/manual` / `app/manual/glossary` ページテスト追加
  - [x] `app/page` / `app/(auth)/login|signup` ページテスト追加
  - [x] `app/billing-required` / `app/member-portal-*e2e` / `app/dev` ページテスト追加
  - [x] `app/manual/[sectionId]` / `app/dev/manual|glossary|[sectionId]` ページテスト追加
  - [x] `app/support-chat|support-tickets` / `app/dev/support-tickets` ページテスト追加
  - [x] `app/hq` / `app/hq/menu-templates` / `app/hq/menu-template-deliveries` ページテスト追加
  - [x] `app/hq/hotel-menu-templates` / `app/hq/hotel-menu-template-deliveries` ページテスト追加
  - [x] `app/hq/manual` / `app/hq/manual/glossary` / `app/hq/manual/[sectionId]` ページテスト追加
  - [x] `app/invite/[token]` / `app/reserve/[store_id]|cancel` / `app/consent/sign/[token]` / `app/billing/success` ページテスト追加
  - [x] 未カバー残対象の全件リスト化（`app/layout.tsx` / `app/legal/layout.tsx` / `app/manual/layout.tsx` / `app/medical-records/layout.tsx` / `app/ops/layout.tsx` / `app/service-menus/layout.tsx` / `app/visits/layout.tsx` / `app/consents/layout.tsx` / `app/dashboard/layout.tsx` / `app/hotel/layout.tsx` / `app/journal/layout.tsx` / `app/appointments/page.tsx` / `app/consents/page.tsx` / `app/customers/page.tsx` / `app/customers/manage/page.tsx` / `app/dev/appointments-kpi/page.tsx` / `app/dev/billing-alerts/page.tsx` / `app/dev/cron/page.tsx` / `app/dev/subscriptions/page.tsx` / `app/hotel/page.tsx` / `app/inventory/{history,inbounds,outbounds,products,purchase-orders,reorder-suggestions,reports,stocks,stocktake}/page.tsx` / `app/invite/[token]/page-client.tsx` / `app/journal/page.tsx` / `app/journal/pets/[pet_id]/page.tsx` / `app/medical-records/page.tsx` / `app/ops/today/page.tsx` / `app/payments/page.tsx` / `app/pets/page.tsx` / `app/receipts/[payment_id]/page.tsx` / `app/reserve/[store_id]/reserve-form.tsx` / `app/reserve/cancel/page-client.tsx` / `app/service-menus/page.tsx` / `app/shared/{journal,medical-records,member-portal}/[token]/page.tsx` / `app/staffs/page.tsx` / `app/visits/page.tsx`）
  - [x] `app/dashboard/page.tsx` ページテスト追加
  - [x] `app/dashboard/appointments-kpi/page.tsx` ページテスト追加
  - [x] `app/dashboard/notification-logs|audit-logs/page.tsx` ページテスト追加
  - [x] `app/billing/page.tsx` / `app/billing/history/page.tsx` / `app/inventory/page.tsx` / `app/dashboard/setup-store/page.tsx` ページテスト追加
  - [x] `app/{appointments,billing,customers,pets,payments,support-chat,support-tickets,inventory,dev,hq}/layout.tsx` ページテスト追加
  - [x] `app/{dashboard,hotel,journal,consents,legal,manual,medical-records,ops,service-menus,visits}/layout.tsx` / `app/layout.tsx` テスト追加
  - [x] `app/{appointments,consents,customers,hotel,inventory/history|inbounds|outbounds|products|purchase-orders|reorder-suggestions|reports|stocks|stocktake,journal,ops/today,payments,pets,receipts/[payment_id],service-menus,staffs}/page.tsx` テスト追加
  - [x] `app/{invite/[token]/page-client,reserve/cancel/page-client,reserve/[store_id]/reserve-form,shared/journal/[token],shared/medical-records/[token],shared/member-portal/[token],journal/pets/[pet_id],medical-records,visits,customers/manage,dev/appointments-kpi|billing-alerts|cron|subscriptions}/page*.tsx` テスト追加
  - [x] `app/settings/layout.tsx` / `app/settings/page.tsx` / `app/settings/{storage,public-reserve,notifications,setup-store}/page.tsx` ページテスト追加
  - [x] `npx vitest run` 実行確認
  - [x] `npm test` 実行確認
  - [x] `npm run lint` 実行確認（`src/lib/journal/permissions.ts` の `no-explicit-any` 解消済み）

## テスト品質/実装原則の運用ルール明文化とガード導入
- Task ID: `TASK-445`
- ブランチ: `docs/TASK-445-test-guidelines-ops`
- ステータス: `done`
- 概要: テストコード品質・ハードコーディング禁止・Red-Green-Refactor・仕様確認・Vitest利用方針を運用ルールへ反映し、最低限の自動ガードを追加する
- 影響範囲: `AGENTS.md`、`groomer_app/README.md`、`docs/current-test-items.md`、GitHub Actions（テスト品質ガード）
- リスク: 既存運用（`node:test`）と新方針（Vitest）の併記期間での混乱
- 完了条件:
  - ルール文書に禁止事項・必須事項が明記される
  - 実行手順（誰がいつ何を実行するか）が README に追記される
  - チェックリストがテストドキュメントへ追加される
  - 意味のないアサーションと `if(testmode)` 系分岐をCIで検出できる
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 既存ドキュメント/CI確認
  - [x] ルール追記（AGENTS/README/docs）
  - [x] CIガード追加
  - [x] 最終整合確認

## 店舗設定タブ再編と予約カレンダー営業時間連動
- Task ID: `TASK-444`
- ブランチ: `feat/TASK-444-settings-tabs-reorg-and-calendar-hours`
- ステータス: `done`
- 概要: 店舗設定タブ構成を再編し、電子同意書テンプレ管理を内包。予約カレンダー表示時間を営業時間連動に変更する
- 影響範囲: 設定画面タブ構成、公開予約設定UI、店舗運用設定UI、サイドバー、電子同意書テンプレ管理UI、予約カレンダーUI、関連APIリダイレクト、TASKS
- リスク: 既存導線URLの遷移差分、設定保存後の戻り先不整合、カレンダー表示範囲外予約の見落とし
- 完了条件:
  - 店舗運用設定タブに指定項目（営業時間/例外日/会員証/LTV/顧客管理β）が集約される
  - 公開予約設定タブには公開予約関連のみ残り、アラート閾値が公開枠ルール配下へ移動する
  - 電子同意書テンプレ管理が店舗設定タブ内に移設され、旧サイドバー導線は削除される
  - テンプレ管理内の2タブ（テンプレ作成/同意文有効化）が1ページ化される
  - 予約カレンダー週/日表示が営業時間の前後1時間を基本表示し、範囲外予約自動拡張のON/OFFを店舗運用設定で制御できる
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 現行設定/同意書/カレンダー導線の整理
  - [x] 設定タブ再編（店舗運用設定・公開予約設定再配置）
  - [x] 電子同意書テンプレ管理の店舗設定内移設と1ページ化
  - [x] 予約カレンダー営業時間連動 + 範囲外予約自動拡張設定
  - [x] 文言統一と配置調整（「定休日・臨時休業」へ統一、範囲外表示チェックを営業時間カードへ移動）
  - [x] 店舗設定ページを owner/admin 限定に制限し、店舗運用設定の権限カードを削除
  - [x] 営業時間変更がカレンダーへ反映されない不具合を修正（保存APIフォールバックを現行DB値基準へ統一）
  - [x] 営業時間保存時の値巻き戻り対策（営業時間値の必須検証 + stores更新0件をエラー化）
  - [x] 営業時間保存時の誤404を修正（stores更新0件判定を撤回し、DB/RLS差分で正常保存を阻害しないよう調整）
  - [x] 営業時間保存のRLS空振り対策（認可はユーザーJWT、stores更新はadmin client優先で実行）
  - [x] 設定画面アクセス制御のE2E追加（owner/admin許可・staff拒否）
  - [x] 電子同意書テンプレ管理（店舗設定内）の余計なタブUIを削除（1ページ表示へ統一）
  - [x] 通知設定/公開予約設定の権限カード削除、LTV入力表形式化、店舗管理説明文の平易化
  - [x] 予約カレンダーの表示改善（予約チップ文字のはみ出し表示許可 + 重なり時の表示優先z-index追加）
  - [x] 予約チップ表示拡張（施術内容を2行目に表示、2行高さへ調整、週表示の日付表記を「日付（曜日）」へ変更）
  - [x] 予約カレンダーのレーン仕様変更（スタッフ別レーン廃止、重複時間のみレーン増加、レーン間罫線削除）
  - [x] テスト更新・lint/test実行（`npm run test:e2e -- e2e/settings-pages.spec.ts e2e/appointments-calendar.spec.ts e2e/consents-signing.spec.ts` / `npm test -- tests/settings.presentation.test.ts tests/appointments.calendar-presentation.test.ts`。`npm run lint` は既存差分外 `src/lib/journal/permissions.ts` の `no-explicit-any` で失敗）

## 予約カレンダーの時間軸横向き化
- Task ID: `TASK-443`
- ブランチ: `feat/TASK-443-calendar-horizontal-time-axis`
- ステータス: `done`
- 概要: 予約カレンダーの週/日タイムラインで、時間軸を縦方向から横方向へ変更し、視認性と操作性を改善する
- 影響範囲: 予約カレンダーUI（週/日表示）、ドラッグ&ドロップ移動の座標計算、E2E確認、TASKS
- リスク: 横スクロール量増加、既存D&D操作感の変化、重なり表示レイアウトの崩れ
- 完了条件:
  - 週/日表示で時間軸が横方向に表示される
  - 既存の予約編集遷移とD&D移動が継続して動作する
  - 既存E2E（予約カレンダー系）が通る、もしくは差分影響を説明できる
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 既存カレンダーレイアウト解析
  - [x] 横時間軸レイアウト実装
  - [x] D&D座標計算の横軸対応
  - [x] lint/test 実行（`npm run test:e2e -- e2e/appointments-calendar.spec.ts` / `npm test -- tests/appointments.calendar-presentation.test.ts`。`npm run lint` は既存差分外 `src/lib/journal/permissions.ts` の `no-explicit-any` で失敗）

## 会員証URLのセルフ再取得導線（期限切れ時）
- Task ID: `TASK-441`
- ブランチ: `feat/TASK-441-member-portal-self-reissue-request`
- ステータス: `done`
- 概要: 会員証URL期限切れ画面から顧客が再発行リクエストを送信できる導線を追加し、店舗側の問い合わせ対応を減らす
- 影響範囲: 会員証ポータル失効画面、顧客向けAPI、店舗通知（任意）、監査ログ、会員証失効判定（対象店舗の最終来店+設定TTL）表示、TASKS
- リスク: なりすましリクエスト、過剰リクエスト、店舗運用（承認/即時発行）の不整合
- 完了条件:
  - 期限切れ画面で再発行リクエストを送信できる
  - 店舗側でリクエスト起点の再発行が行える
  - 期限切れ判定が「対象店舗の最終来店日+設定TTL（来店なしは発行+設定TTL）」と一致する
  - 監査ログに request / issue のイベントが残る
- 進捗:
  - [x] 要件確定（承認フロー有無・通知チャネル）
  - [x] 期限判定方針確定（対象店舗の最終来店+設定TTL）
  - [x] API/UI実装
  - [x] テスト追加（unit/e2e）
  - [x] 期限切れ時の再発行依頼導線E2E追加（`e2e/member-portal-reissue.spec.ts`）
  - [x] API契約書のTTL可変化・キャンセル除外前提（`visits`計上ルール）を明文化
  - [x] lint/test実行（`npm test -- tests/member-portal-expiry.test.ts` / `npm run test:e2e -- --project=chromium e2e/member-portal-phase2.spec.ts e2e/member-portal-reissue.spec.ts`。`npm run lint` は既存差分外 `src/lib/journal/permissions.ts` の `no-explicit-any` で失敗）

## 会員証URL有効期限の可変TTL設定（30/90/180日）
- Task ID: `TASK-440`
- ブランチ: `feat/TASK-440-member-portal-variable-ttl`
- ステータス: `done`
- 概要: 会員証URLの有効期限を店舗ごとに 30/90/180日から選択できる設定を追加し、失効式を「対象店舗の最終来店日 + TTL」に統一する
- 影響範囲: 店舗設定UI、設定保存API、検証API（失効判定算出）、会員証表示文言、TASKS
- リスク: 既存店舗のデフォルト値移行ミス、短期TTL化による問い合わせ増、説明不足による誤設定
- 完了条件:
  - 店舗設定でTTL（30/90/180日）を保存できる
  - 失効判定が対象店舗の最終来店日（`visits`・キャンセル除外）+店舗設定TTLで算出される
  - 来店履歴なし顧客は発行日+店舗設定TTLで判定される
  - 会員証UI/運用ルール表示が設定値と整合する
- 進捗:
  - [x] 設定項目とデフォルト値（90日）を確定
  - [x] 失効判定方針確定（対象店舗スコープ、`visits`計上=有効来店前提）
  - [x] DB/API/UI実装
  - [x] テスト追加（unit/e2e）
  - [x] 契約書更新（90日固定表現の解消、TTL可変を正式仕様化）
  - [x] lint/test実行（`npm test -- tests/member-portal-expiry.test.ts` / `npm run test:e2e -- --project=chromium e2e/member-portal-phase2.spec.ts e2e/member-portal-reissue.spec.ts`。`npm run lint` は既存差分外 `src/lib/journal/permissions.ts` の `no-explicit-any` で失敗）

## 会員証ポータルからの空き枠待ち自己登録導線追加
- Task ID: `TASK-439`
- ブランチ: `feat/TASK-439-member-portal-waitlist-self-register`
- ステータス: `done`
- 概要: 会員証ポータル（顧客向け）から空き枠待ちを顧客本人が登録/解除できる導線を追加し、店舗側の転記負荷を減らす
- 影響範囲: 会員証ポータルUI、顧客向けAPI、`slot_waitlist_requests` 登録フロー、テスト、TASKS
- リスク: 本人確認不足時の誤登録、重複登録による候補ノイズ、既存店舗運用との二重管理
- 完了条件:
  - 会員証ポータルで空き枠待ちの登録（必要項目入力）ができる
  - 登録済み状態の確認と解除ができる
  - 既存の店舗側 waitlist 登録導線と競合せず共存できる
  - lint/test が通過する（既存失敗がある場合は差分範囲で影響なしを確認）
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 会員証ポータル既存導線と認証方式の調査
  - [x] 顧客向け waitlist API（登録/解除/取得）実装
  - [x] 会員証ポータルUI実装（登録フォーム・状態表示・解除）
  - [x] 重複登録防止/バリデーション実装
  - [x] 待ち登録の希望メニューを選択式へ変更（所要時間表示付き）
  - [x] 顧客管理βの waitlist 導線を `/customers/manage` 内完結へ修正
  - [x] 単体テスト・E2E更新（`tests/member-portal-waitlist.test.ts` / `e2e/member-portal-waitlist.spec.ts`）
  - [x] lint/test 実行

## 顧客管理・ペット管理の統合ページ仕様策定と実装
- Task ID: `TASK-438`
- ブランチ: `feat/TASK-438-customer-pet-unified-spec`
- ステータス: `done`
- 概要: 既存の`/customers`と`/pets`は残したまま、別ページに顧客起点の統合管理画面（基本情報タブ + ペット別タブ）を新設し、店舗設定で表示件数/表示条件を可変にする
- 影響範囲: 顧客/ペット統合UI、店舗設定UI、設定保存API、Supabase SQL、サイドバー導線、仕様書、TASKS
- リスク: 一覧起点と顧客起点の操作分岐による学習コスト増、データ読込増による初期表示遅延
- 完了条件:
  - 統合ページの情報要件（既存顧客一覧・既存ペット一覧の全項目）が明文化されている
  - タブ構成・導線・非破壊移行方針（既存ページ温存）が明文化されている
  - 未確定事項が質問リストとして整理され、実装着手可否を判断できる状態である
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 現状画面（`/customers`, `/pets`, `/journal/pets/[pet_id]`, `/medical-records`）の項目棚卸し
  - [x] 初版仕様ドラフト作成（`docs/customer-pet-unified-page-spec.md`）
  - [x] 仕様確定（質問回答の反映）
  - [x] 実装タスク分解（画面/API/テスト）
  - [x] 新規画面実装（`/customers/manage`: 基本情報タブ + ペット名タブ + 紐づくカルテ/日誌）
  - [x] UI改善（基本情報タブをカード/セクション型へ再設計）
  - [x] 基本情報へ来店履歴追加（日付・ペット名・施術内容/ホテル期間）
  - [x] 来店履歴の詳細遷移追加（施術: 予約詳細 / ホテル: 該当滞在をディープリンク選択）
  - [x] UI再調整（カード配置見直し・ステータス位置変更・ペットタブの見た目統一・文言整理）
  - [x] UI再調整2（会員証URLをヘッダーアクションへ統合、重複情報の削除）
  - [x] UI再調整3（会員証URLを顧客情報右カード化、ペット情報2列化、注記文言簡素化）
  - [x] 日誌一覧改善（顧客管理βのペット情報タブのみ: 1件カード化・先頭メディア表示・公開/非公開トグル追加）
  - [x] 日誌一覧UI微調整（公開ラベル簡素化、PC 3〜4列グリッド、メディア縮小）
  - [x] ペット情報レイアウト再調整（右カラム活用・狭幅で崩れにくい2カード構成へ）
  - [x] ヘッダー説明文の整理（顧客管理（β）直下コメントを削除）
  - [x] 検索UI折りたたみ化（虫眼鏡アイコンで展開）
  - [x] 検索エリアの非カード化とタブ切替時スクロール維持（scroll=false）
  - [x] ペットタブ行に操作導線を統合（余白削減）
  - [x] 顧客/ペット操作をセグメントバー化（試作）
  - [x] 操作セグメントのモバイル最適化（3分割・短縮ラベルで改行防止）
  - [x] 検索UIの機能美改善（右上オーバーレイ化・顧客チップ横スクロール化）
  - [x] サイドバー導線追加（`顧客管理（β）`）
  - [x] 店舗設定UI追加（カルテ表示件数N・日誌表示条件）
  - [x] 設定保存API追加（`/api/stores/customer-management-settings`）
  - [x] Supabase SQL追加（`store_customer_management_settings`）
  - [x] lint/test実行（`npm run lint` / `npm test -- tests/customers.presentation.test.ts tests/pets.presentation.test.ts`）
  - [x] `npm run build` 実行（2026-04-05時点: build通過）

## 日誌機能（非破壊追加）仕様策定と実装管理
- Task ID: `TASK-437`
- ブランチ: `feat/TASK-437-journal-module-spec`
- ステータス: `done`
- 概要: 既存DB/既存API/既存写真カルテ・動画カルテを壊さず、日誌機能を新規モジュールとして追加する仕様・UI・APIを確定する（段階リリースは実施しない）
- 影響範囲: 日誌仕様書 / 新規DBテーブル設計 / 新規API契約（既存準拠: `/api/journal/*`）/ 新規UIコンポーネント / TASKS
- リスク: 既存カルテ連携時の参照不整合、通知キュー遅延による体験劣化
- 完了条件:
  - 既存DB/既存APIレスポンス/既存写真カルテ・動画カルテに破壊的変更がない
  - 日誌機能のMVP仕様（UI/API/データ構造/通知/権限/多頭飼い）が確定している
  - `TASKS.md` で実装タスクに分解可能な粒度まで管理されている
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 非破壊要件ベースで日誌機能の完全仕様作成
  - [x] 段階リリース要件を撤回し、TASKS管理へ統一
  - [x] 実装タスク分割（API/UI/通知/権限/テスト）
  - [x] API実装（`/api/journal/entries` 一覧/作成、`/api/journal/entries/[entry_id]` 詳細/更新）
  - [x] API実装（`/api/journal/pets/[pet_id]/timeline`、`/api/journal/entries/[entry_id]/notify`）
  - [x] DB実装（新規テーブル migration: entries/pets/media/health_checks/notifications/links/permissions）
  - [x] UI実装（スタッフ向け日誌作成画面・ペット別アルバム・飼い主向け閲覧画面）
  - [x] UI実装（スタッフ向け日誌作成画面 `/journal`）
  - [x] UI実装（ペット別アルバム画面の導線/表示）
  - [x] UI実装（飼い主向け閲覧画面）
  - [x] UI導線改善（サイドバー/主要画面から日誌への到達性とヘッダー表示崩れの修正）
  - [x] 投稿機能拡張（`/journal` で写真・動画添付を可能にし、`journal_media` とアルバム表示を一貫連携）
  - [x] 権限実装（既存ロール参照+`journal_permissions_override`）
  - [x] LINE通知実装（既存送信基盤を利用した日誌公開通知）
  - [x] 統合実装（写真カルテ/動画カルテとの非破壊リンク）
  - [x] テスト実装（API単体/権限/通知キュー/UI主要導線）
  - [x] 単体テスト追加（`journal.permissions.test.ts`）
  - [x] 単体テスト追加（`journal.notifications.test.ts`）
  - [x] 単体テスト追加（`journal.cron-line-notifications.test.ts`）
  - [x] E2Eテスト追加（`e2e/journal-pages.spec.ts`）
  - [x] CI連携（GitHub Actions: `journal-e2e.yml` で日誌 `lint` / 単体 / E2E を自動実行）
  - [x] lint/test実行確認（`npm run lint` / `npm test -- tests/journal.*.test.ts`）

## 予約管理の同意書ステータスバッジと状態別導線追加
- Task ID: `TASK-436`
- ブランチ: `fix/TASK-436-appointments-consent-badge-actions`
- ステータス: `done`
- 概要: 予約管理一覧で同意書の署名状態をバッジで可視化し、未署名時は作成導線、署名済み時はPDF表示導線を出し分ける
- 影響範囲: 予約管理UI（`/appointments`）/ 同意書PDF API（redirect対応）/ E2E fixture / TASKS
- リスク: 同意書の最新判定ルール変更による導線表示差分
- 完了条件:
  - 予約一覧の各行に同意書ステータスバッジ（未作成/未署名/署名済み）が表示される
  - 未作成・未署名では「同意書を作成」導線が表示される
  - 署名済みでは「PDF表示」導線が表示される
  - 同意書状態判定は `appointment_id` 紐付けの最新文書で行う
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 予約一覧へ同意書状態バッジ追加
  - [x] 状態別導線（作成/PDF表示）実装
  - [x] PDF APIのリダイレクト導線対応
  - [x] fixture更新・動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書管理のタブ分割・履歴PDF参照/削除・署名導線強化
- Task ID: `TASK-435`
- ブランチ: `fix/TASK-435-consents-tabs-history-pdf-flow`
- ステータス: `done`
- 概要: 電子同意書管理画面を店舗管理/顧客業務で分離し、履歴からPDF参照/削除を可能にし、店頭署名時の署名URL別タブ表示と当日運用画面の未署名導線を追加する
- 影響範囲: 同意書管理UI（`/consents`）/ 同意書API（documents）/ ダッシュボード（`/dashboard`）/ 当日運用（`/ops/today`）/ 顧客管理・ペット管理導線 / Supabase SQL / TASKS
- リスク: 既存同意書運用導線（再発行/履歴参照）のUX変更、同意書と予約の紐付け追加に伴う互換性
- 完了条件:
  - 「この画面の使い方」「カテゴリは将来の〜」文言が削除される
  - 店舗管理（テンプレ作成/同意文有効化）と顧客業務（同意書作成・署名依頼/同意書履歴）が別タブ化される
  - 履歴からPDF参照と削除操作ができる
  - 店頭署名で同意書作成時に署名URLが別タブで開く
  - 顧客管理・ペット管理の同意書導線を整理（不要導線の削除）
  - ダッシュボード/モバイル当日運用に未署名予約の同意書作成導線が表示される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 同意書管理UIのタブ分割と文言整理
  - [x] サイドバー遷移元カテゴリ別の2タブ表示（顧客業務/店舗管理）対応
  - [x] 履歴PDF参照/削除API・UI実装
  - [x] 店頭署名URLの別タブ表示対応
  - [x] 顧客管理・ペット管理導線整理
  - [x] ダッシュボード/当日運用の未署名導線追加
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 店舗別決済アカウント接続と通常決済のStripe/KOMOJU対応
- Task ID: `TASK-442`
- ブランチ: `feat/TASK-442-store-payment-provider-connection`
- ステータス: `done`
- 概要: 店舗ごとにStripe/KOMOJU接続情報を管理し、事前決済に加えて通常会計でもStripe/KOMOJU決済導線を利用できるようにする
- 影響範囲: 決済設定API/UI、決済プロバイダ呼び出し、通常会計API/UI、webhook検証、Supabase SQL、TASKS
- リスク: 接続情報の秘匿運用、webhook検証の誤判定、二重会計、既存サブスク課金経路との混同
- 完了条件:
  - 店舗別にStripe/KOMOJU接続情報を保存・有効化できる
  - 予約事前決済Checkoutが店舗別接続情報を使用する
  - 通常会計でもStripe/KOMOJU Checkoutを開始できる
  - 決済完了で会計反映され、二重計上を回避できる
  - テスト/ビルドが通る（既存差分外エラーは明示）
- 進捗:
  - [x] タスク登録・ブランチ切替
  - [x] 店舗別接続情報テーブル/API実装（`store_payment_provider_connections` + `/api/settings/payment-provider-connections`）
  - [x] 決済プロバイダ呼び出しの店舗別キー対応（`providers.ts` に credentials override を追加）
  - [x] 通常会計Stripe/KOMOJU決済API/UI導線追加（`/api/payments/checkout` + `PaymentForm` ボタン）
  - [x] webhook検証/会計反映の店舗別対応（複数webhook secret検証 + `appointment_payment` 会計反映）
  - [x] テスト・ビルド確認（対象テスト3件pass、変更ファイルeslint pass、`npm run build` pass）
  - [x] Supabase SQL Editor反映（`supabase_store_payment_provider_connections.sql`）

## 既存店舗向け同意書テンプレ更新SQL作成
- Task ID: `TASK-434`
- ブランチ: `fix/TASK-434-consent-template-existing-store-update`
- ステータス: `done`
- 概要: 既存店舗で既に作成済みの「施術同意書（標準）」を新仕様テンプレートへ切り替え、SNS利用選択の別入力実装と顧客/ペット情報の自動差し込みを反映する
- 影響範囲: Supabase SQL（`supabase_consent_default_templates_update_existing.sql`/`supabase_consent_default_templates.sql`）/ 同意書管理UI（`/consents`）/ 同意書API / 公開署名API / TASKS
- リスク: 既存店舗で current_version が新バージョンへ更新されることによる運用差分
- 完了条件:
  - 既存店舗テンプレートを新バージョン追加+current_version切替で更新できる
  - SNS利用選択を署名時に本人入力として受け取り、テンプレへ差し込みできる
  - 住所/電話/犬種/年齢/性別を顧客・ペット情報から自動差し込みできる
  - 体重項目をテンプレートから削除する
  - 再実行しても同一本文なら重複更新しない
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 更新SQLの初版作成
  - [x] 要件8項目の方針確定
  - [x] SNS利用選択の署名時本人入力実装（UI/API）
  - [x] 自動差し込み変数の拡張（住所/電話/犬種/年齢/性別）
  - [x] 標準テンプレート文面再調整（体重削除含む）
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（in_progressへ再オープン）

## 施術同意書標準テンプレート完全版差し替え
- Task ID: `TASK-433`
- ブランチ: `fix/TASK-432-consent-document-layout-signature`
- ステータス: `done`
- 概要: 施術同意書の標準テンプレート本文を完全版へ差し替え、初期投入（既存店舗バックフィル/新規店舗自動投入）を統一する
- 影響範囲: Supabase SQL（`supabase_consent_default_templates.sql`）/ TASKS
- リスク: 既存テンプレート本文との差分による運用手順変更
- 完了条件:
  - 標準テンプレートの `body_html/body_text` が指定全文へ差し替わる
  - 新規店舗作成時の自動投入テンプレートにも同一内容が適用される
- 進捗:
  - [x] タスク登録
  - [x] 標準テンプレート本文差し替え（HTML/TEXT）
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 施術同意書の表示体裁改善とPDF2ページ化
- Task ID: `TASK-432`
- ブランチ: `fix/TASK-432-consent-document-layout-signature`
- ステータス: `done`
- 概要: 署名URL画面とPDFの体裁（タイトル/センタリング/インデント/改行）を整え、PDFをP1=施術同意書本文、P2=テンプレ名+監査情報の2ページ構成へ改善する
- 影響範囲: 公開署名UI / 同意書PDF生成ロジック / 署名フロー / 関連テスト / TASKS
- リスク: 既存PDFとの互換性（閲覧・印刷）
- 完了条件:
  - 署名画面の見出し/本文/署名欄の可読性が改善される
  - PDFが2ページ構成（P1本文・P2監査情報）で生成される
  - PDFに電子署名情報（署名者・署名時刻・署名ダイジェスト）が表示される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 署名画面の体裁調整
  - [x] PDF2ページ化（本文/監査ページ分離）
  - [x] 電子署名情報表示の強化
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 予約管理起点の同意書作成導線とPDF作成強化
- Task ID: `TASK-431`
- ブランチ: `fix/TASK-431-consents-appointment-flow-pdf`
- ステータス: `done`
- 概要: 顧客/ペット管理起点の同意書作成を補助導線へ寄せ、予約管理から同意書を作成して予約施術内容を自動反映し、PDF作成時の署名証跡を強化する
- 影響範囲: 予約管理UI (`/appointments`) / 同意書管理UI (`/consents`) / 同意書作成API / 署名公開API / PDF生成ロジック / TASKS
- リスク: 既存導線（顧客/ペット管理）の運用変更による混乱
- 完了条件:
  - 予約管理から対象予約に紐づく同意書作成へ遷移できる
  - `appointment_id` 起点で `customer/pet/service` が同意書作成フォームに自動反映される
  - PDFに同意本文と監査情報に加え、署名証跡を追跡できる形で保存される
- 進捗:
  - [x] タスク登録
  - [x] 予約管理導線の追加
  - [x] `appointment_id` ベースの同意書作成プリセット実装
  - [x] PDF作成強化（署名証跡）
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書管理のレイアウト統一・テンプレ本文再利用・PDF証跡強化
- Task ID: `TASK-430`
- ブランチ: `fix/TASK-430-consents-layout-template-pdf-prefill`
- ステータス: `done`
- 概要: 電子同意書管理画面の共通レイアウト欠落を解消し、テンプレ選択時の本文再利用と導線プリセットを改善しつつ、PDFに同意本文と監査情報を残す
- 影響範囲: `/consents` レイアウト / 同意書管理UI / 顧客・ペット管理の同意書導線 / 同意書署名〜PDF生成ロジック / TASKS
- リスク: 既存同意書運用（再送・署名URL）の互換性
- 完了条件:
  - `/consents` 表示時に既存業務画面と同じサイドバー導線で表示される
  - 「同意文を有効化」でテンプレ選択時に既存本文が編集欄へ反映される
  - 顧客/ペット管理からの遷移時に同意書作成フォームが適切に初期選択される
  - 署名後PDFに同意本文と監査項目（文書ID/版/署名者/署名日時/署名情報）が記録される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] レイアウト統一と導線初期値対応
  - [x] テンプレ本文の再利用改善
  - [x] PDF証跡強化（同意本文+監査情報）
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## アプリ名/会社名の全ページ反映
- Task ID: `TASK-429`
- ブランチ: `fix/TASK-429-brand-rename-groombase-sakelab`
- ステータス: `done`
- 概要: アプリ名を `GroomBase`、会社名を `SAKE Lab` に統一して全ページへ反映する
- 影響範囲: 共通レイアウト/フッター/法務ページ共通定義/TASKS
- リスク: 文言差し替え漏れ
- 完了条件: 主要全ページで新名称が表示され、法務ページの事業者名も `SAKE Lab` で統一される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 名称の一括反映
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書PDF文字化け修正（日本語対応）
- Task ID: `TASK-428`
- ブランチ: `fix/TASK-427-consent-storage-buckets`
- ステータス: `done`
- 概要: 同意書PDFの本文が日本語で文字化けする問題を解消する
- 影響範囲: 同意書PDF生成ロジック / 関連テスト / TASKS
- リスク: PDF互換性への影響
- 完了条件: 日本語を含む同意書PDFが可読状態で生成される
- 進捗:
  - [x] タスク登録
  - [x] PDF生成ロジック修正（日本語対応）
  - [x] テスト更新・実行
  - [x] TASKS更新（done化）

## 電子同意書Storageバケット不足エラー修正
- Task ID: `TASK-427`
- ブランチ: `fix/TASK-427-consent-storage-buckets`
- ステータス: `done`
- 概要: 署名確定時の `Bucket not found` を解消するため、consent用Storageバケットとポリシーを定義し、エラーメッセージを運用向けに明確化する
- 影響範囲: Supabase SQL（storage buckets/policies）/ 公開署名APIエラーハンドリング / TASKS
- リスク: 既存storage policyとの命名衝突
- 完了条件: `consent-signatures` / `consent-pdfs` が自動作成され、署名確定が成功する
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] consent用Storage SQL追加
  - [x] 署名APIのエラーメッセージ改善
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書テンプレ差し込み表示とプレビュー実装
- Task ID: `TASK-426`
- ブランチ: `fix/TASK-426-consent-template-rendering`
- ステータス: `done`
- 概要: 同意書テンプレートの `{{ }}` 変数を実データへ差し込み、作成画面と署名画面で本文プレビュー/表示する
- 影響範囲: 同意書管理UI（`/consents`）/ 公開署名API（`/api/public/consents/[token]`）/ 共通レンダラ
- リスク: 置換漏れによる誤表示、HTML差し込み時の安全性
- 完了条件: テンプレ選択時に本文が表示され、署名画面で `{{ }}` が残らない
- 進捗:
  - [x] タスク登録
  - [x] 差し込みレンダラ実装
  - [x] 同意書作成画面プレビュー実装
  - [x] 公開署名APIの差し込み適用
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書の署名URL再取得導線追加
- Task ID: `TASK-425`
- ブランチ: `fix/TASK-425-consent-sign-url-regenerate`
- ステータス: `done`
- 概要: 同意書作成後に署名URLを見失っても、履歴一覧からURLを再発行して表示できるようにする
- 影響範囲: 同意書管理UI（`/consents`）/ TASKS
- リスク: signed/revoked 文書への操作誤誘導
- 完了条件: 履歴一覧から再発行操作ができ、URLを画面で再確認できる
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 履歴一覧に再発行アクション追加
  - [x] 再発行URL表示（コピーしやすい表示）
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書テンプレートUIの用語/入力改善
- Task ID: `TASK-424`
- ブランチ: `fix/TASK-424-consent-template-ux-clarity`
- ステータス: `done`
- 概要: スタッフが迷う「テンプレート作成/版公開」「HTML/本文プレーン」などの用語・入力方式を改善し、既存挙動を維持したまま運用負荷を下げる
- 影響範囲: 同意書管理UI（`/consents`）/ TASKS
- リスク: 文言変更による既存マニュアルとの不一致
- 完了条件: 本文入力を1つに集約し、UI上で用語と手順が理解できる状態になる
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 用語改善（画面文言）
  - [x] 本文入力の簡略化（単一入力）
  - [x] 未対応機能（編集/削除）の明示
  - [x] 動作確認（lint/test）
  - [x] TASKS更新（done化）

## 電子同意書テンプレート標準初期化（店舗作成時の自動投入）
- Task ID: `TASK-423`
- ブランチ: `feat/TASK-423-consent-default-templates`
- ステータス: `done`
- 概要: 電子同意書の標準テンプレートを全店舗で利用できるよう、既存店舗への初期投入と新規店舗作成時の自動投入を実装する
- 影響範囲: Supabase SQL（同意書テンプレートseed関数/trigger）
- リスク: 店舗ごとの既存カスタムテンプレートとの重複、トリガー重複作成、同意文言の法務整合性
- 完了条件: SQLを毎回手動実行しなくても、新規店舗作成時に標準テンプレート（公開版）が自動作成される
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 標準テンプレート本文（必須項目網羅）定義
  - [x] 既存店舗バックフィルSQL追加
  - [x] 新規店舗自動投入trigger追加
  - [x] 動作確認（SQLレビュー）
  - [x] TASKS更新（done化）

## 電子同意書（施術同意書）機能追加
- Task ID: `TASK-422`
- ブランチ: `feat/TASK-422-electronic-consent`
- ステータス: `done`
- 概要: 顧客/ペット単位で施術同意書を電子署名取得し、PDF保存・履歴管理・テンプレート版管理・LINE署名導線まで提供する
- 影響範囲: 同意書UI/テンプレ管理/UI署名フロー/API/DB/通知/PDF生成
- リスク: 法務要件との不整合、署名証跡不足、運用時の署名漏れ
- 完了条件: 同意書作成→署名→PDF保存→カルテ参照→履歴閲覧の一連が動作し、店舗運用導線と監査要件を満たす
- 進捗:
  - [x] タスク登録
  - [x] 要件確定（仕様書ベース）
  - [x] 実装タスク分解（DB/API/UI/通知）
  - [x] 仕様書作成（`docs/electronic-consent-feature-spec.md`）
  - [x] DB実装: 同意書6テーブルDDL + RLS + インデックス追加（`supabase/supabase_electronic_consents.sql`）
  - [x] API実装: templates/versions/documents/public-sign/pdf/resend/revoke
  - [x] UI実装: 顧客・ペット一覧からの同意書導線 + テンプレ管理画面 + 署名画面
  - [x] UI拡張: 顧客・ペット編集モーダル（詳細導線）への同意書統合（最新5件+一覧遷移）
  - [x] 通知実装: LINE署名URL送信 + 未署名リマインド（24h/72h/期限前日）
  - [x] PDF実装: 署名完了時の自動生成（署名時同期生成）
  - [x] 監査実装: 作成/送信/署名/再送/失効の監査ログ記録（`consent_audit_logs`）
  - [x] テスト実装: ユニット/統合/E2E（店頭署名・LINE署名）
  - [x] テスト実装（ユニット）: consent共有ロジック/PDF生成/監査ログヘルパー
  - [x] テスト実装（ユニット）: 署名リマインド判定ロジック（24h/72h/期限前）
  - [x] テスト実装（E2Eケース追加）: 顧客/ペット編集導線での電子同意書サマリー表示
  - [x] テスト実装（統合準備）: 作成/署名APIのコアロジック分離 + フローテスト追加
  - [x] テスト実装（擬似統合）: 作成→署名→PDF成果物パスの一連検証
  - [x] テスト実装（依存モック統合）: documents POST フローの送信/監査連携検証
  - [x] テスト実装（依存モック統合）: public sign POST フローの署名/PDF/監査連携検証
  - [x] テスト実装（統合）: APIフロー（作成→署名→PDF）の通し検証
  - [x] テスト実装（E2E実行確認）: 顧客/ペット編集導線の同意書サマリーケースを実行確認
  - [x] テスト実装（E2E実行確認）: 店頭署名・LINE署名の実運用導線

## 競合LPベンチマーク整合のLP改修（2026-03-26）
- Task ID: `TASK-421`
- ブランチ: `feat/TASK-421-lp-benchmark-alignment`
- ステータス: `done`
- 概要: 参照LP（CHERIEE/ONE HOME PLUS）の訴求構成を踏まえ、料金・解約条件の同一面完結を含む本サービスLPへ改修する
- 影響範囲: LPページ（`/lp`）/ 比較メモ（`docs/pet-salon-saas-benchmark-memo-2026-03-26.md`）
- リスク: 法務文言とLP記載の不整合、競合比較表現の過剰断定
- 完了条件: 料金と解約条件を同一画面で確認可能、比較メモとLP訴求が整合、参照URLを記録済み
- 進捗:
  - [x] ブランチ作成・タスク登録
  - [x] 競合比較観点の整理とメモ保存
  - [x] LP改修の実装（構成強化）
  - [x] 動作確認・差分レビュー


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
- ステータス: `done`
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
  - [x] PR作成（`merge: TASK-401 unified invoice checkout` / `merge: TASK-401 hotel invoice runtime fix` / `merge: TASK-401 unified checkout manual and recording flow` で main 反映済み）

## 事前決済
- Task ID: `TASK-409`
- ブランチ: `feature/prepayment`
- ステータス: `done`
- 概要: 予約時に事前決済またはカード仮押さえを選択できるようにし、無断キャンセル請求とキャンセルポリシー管理を追加する
- 影響範囲: API / DB / UI
- リスク: 予約作成と既存会計フローの二重課金、無断キャンセル時の請求判定、既存予約画面の一覧表示崩れ
- 完了条件: 予約時の決済方式選択、設定画面でのキャンセルポリシー管理、無断キャンセル請求導線、予約一覧バッジ表示、テスト追加が完了している
- 進捗:
  - [x] 既存予約/会計/課金連携の調査反映
  - [x] DB拡張
  - [x] API追加
  - [x] UI実装
  - [x] 予約事前決済Checkout API追加（`POST /api/appointments/[appointment_id]/reservation-payment/checkout`）
  - [x] Stripe/KOMOJU webhookで `reservation_prepayment` 完了時に予約を `paid` 反映
  - [x] 予約フォームに決済方式選択を追加し、`prepayment` 選択時は保存後にCheckoutへ遷移
  - [x] 予約一覧に決済バッジ表示（決済済/仮押さえ/請求待ち等）と無断CXL請求ボタンを追加
  - [x] `prepayment` 初期状態を `unpaid` に修正（予約作成時点での自動 `paid` を廃止）
  - [x] テスト（`npm test -- tests/appointments.reservation-payment.test.ts tests/payments.shared.test.ts tests/payments.duplicate-guard.test.ts` 3件pass）
  - [x] 変更ファイル lint（`npx eslint ...` 追加変更ファイル群はpass）
  - [x] PR作成（`feature/prepayment` は `main` 反映済みのため差分なし）

## LINEの自動マーケ
- Task ID: `TASK-410`
- ブランチ: `feature/line-auto-marketing`
- ステータス: `done`
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
  - [x] テスト（`npm test -- tests/followups.recommendation.test.ts tests/notification-templates.next-visit-suggestion.test.ts tests/cron.appointment-reminders-core.test.ts` 3件pass）
  - [x] PR作成（`feature/line-auto-marketing` は `main` 反映済みのため差分なし）

## 写真カルテのAIタグ付け
- Task ID: `TASK-411`
- ブランチ: `feature/ai-photo-tags`
- ステータス: `done`
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
  - [x] PR作成（`feature/ai-photo-tags` は `main` 反映済みのため差分なし）

## AIタグ活用導線の改善
- Task ID: `TASK-412`
- ブランチ: `feat/medical-record-ai-tag-usage`
- ステータス: `done`
- 概要: カルテ一覧でAIタグをチップ表示し、タグや解析状態で絞り込めるようにして、詳細を開かなくても要確認カルテを見つけやすくする
- 影響範囲: UI / 一覧導線 / テスト
- リスク: 一覧の情報量増加、モバイル表示の圧迫、タグ絞り込み条件の分かりにくさ
- 完了条件: 一覧のタグ可視化、タグフィルタ、解析状態フィルタ、関連テスト追加が完了している
- 進捗:
  - [x] 既存カルテ一覧UIの調査反映
  - [x] UI実装
  - [x] テスト
  - [x] PR作成（`merge: integrate feat/medical-record-ai-tag-usage into main` で反映済み）

## AIタグ解析ジョブのRLS修正
- Task ID: `TASK-413`
- ブランチ: `fix/medical-record-ai-tag-jobs-rls`
- ステータス: `done`
- 概要: AIタグの「AIタグを解析」実行時に `medical_record_ai_tag_jobs` insert が RLS で拒否される問題を解消する
- 影響範囲: DB(RLS) / AIタグ解析受付API
- リスク: RLS条件の誤設定による他店舗データアクセス、既存ジョブ更新系への影響
- 完了条件: `medical_record_ai_tag_jobs` に store scope の select/insert/update/delete policy が定義され、解析受付時のRLSエラーが解消されている
- 進捗:
  - [x] 原因調査（RLS policy未定義を確認）
  - [x] DB修正SQL追加
  - [x] Supabase SQL Editor 反映（ユーザー実行でエラー表示なし）
  - [x] 動作確認（ユーザー報告: RLSエラー表示なし）
  - [x] PR作成（`merge: fix/medical-record-ai-tag-jobs-rls into main` で main 反映済み）

## 顧客LTV分析
- Task ID: `TASK-414`
- ブランチ: `feature/customer-ltv`
- ステータス: `done`
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
  - [x] PR作成（`feature/customer-ltv` は `main` 反映済みのため差分なし）

## Archive（調査メモ・過去の運用記録）

## Issues
- `main` から4本の専用ブランチを作成済み。実装は依存順の都合で `feature/prepayment` から着手している
- 予約事前決済向けに `POST /api/appointments/[appointment_id]/reservation-payment/checkout` と webhook 反映（Stripe/KOMOJU）を追加済み。運用前に各環境の決済キーと webhook 設定確認が必要
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
- ステータス: `blocked`
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
  - [x] Step 18: ユーザー指示により保留化（2026-04-06）

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
- Task ID: `TASK-POS-001`
- ブランチ: `feat/TASK-POS-001-pos-requirements`
- ステータス: `done`
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
  - [x] レビュー反映と確定版化（2026-04-06）

#### TASK-POS-002 データモデル・API契約設計
- Task ID: `TASK-POS-002`
- ブランチ: `feat/TASK-POS-002-pos-data-contract`
- ステータス: `done`
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
  - [x] レビュー反映と確定版化（2026-04-06）

#### TASK-POS-003 POS会計画面（MVP）実装
- Task ID: `TASK-POS-003`
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
- Task ID: `TASK-POS-004`
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
- Task ID: `TASK-POS-005`
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
- Task ID: `TASK-POS-006`
- ブランチ: `feat/TASK-POS-006-pos-uat-rollout`
- ステータス: `in_progress`
- 目的: パイロット導入に必要な検証・運用資料を完了する
- スコープ:
  - 店舗UAT（通常会計/返品/締め）
  - データ移行/初期設定手順
  - 障害時ロールバック手順
  - マニュアル更新
- DoD:
  - （開発段階DoD）UATチェックリスト完了
  - （開発段階DoD）`docs/` の運用手順が最新化
  - （開発段階DoD）PlaywrightによるPOS主要回帰（payments / inventory / hotel）が通過
  - （本番移行ゲート）実店舗パイロット（2営業日）実測と最終サインオフ
- テスト観点:
  - 回帰テスト（既存会計/在庫/予約への影響）※開発段階は Playwright を主
  - 負荷・運用手順リハーサル（本番移行前ゲート）
- 進捗:
  - [x] UATチェックリストを追加（`docs/pos-uat-checklist.md`）
  - [x] 移行/初期設定手順を追加（`docs/pos-migration-initial-setup.md`）
  - [x] pilot→full展開Runbookを追加（`docs/pos-pilot-rollout-runbook.md`）
  - [x] pilot→full承認記録テンプレを追加（`docs/pos-pilot-approval-record.md`）
  - [x] 店舗向けPOS操作マニュアルを追加（`docs/pos-operations-user-manual.md`）
  - [x] 開発環境リハーサルUAT実測を反映（`docs/pos-uat-checklist.md`, 判定: `conditional`）
  - [x] pilot→full承認記録を反映（`docs/pos-pilot-approval-record.md`, 判定: `hold`）
  - [x] payments E2Eの前提調整と再実行（`e2e/payments-list.spec.ts` 3件pass）
  - [x] POS関連Playwright再検証（2026-04-05: `e2e/payments-list.spec.ts` / `e2e/inventory-pages.spec.ts` / `e2e/hotel-page.spec.ts` 合計14件pass）
  - [ ] 実店舗パイロット（2営業日）実測と最終サインオフ（開発段階のため defer。リリース判定フェーズで実施）

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

---

## Archive

### [MEMO-QA-LONGTERM] 中長期の品質事故を減らすための不足項目メモ（別チャット用）

- 目的:
  - 機能実装とは分離して、品質保証の仕組みを中長期で強化する
  - 「テストが通る」だけでなく、仕様漏れ/観点漏れを未然に防ぐ運用へ移行する

- 前提:
  - 直近の機能観点の未対応は `followups` 系（P79/81/82/83）を優先して進行
  - このメモは、品質基盤強化を別タスクとして完遂するための引き継ぎ用

- 別チャットで最初に依頼する内容（そのまま使える文面）:
  - `MEMO-QA-LONGTERM に沿って、品質基盤強化タスクを漏れなく起票し、TASKS.mdへ反映して、優先度順に実行計画を作成してください。`

- 強化対象（漏れ防止チェックリスト）:
  - 仕様トレーサビリティの定期棚卸（未紐付け仕様の検出）
  - 境界値/時差/日付跨ぎの共通テストテンプレート化
  - fixture依存テストの実データ近似化方針
  - API契約テスト（正常/異常/権限）未整備領域の補完
  - E2Eの役割分担（スモーク/業務シナリオ/回帰）と重複整理
  - CI必須チェックの過不足見直し（required checks整合）
  - PRテンプレとTRACE更新運用の監査フロー化
  - テスト失敗時の原因分類（実装不具合/テスト不備/環境不安定）記録運用
  - flakyテストの検知と恒久対策ルール
  - 変更影響範囲に応じた最小必須テスト実行マトリクス整備

- 完了条件（品質基盤タスク群のDoD）:
  - 上記チェックリストが `TASKS.md` に個別タスクとして起票済み
  - 各タスクに「対象仕様」「検証方法」「完了条件」が定義済み
  - CI/PR運用に組み込まれ、担当者依存で抜け漏れが起きない状態
