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

## AIタグ活用導線の改善
- ブランチ: `feat/medical-record-ai-tag-usage`
- 概要: カルテ一覧でAIタグをチップ表示し、タグや解析状態で絞り込めるようにして、詳細を開かなくても要確認カルテを見つけやすくする
- 影響範囲: UI / 一覧導線 / テスト
- リスク: 一覧の情報量増加、モバイル表示の圧迫、タグ絞り込み条件の分かりにくさ
- 完了条件: 一覧のタグ可視化、タグフィルタ、解析状態フィルタ、関連テスト追加が完了している
- 進捗:
  - [x] 既存カルテ一覧UIの調査反映
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
  - [ ] 動画サムネイル生成ジョブとの接続
  - [ ] 混在一覧のE2Eテスト追加

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
