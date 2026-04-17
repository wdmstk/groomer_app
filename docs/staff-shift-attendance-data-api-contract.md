# Staff Shift & Attendance Data/API Contract

Task ID: `TASK-450`  
Status: `implemented v1 + v1.1 + v1.2 + v1.3 + v1.4(design)`（2026-04-18）

Implementation Note:
- `v1.2` はデータモデル/API/UIとも実装済み。
- `v1.3` は実装済み（`attendance_punch_enabled`・`attendance_location_required`・店舗基準座標/半径・距離判定・監査項目保存）。
- `v1.4` は設計フェーズ完了（プロ向けシフト最適化・定期自動運転の詳細契約を追加）。

## 1. Goal
- `docs/staff-shift-attendance-requirements.md` で定義した要件を実装可能な粒度へ落とし込み、データモデル/API/UI/バリデーション契約を固定する。
- 指名予約連動と自動シフト生成（Phase 1）を先行実装し、Phase 2最適化へ拡張できる構成にする。

## 2. Core Data Model

### 2.1 `store_shift_settings`
- 用途: 店舗単位のシフト生成・勤怠判定の基本設定
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid, unique)
  - `timezone` (text, default `Asia/Tokyo`)
  - `default_open_time` (time, nullable)
  - `default_close_time` (time, nullable)
  - `late_grace_minutes` (integer, default 10)
  - `early_leave_grace_minutes` (integer, default 10)
  - `auto_shift_enabled` (boolean, default false)
  - `auto_shift_horizon_days` (integer, default 14)
  - `policy_priority` (`nomination_first|cost_first|fairness_first`)
  - `attendance_location_required` (boolean, default false) ※v1.3
  - `attendance_location_lat` (numeric, nullable) ※v1.3
  - `attendance_location_lng` (numeric, nullable) ※v1.3
  - `attendance_location_radius_meters` (integer, default 200) ※v1.3
  - `attendance_punch_enabled` (boolean, default true) ※v1.3

### 2.2 `store_closed_rules`
- 用途: 定休日・休業日の定義
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `rule_type` (`weekday|date`)
  - `weekday` (smallint, nullable, 0-6)
  - `closed_date` (date, nullable)
  - `note` (text, nullable)
  - `is_active` (boolean, default true)

### 2.3 `staff_work_rules`
- 用途: スタッフごとの勤務制約
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid, unique per store)
  - `employment_type` (`full_time|part_time|arubaito`)
  - `weekly_max_minutes` (integer, nullable)
  - `max_consecutive_days` (integer, nullable)
  - `can_be_nominated` (boolean, default true)
  - `preferred_shift_minutes` (integer, nullable)
  - `is_active` (boolean, default true)

### 2.4 `staff_work_rule_slots`
- 用途: 勤務可能曜日・時間帯
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_work_rule_id` (uuid)
  - `weekday` (smallint, 0-6)
  - `start_time` (time)
  - `end_time` (time)

### 2.5 `staff_shift_plans`
- 用途: 予定シフト（公開前後含む）
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `shift_date` (date)
  - `start_at` (timestamptz)
  - `end_at` (timestamptz)
  - `planned_break_minutes` (integer, default 0)
  - `status` (`draft|published`)
  - `source_type` (`manual|auto|nomination_sync`)
  - `source_appointment_id` (uuid, nullable)
  - `note` (text, nullable)

### 2.6 `shift_alerts`
- 用途: 予約連動差分・不足警告
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `alert_date` (date)
  - `alert_type` (`nomination_uncovered|conflict|policy_violation`)
  - `severity` (`info|warn|critical`)
  - `staff_id` (uuid, nullable)
  - `appointment_id` (uuid, nullable)
  - `message` (text)
  - `resolved_at` (timestamptz, nullable)

### 2.10 `staff_day_off_requests`（v1.1）
- 用途: スタッフごとの希望休（日単位）
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `day_off_date` (date)
  - `status` (`pending|approved|rejected`)
  - `note` (text, nullable)

### 2.11 `shift_auto_generate_runs`（v1.1）
- 用途: 自動生成実行履歴（run単位）
- 主な列:
  - `id` (uuid; `run_id`)
  - `store_id` (uuid)
  - `requested_by_user_id` (uuid, nullable)
  - `from_date` (date)
  - `to_date` (date)
  - `mode` (`preview|apply_draft`)
  - `settings_snapshot` (jsonb)
  - `summary` (jsonb)

### 2.12 `shift_auto_generate_run_items`（v1.1）
- 用途: 実行差分履歴（created/updated/deleted/skipped_manual/policy_violation）
- 主な列:
  - `id` (uuid)
  - `run_id` (uuid)
  - `store_id` (uuid)
  - `shift_date` (date, nullable)
  - `staff_id` (uuid, nullable)
  - `shift_plan_id` (uuid, nullable)
  - `action_type` (`created|updated|deleted|skipped_manual|policy_violation`)
  - `message` (text)
  - `before_payload` (jsonb)
  - `after_payload` (jsonb)

### 2.7 `attendance_events`
- 用途: 打刻イベント原本
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `business_date` (date)
  - `event_type` (`clock_in|clock_out|break_start|break_end`)
  - `occurred_at` (timestamptz)
  - `source_type` (`self|admin_adjust|approved_request`)
  - `shift_plan_id` (uuid, nullable)
  - `location_lat` (numeric, nullable) ※v1.3
  - `location_lng` (numeric, nullable) ※v1.3
  - `location_accuracy_meters` (numeric, nullable) ※v1.3
  - `location_captured_at` (timestamptz, nullable) ※v1.3
  - `location_is_within_radius` (boolean, nullable) ※v1.3

### 2.8 `attendance_daily_summaries`
- 用途: 1勤務日の集約結果
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `business_date` (date)
  - `clock_in_at` (timestamptz, nullable)
  - `clock_out_at` (timestamptz, nullable)
  - `break_minutes` (integer, default 0)
  - `worked_minutes` (integer, default 0)
  - `status` (`complete|incomplete|needs_review`)
  - `flags` (jsonb; `late`,`early_leave`,`missing_clock`)

### 2.9 `attendance_adjustment_requests`
- 用途: 打刻修正申請
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `business_date` (date)
  - `requested_payload` (jsonb)
  - `reason` (text)
  - `status` (`pending|approved|rejected`)
  - `reviewed_by_user_id` (uuid, nullable)
  - `reviewed_at` (timestamptz, nullable)

## 3. Existing Table Integration
- `staffs`: `staff_work_rules.staff_id` / `staff_shift_plans.staff_id` / `attendance_*` のFK先。
- `appointments`: `staff_id` が存在する予約を連動対象とする。`staff_shift_plans.source_appointment_id` で接続。
- `store_memberships`: API認可（`owner/admin/staff`）判定に使用。

## 4. Shift Synchronization & Auto Generation

### 4.1 指名予約同期（必須）
- `appointments.staff_id` が null でない未来予約を抽出し、対象日・対象スタッフのシフト有無を判定する。
- 未カバー時は `shift_alerts(alert_type=nomination_uncovered)` を作成し、`source_type=nomination_sync` の候補シフトを提案する。
- 予約変更/取消時は差分再計算を実行し、不要になった警告を解消する。

### 4.2 自動生成 Phase 1（必須）
- 固定制約:
  - 定休日（`store_closed_rules`）
  - スタッフ勤務可能枠（`staff_work_rule_slots`）
  - 指名予約カバー（最優先）
- 目的:
  - 指名予約未カバーゼロ
  - 制約違反ゼロ
  - 不足枠最小化
- 出力:
  - `staff_shift_plans` に `source_type=auto` の下書きを生成
  - 管理者がプレビュー後に公開
  - `manual` は保護し、`auto/nomination_sync` のみ再生成更新対象
  - 実行ごとに `run_id` と差分履歴を保存

### 4.4 v1.1制約
- 生成期間は `1-90日`（最大3か月）で、`store_shift_settings.auto_shift_horizon_days` を上限とする。
- 指名予約対象は `appointments.status in ('confirmed','pending')`。
- 定休日と指名予約の衝突時は自動営業化せず `shift_alerts` に警告を残す。
- 1日1スタッフ1シフト。
- 雇用区分/週上限/連勤上限違反は未配置 + 警告として継続実行（全体失敗にしない）。

### 4.3 自動生成 Phase 2（拡張）
- 公平性（勤務偏り）、残業抑制、希望休尊重をスコア化し最適案を提示。
- 既存Phase 1制約を維持したまま、目的関数のみ拡張する。


## 5. API Contract (v1)

### 5.0 共通
- 成功: `{ "ok": true, "data": ... }`
- 失敗: `{ "ok": false, "code": "...", "message": "..." }`
- ステータス:
  - `200` 正常
  - `201` 作成
  - `400` 入力不正
  - `401` 未認証
  - `403` 権限不足/店舗外
  - `404` 対象なし
  - `409` 状態競合
  - `422` ドメイン制約違反

### 5.1 Shift Settings
- `GET /api/staff-shifts/settings`
- `PUT /api/staff-shifts/settings`
- `PUT /api/staff-shifts/settings/closed-rules`
- `PUT /api/staff-shifts/settings/staff-rules/:staff_id`
- 権限: `owner/admin`

### 5.2 Shift Plans
- `GET /api/staff-shifts?from=YYYY-MM-DD&to=YYYY-MM-DD&staff_id=...`
- `POST /api/staff-shifts`（手動作成）
- `PATCH /api/staff-shifts/:shift_id`（更新）
- `POST /api/staff-shifts/:shift_id/publish`
- `DELETE /api/staff-shifts/:shift_id`
- 権限: 閲覧は全ロール（本人範囲）、更新は`owner/admin`

### 5.3 Reservation Sync & Auto Generate
- `POST /api/staff-shifts/sync-nominations`
  - 目的: 指名予約との差分再計算
- `GET /api/staff-shifts/alerts?date=YYYY-MM-DD`
  - 目的: 未カバー・競合警告の取得
- `POST /api/staff-shifts/auto-generate`
  - Request:
    - `from_date`
    - `to_date`
    - `mode` (`preview|apply_draft`)
  - Response `data` 追加項目:
    - `run_id`
    - `created`
    - `updated`
    - `deleted`
    - `skipped_manual`
    - `policy_violations`
  - 権限: `owner/admin`

### 5.4 Attendance
- `POST /api/attendance/events`
  - `event_type`: `clock_in|clock_out|break_start|break_end`
- `GET /api/attendance/daily?date=YYYY-MM-DD&staff_id=...`
- `GET /api/attendance/me?from=...&to=...`
- `POST /api/attendance/adjustment-requests`
- `POST /api/attendance/adjustment-requests/:request_id/review`
  - `decision`: `approve|reject`


## 6. UI Transition Contract

### 6.1 `/staffs?tab=shift`
- カレンダー（週/日）
- 不足警告パネル（`shift_alerts`）
- 操作:
  - 手動追加
  - 指名同期
  - 自動生成（プレビュー）
  - 公開
- 補足（次フェーズ候補）:
  - 月ビューは「俯瞰確認専用」として追加し、編集操作は週/日ビューで行う方針とする。
  - 月ビューで確認する主対象は「不足警告件数」「指名予約カバー率」「公開状態」。

### 6.2 `/staffs?tab=attendance-punch`（v1.2まで）
- 本人勤務打刻カード（`staff`）
- 管理者向け勤務打刻対象切替（`owner/admin`）
- 出勤/退勤/休憩開始/休憩終了の勤務打刻操作
 - v1.3でサイドバー独立カテゴリへ移行（廃止予定）

### 6.3 `/staffs?tab=attendance-records`
- 月次勤務実績テーブル（全日表示）
- 修正申請フォーム
- 修正申請キュー（`owner/admin`）

### 6.4 `/staffs?tab=shift-settings`
- 店舗設定（定休日、営業時間、閾値）
- スタッフ条件（雇用区分、勤務可能枠、上限）
- 生成ポリシー設定

### 6.5 次フェーズUI案（タイムライン洗練）
- 目的:
  - 「時間軸UIを採用しているのに一覧性が弱い」状態を解消し、閲覧と操作を同一文脈に統合する。
  - 指名予約カバー状況とシフト不足を、管理者が最短操作で修正できるようにする。

#### 案A: 日付グループ型ガント + インライン操作（推奨）
- 構造:
  - 横: 時間軸（30分または60分グリッド）
  - 縦: 日付グループの中にスタッフ行を並べる
  - 行右端に `公開/削除/複製` を配置し、バークリックで編集ドロワーを開く
- 長所:
  - 現在の `/staffs?tab=shift` からの移行コストが低い
  - 日別オペレーションと時間重なり確認を両立できる
- 弱点:
  - スタッフ数が非常に多い店舗では縦が長くなる

#### 案B: スタッフ固定レーン型（日付切替）
- 構造:
  - 上部で日付を切替、画面本体はスタッフ別レーン固定
  - 各スタッフ行にその日のバーを表示、空き時間を明示
- 長所:
  - 「誰の稼働が偏っているか」が把握しやすい
  - 個人別の調整（公平性対応）に強い
- 弱点:
  - 日を跨いだ比較がしづらい

#### 案C: 需要ヒートマップ重畳ガント
- 構造:
  - 背景に予約密度ヒートマップ（濃淡）
  - 前景にシフトバー、未カバー帯を赤ハッチ表示
- 長所:
  - 人員不足/過剰が即時に視認できる
  - 自動生成の妥当性説明に使いやすい
- 弱点:
  - 配色設計を誤ると可読性が落ちる

#### 案D: 折りたたみ日別サマリー + 詳細タイムライン
- 構造:
  - 初期表示は日別サマリー（不足警告、公開率、総勤務時間）
  - 行展開時のみ詳細ガントを表示
- 長所:
  - 情報量を抑え、忙しい運用時に見やすい
  - モバイルでも扱いやすい
- 弱点:
  - 連続日比較は1クリック増える

#### 案E: ボード型（未配置/下書き/公開）+ 時間バー
- 構造:
  - カンバン列 `未配置` `下書き` `公開` を用意
  - カード内にミニ時間バーを表示
- 長所:
  - ステータス運用（公開漏れ防止）に強い
  - 作業進行管理と相性が良い
- 弱点:
  - 時間重なりの厳密確認は主目的にならない

#### v2推奨採用方針（2026-04-14提案）
- 採用候補: 案Aをベースに案Cの不足可視化を段階追加。
- 実装順:
  1. 案A（ガント + インライン操作）
  2. 未カバー帯ハッチ表示（案Cの一部）
  3. 需要ヒートマップ（ON/OFFトグル）
- 理由:
  - 現行実装資産を活かしつつ、視認性と操作性の改善効果が最も大きいため。

## 7. Validation Rules
- 共通:
  - `start_at < end_at` 必須
  - 他店舗ID参照禁止
- シフト:
  - 定休日へのシフト作成は禁止（管理者上書きフラグは将来拡張）
  - 同一スタッフの重複時間帯は禁止
  - `published` 後の直接編集は差分履歴を必須化（v1では再下書き経由）
- 打刻:
  - `clock_in` 前の `clock_out` を禁止
  - `break_start` 連続入力を禁止（`break_end` 必須）
  - 同時刻重複イベントを冪等キーで抑止
- 修正申請:
  - `pending` がある同日同スタッフの重複申請を禁止
  - 承認時のみ `attendance_events` へ反映

## 8. Implementation Phasing (TASK-450)
1. `Step 2`（本ドキュメント）: 契約確定
2. `Step 3`: シフト管理（設定UI + シフトCRUD + 指名同期 + 警告）
3. `Step 4`: 勤務管理（打刻 + サマリー + 修正申請）
4. `Step 5`: テスト（Vitest/E2E）
5. `Step 6`: 運用ドキュメント

## 9. 実装差分メモ（2026-04-14）
- 現行APIは一部 `PUT/PATCH` ではなく `POST` を採用（フォーム送信互換を優先）。
- `attendance/events` は不正順序を即時拒否ではなく、日次サマリーで `needs_review` 判定する設計。
- `attendance/adjustment-requests` の重複 `pending` 抑止は現時点では運用ルールで対応（DB制約は次フェーズ検討）。
- 運用フローは `docs/staff-shift-attendance-operations-manual.md` を正とする。

## 10. 勤務管理拡張契約（v1.2提案）

### 10.1 追加データモデル

#### 10.1.1 `attendance_leave_requests`（新規）
- 用途: 有休/半休/欠勤/特休などの休暇申請ワークフロー
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `target_date` (date)
  - `request_type` (`paid_leave|half_leave_am|half_leave_pm|special_leave|absence`)
  - `reason` (text)
  - `requested_payload` (jsonb)
  - `status` (`pending|approved|rejected|returned`)
  - `reviewed_by_user_id` (uuid, nullable)
  - `reviewed_at` (timestamptz, nullable)

#### 10.1.2 `staff_leave_balances`（新規）
- 用途: 有休残数管理（付与・取得・失効・繰越）
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid)
  - `leave_type` (`paid_leave`)
  - `granted_days` (numeric(5,2))
  - `used_days` (numeric(5,2))
  - `carry_over_days` (numeric(5,2))
  - `expired_days` (numeric(5,2))
  - `remaining_days` (numeric(5,2))
  - `effective_from` (date)
  - `effective_to` (date)

#### 10.1.3 `attendance_monthly_closings`（新規）
- 用途: 月次確定（締め）状態管理
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `target_month` (text, `YYYY-MM`)
  - `status` (`open|closed`)
  - `closed_by_user_id` (uuid, nullable)
  - `closed_at` (timestamptz, nullable)
  - `reopened_by_user_id` (uuid, nullable)
  - `reopened_at` (timestamptz, nullable)

#### 10.1.4 `attendance_alerts`（新規）
- 用途: 勤務実績系アラート（未承認滞留、打刻漏れ、残業超過等）
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `staff_id` (uuid, nullable)
  - `business_date` (date, nullable)
  - `alert_type` (`missing_punch|approval_stale|overtime_limit|consecutive_limit|absence_unresolved`)
  - `severity` (`info|warn|critical`)
  - `message` (text)
  - `resolved_at` (timestamptz, nullable)

### 10.2 既存モデル拡張
- `attendance_daily_summaries.flags` を拡張し、`absence`, `holiday_work`, `paid_leave`, `half_leave_am`, `half_leave_pm` を保持可能にする。
- `attendance_daily_summaries.status` は既存 `complete|incomplete|needs_review` を維持しつつ、休暇種別は `flags` 側で表現する。

### 10.3 API契約（v1.2追加）
- `GET /api/attendance/monthly?month=YYYY-MM&staff_id=...`
  - 月次の全日行 + サマリー（遅刻回数/早退回数/欠勤/有休/残業分）
- `POST /api/attendance/leave-requests`
  - 休暇申請作成
- `POST /api/attendance/leave-requests/:request_id/review`
  - `decision`: `approve|reject|return`
- `GET /api/attendance/leave-balances?staff_id=...`
  - 有休残数取得
- `POST /api/attendance/monthly-closing`
  - 月次確定（`owner/admin`）
- `POST /api/attendance/monthly-closing/reopen`
  - 確定解除（`owner` のみ）
- `GET /api/attendance/alerts?from=YYYY-MM-DD&to=YYYY-MM-DD&staff_id=...`
  - 勤務アラート一覧取得
- `GET /api/attendance/export.csv?month=YYYY-MM&staff_id=...`
  - 給与連携向けCSV

#### 10.3.1 月次確定ロック時のAPI挙動
- 対象月が `attendance_monthly_closings.status=closed` の場合、以下APIは `409` を返し更新系操作を拒否する。
  - `POST /api/attendance/events`
  - `POST /api/attendance/adjustment-requests`
  - `POST /api/attendance/adjustment-requests/:request_id/review`
  - `POST /api/attendance/leave-requests`
  - `POST /api/attendance/leave-requests/:request_id/review`
- 想定エラーメッセージ:
  - `対象月は勤怠確定済みのため、...できません。`
- 例外:
  - `POST /api/attendance/monthly-closing/reopen` は `owner` のみ許可され、確定解除後に更新系APIを再実行できる。

### 10.4 権限契約（v1.2）
- `owner`: すべての勤務管理操作（申請承認、月次確定、再オープン、残数調整）
- `admin`: 申請承認、月次確定、実績閲覧（再オープン不可）
- `staff`: 自身の打刻、修正申請、休暇申請、自身の実績閲覧

### 10.5 バリデーション契約（v1.2）
- 休暇申請:
  - 同一スタッフ・同一日で `pending` 申請の多重作成を禁止
  - `paid_leave` 申請時に残数不足なら `422`
- 月次確定:
  - `closed` 月への通常更新を禁止（申請承認経由のみ許可）
  - 再オープンは `owner` のみ許可
- 日次判定:
  - 遅刻/早退判定は店舗猶予設定を必須適用
  - 欠勤判定と休暇承認が衝突する場合は休暇承認を優先

### 10.6 UI契約（v1.2）
- `attendance-records` は月単位を標準とし、対象月の全日を表示する。
- 列構成:
  - `日付/曜日/出勤/退勤/休憩開始/休憩終了/休憩分/勤務分/状態/申請状態`
- 月次サマリーカード:
  - `出勤日数/遅刻/早退/欠勤/有休/残業分`
- 月次確定ロック表示:
  - 月次状態に `確定済み/未確定` を表示する。
  - `確定済み` のときは「この月は閲覧のみ」の案内を表示する。
  - `確定済み` のとき、打刻/申請/承認系ボタンは非活性にする。

## 11. 勤務打刻独立・位置情報契約（v1.3合意）

### 11.1 UI遷移契約
- サイドバーに `勤怠打刻` を追加する（`owner/admin/staff` 全員表示）。
- 画面1: `/attendance-punch`（スタッフ選択）
  - `staff`: 自分のみ表示
  - `owner/admin`: 全スタッフ表示
- 画面2: `/attendance-punch/[staff_id]`（打刻実行）
  - `出勤打刻/退勤打刻/休憩開始/休憩終了` ボタンを表示
- 表示制御:
  - `attendance_punch_enabled=true` の場合のみ `勤怠打刻` と `勤務実績` メニューを表示する。
  - `attendance_punch_enabled=false` の場合は両メニューを非表示にする。

### 11.2 API契約（拡張）
- 既存 `POST /api/attendance/events` を拡張して利用する。
- Request 追加項目（任意）:
  - `location_lat`
  - `location_lng`
  - `location_accuracy_meters`
  - `location_captured_at`
- サーバ側で `location_is_within_radius` を算出して保存する。

### 11.3 バリデーション契約（位置情報）
- `store_shift_settings.attendance_location_required=true` の場合:
  - 位置情報未取得は `422` で拒否
  - 店舗座標/半径未設定は `422` で拒否
  - 店舗半径外は `403` で拒否
- 同判定は `clock_in|clock_out|break_start|break_end` 全イベントに適用する。
- 連打防止として同一スタッフ・同一イベント種別の短時間重複（5秒以内）を拒否する。

### 11.3.1 バリデーション契約（機能有効フラグ）
- `attendance_punch_enabled=false` の場合:
  - 打刻系APIは `403` を返す。
  - 勤務実績取得API、申請系API、レビュー系APIは `403` を返す。
- UIで非表示でも、API側で必ずガードする。

### 11.4 権限契約（v1.3補足）
- `staff`: 自身の `staff_id` のみ打刻可能。
- `owner/admin`: 任意 `staff_id` を指定した代理打刻が可能。
- 代理打刻時も位置情報必須判定は同一ルールで適用する。

### 11.5 監査表示契約
- 位置情報詳細（`lat/lng/accuracy/captured_at/is_within_radius`）は `owner/admin` のみ表示。
- 勤務実績一覧では行の詳細表示で確認し、標準列には追加しない。
- 位置情報保持期間は無期限。

## 12. プラン境界契約（合意）

### 12.1 プラン別機能フラグ
- `attendance_enabled`:
  - ライト/スタンダード/プロで有効
- `shift_management_enabled`:
  - スタンダード/プロで有効（ライトは無効）
- `rule_based_auto_generate_enabled`:
  - スタンダード/プロで有効（手動実行）
- `shift_optimization_enabled`:
  - プロのみ有効
- `scheduled_auto_run_enabled`:
  - プロのみ有効

### 12.2 UI契約（プラン連動）
- ライト:
  - 勤怠打刻・勤務実績のみ表示
  - シフト管理UIは非表示
- スタンダード:
  - シフト管理UIを表示
  - `最適化ON` チェックボックスは表示するが disabled
  - disabled理由として「プロで利用可能」を表示
- プロ:
  - `最適化ON/OFF` チェックボックスを有効化
  - 定期自動運転設定UIを表示

### 12.3 API契約（プランガード）
- スタンダード未満でシフトAPIへ更新要求した場合は `403` を返す。
- プロ未満で `optimized` 実行や定期自動運転設定要求を受けた場合は `403` を返す。
- UIで無効化していても、API側のプランガードを必須とする。

## 13. プロ向けシフト最適化 詳細設計（v1.4 / Step 7-B-2）

### 13.1 スコープ
- 本章は「シフト最適化（プロ機能）」のみを対象とする。
- 予約候補最適化（予約作成時の推薦ロジック）は本タスクの対象外とする。

### 13.2 データ設計

#### 13.2.1 `store_shift_settings` 拡張
- 追加列:
  - `shift_optimization_enabled` (boolean, default false)
  - `scheduled_auto_run_enabled` (boolean, default false) ※既存定義を正式利用
- 意味:
  - `shift_optimization_enabled=true` のとき、`optimized` 戦略を実行可能にする。
  - `scheduled_auto_run_enabled=true` のとき、定期自動運転ジョブを有効化する。

#### 13.2.2 `shift_optimization_profiles`（新規）
- 用途: 店舗単位の最適化重み設定
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid, unique)
  - `fairness_weight` (numeric(5,4), default `0.35`)
  - `preferred_shift_weight` (numeric(5,4), default `0.25`)
  - `reservation_coverage_weight` (numeric(5,4), default `0.30`)
  - `workload_health_weight` (numeric(5,4), default `0.10`)
  - `updated_by_user_id` (uuid, nullable)
- 制約:
  - 各重み `0.0 <= weight <= 1.0`
  - 合計 `1.0`（許容誤差 `±0.0001`）

#### 13.2.3 `shift_scheduled_jobs`（新規）
- 用途: 定期自動運転のジョブ定義
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `is_active` (boolean, default true)
  - `frequency` (`daily|weekly`)
  - `run_at_local_time` (time)
  - `run_weekday` (smallint, nullable, 0-6)
  - `target_horizon_days` (integer, 1-90)
  - `mode` (`apply_draft`)
  - `created_by_user_id` (uuid)
  - `updated_by_user_id` (uuid, nullable)

#### 13.2.4 `shift_scheduled_job_runs`（新規）
- 用途: 定期自動運転の実行履歴
- 主な列:
  - `id` (uuid)
  - `store_id` (uuid)
  - `job_id` (uuid)
  - `status` (`success|failed|skipped`)
  - `started_at` (timestamptz)
  - `finished_at` (timestamptz, nullable)
  - `run_id` (uuid, nullable) ※ `shift_auto_generate_runs.id`
  - `error_summary` (text, nullable)

#### 13.2.5 `shift_auto_generate_runs` 拡張
- `settings_snapshot` に以下を格納する:
  - `strategy` (`rule_based|optimized`)
  - `weights`
- `summary` に以下を追加する:
  - `total_score` (`0-100`)
  - `score_breakdown` (`fairness/preferred_shift/reservation_coverage/workload_health`)
  - `alternatives_count`

#### 13.2.6 `shift_auto_generate_run_items` 拡張
- `after_payload` に以下を任意格納する:
  - `reason_codes`（主な判断理由コード配列）
  - `impact_level`（`low|medium|high`）

### 13.3 API設計

#### 13.3.1 最適化設定API
- `GET /api/staff-shifts/settings/optimization`
  - 戻り値: `enabled`, `weights`, `scheduled_auto_run_enabled`
- `PUT /api/staff-shifts/settings/optimization`
  - 入力: `shift_optimization_enabled`, 各重み
  - バリデーション: 重み合計1.0、各値範囲

#### 13.3.2 生成実行API拡張
- `POST /api/staff-shifts/auto-generate`
  - 追加入力:
    - `strategy` (`rule_based|optimized`)
  - 追加出力:
    - `total_score`
    - `score_breakdown`
    - `top_reasons`
    - `alternatives`

#### 13.3.3 定期自動運転API
- `GET /api/staff-shifts/scheduled-jobs`
- `POST /api/staff-shifts/scheduled-jobs`
- `PATCH /api/staff-shifts/scheduled-jobs/:job_id`
- `DELETE /api/staff-shifts/scheduled-jobs/:job_id`
- `GET /api/staff-shifts/scheduled-jobs/runs?from=...&to=...`

### 13.4 スコア計算契約（シフト最適化）
- 合成式:
  - `total_score = fairness*W1 + preferred_shift*W2 + reservation_coverage*W3 + workload_health*W4`
- 各要素スコアは `0-100` に正規化して保存・表示する。
- `strategy=rule_based` のときは `total_score` を返さない（または `null`）。
- `strategy=optimized` のときのみ `score_breakdown` を必須とする。

### 13.5 代替案契約
- 返却形式:
  - `alternatives[]`（最大3件）
  - 各要素:
    - `type` (`add_staff_candidate|time_window_adjust`)
    - `summary`
    - `impact`（連勤・週上限・予約カバーへの影響）
    - `expected_score_delta`

### 13.6 権限・バリデーション契約
- 権限:
  - 閲覧: `owner/admin`
  - 更新/実行: `owner/admin`
- プランガード:
  - `pro` 未満で `strategy=optimized` は `403`
  - `pro` 未満で定期自動運転APIは `403`
- 入力バリデーション:
  - `target_horizon_days` は `1-90`
  - `weekly` の場合 `run_weekday` 必須
  - `daily` の場合 `run_weekday` は `null`

### 13.7 UI契約（詳細）
- `/staffs?tab=shift-settings`
  - プロのみ `最適化ON/OFF` + 重み設定 + 定期自動運転設定を有効表示
  - スタンダードは表示のみ（編集不可）
- `/staffs?tab=shift`
  - 最適化実行時に `総合スコア/内訳/主理由/代替案` を結果パネル表示
- `/staffs?tab=shift-history`
  - 実行履歴に `strategy` と `total_score` を表示

### 13.8 テスト設計
- Unit:
  - 重み合計バリデーション
  - スコア正規化（0-100）
- API:
  - `pro` 以外の `optimized` 実行拒否（403）
  - 定期自動運転ジョブ作成・更新・無効化
  - 実行結果へ `score_breakdown/alternatives` 保存
- E2E:
  - プロで重み変更 → 最適化実行 → 結果表示
  - スタンダードで最適化実行不可（UI非活性 + API拒否）
