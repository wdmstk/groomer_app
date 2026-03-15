# 差別化機能ロードマップ

最終更新: 2026-03-14

対象機能:

1. 写真カルテの圧倒的な使いやすさ
2. 多頭予約のストレスゼロUI
3. LINE公式アカウントとの深い自動連携

この文書は、別チャットや別エージェントに作業を引き継ぐための継続用ハンドオフです。

---

## 1. 結論

3機能とも実装価値は高い。ただし難易度は大きく異なる。

- 写真カルテ: 既存土台が厚く、短期で差別化体験まで持っていきやすい
- LINE深連携: 送信基盤はある。Webhookと顧客紐付けを足すと強い
- 多頭予約: UIだけでは不十分で、予約データモデルの見直しが必要

推奨実装順:

1. 写真カルテUX改善
2. LINE写真送付自動化
3. LINE Webhook連携
4. 多頭予約の軽量UI改善
5. 多頭予約のデータモデル拡張

---

## 2. 現在のシステム状況

### 2.1 写真カルテ

既存実装:

- 写真アップロードAPIあり
  - `groomer_app/src/app/api/upload/route.ts`
- 写真カルテ作成・更新UIあり
  - `groomer_app/src/components/medical-records/MedicalRecordCreateModal.tsx`
- 前後写真分類あり
  - `before` / `after`
- 写真ごとのコメント保存あり
- 同一ペットの時系列ギャラリーあり
- 共有URL発行APIあり
  - `groomer_app/src/app/api/medical-records/[record_id]/share/route.ts`
- 共有ページあり
  - `groomer_app/src/app/shared/medical-records/[token]/page.tsx`
- 共有ボタンあり
  - `groomer_app/src/components/medical-records/MedicalRecordShareButton.tsx`

評価:

- 機能はかなり揃っている
- `feat/medical-record-fast-flow` で高速導線の初期実装は入った
- 予約/会計起点プリセット、前後撮影ボタン、保存後共有、LINE送信は実装済み
- 残りは運用磨き込みとテスト基盤整備

### 2.2 多頭予約

既存実装:

- 顧客とペットの親子関係あり
  - `pets.customer_id`
- 予約フォームで顧客選択後にペット候補を絞り込み
  - `groomer_app/src/components/appointments/AppointmentForm.tsx`
- 公開予約も顧客/ペット作成フローあり
  - `groomer_app/src/lib/public-reservations/services/create.ts`
  - `groomer_app/src/lib/public-reservations/services/create-core.ts`

制約:

- `appointments` は `pet_id` 単一前提
  - `groomer_app/src/lib/supabase/database.types.ts`
- 作成サービスも単一 `petId` 前提
  - `groomer_app/src/lib/appointments/services/create.ts`
- 公開予約も `petName` 単数前提

評価:

- 現状は「1顧客1回の予約で1頭」の設計
- 真の多頭一括予約を実現するには、親子予約グループの概念が必要

### 2.3 LINE深連携

既存実装:

- LINE送信クライアントあり
  - `groomer_app/src/lib/line.ts`
- リマインド送信ジョブあり
  - `groomer_app/src/lib/cron/services/appointment-reminders.ts`
- LINEテンプレートあり
  - `reminder_line`
  - `followup_line`
  - `slot_reoffer_line`
- 顧客に `line_id` カラムあり
- ホテル報告をLINE送信する仕組みあり
  - `groomer_app/src/app/api/hotel/stays/[stay_id]/report-line/route.ts`

不足:

- LINE Webhook受信口は `feat/line-webhook-linking` で追加着手済み
- 友だち追加イベントからの完全自動紐付けはまだない
- LINE上で予約導線を閉じる設計が弱い

評価:

- アウトバウンド通知はすでに強い
- 差別化の本丸は「送ること」より「自動でつながること」

---

## 3. 機能ごとの実装方針

### 3.1 写真カルテ

目標:

- 施術現場で最短操作
- 施術前/施術後の導線を明快化
- 保存直後に顧客共有までつなげる

フェーズ1でやること:

- 予約詳細 / 会計完了 / 当日オペレーション画面からカルテを起動した際に以下を自動セット
  - `pet_id`
  - `staff_id`
  - `record_date`
  - `appointment_id`
  - `payment_id`
- `写真追加` ではなく、以下の2ボタンに変更
  - `施術前を撮る`
  - `施術後を撮る`
- モバイル時は撮影導線優先にレイアウトを最適化
- 保存完了後に共有アクションをインライン表示
  - `LINE送信`
  - `URLコピー`

実装状況:

- 完了:
  - `/medical-records` の作成モーダルを `fetch` 保存に変更
  - 保存直後に `URLコピー` / `LINE送信` を表示
  - 写真追加を `施術前を撮る` / `施術後を撮る` の2導線に変更
  - モーダルをモバイル下部シート寄りのレイアウトに調整
  - 共有一覧側の `MedicalRecordShareButton` にも `LINE送信` を追加
- 追加実装:
  - `groomer_app/src/app/api/medical-records/[record_id]/share-line/route.ts`
  - `customer_notification_logs` への写真カルテ送信ログ保存
- 未解消:
  - 自動テストは既存 Node テスト基盤が `.ts` 読み込みに未対応で追加検証が止まる
  - `npx tsc --noEmit` はホテル機能の既存型エラーで全体完走しない

`feat/medical-record-line-share` で見直す点:

- 共有LINE文面を通知テンプレート基盤に載せる
- `medical_record_share_line` を店舗単位で編集可能にする
- 送信ロジックを「固定文面」から「テンプレート + 共有URL差し込み」に変更する

フェーズ2でやること:

- コメント入力を後回しにできる運用モード
- 連続撮影の高速化
- 共有URL送信履歴保存

原則:

- 新規DBは必須ではない
- まずは既存 `medical_records` / `medical_record_photos` / 共有URL機構を活用する

### 3.2 多頭予約

目標:

- 飼い主単位で予約を考えられる
- 複数頭の作成・確認・変更が一続きでできる

フェーズ1でやること:

- 既存の単一予約モデルのまま、連続作成UIを改善
- 1頭目予約後に、同一顧客の別ペットをワンクリック追加
- 前回内容コピーを「家族単位」で使いやすくする
- 公開予約にも「別のペットを追加」導線を作る

実装状況:

- `feat/multi-pet-booking-ui` で UI フェーズを先行実装
- 管理画面の予約作成後に、同一顧客のまま `別のペットを続けて予約` を表示
- 作成済み予約をその場で並べる `家族単位の作成確認` UI を追加
- 公開予約でも飼い主情報を維持したまま、次のペット入力へ進める成功導線を追加
- まだ単票予約の連続作成であり、グループIDなどのデータモデル拡張は未着手

フェーズ2でやること:

- 予約グループを導入
- 候補案:
  - `appointment_groups`
  - `appointments.group_id`
- 1回の家族予約に対して複数予約を束ねる

実装状況:

- `feat/multi-pet-booking-group-model` で `appointment_groups` と `appointments.group_id` を採用
- 既存予約は `group_id` nullable のまま残し、新規予約のみ後方互換を保ってグループ化
- 管理画面予約と公開予約の両方で、2頭目以降を同じ `group_id` へ追加
- 公開予約のキャンセル URL は同一 `group_id` をまとめてキャンセルする形式に更新
- 通知ジョブや reminder 文面はまだ単票前提が残るため、完全な group-aware 通知は未完了

フェーズ3でやること:

- グループ単位の確認画面
- グループ単位の通知
- グループ単位のキャンセル / 変更

原則:

- いきなり既存 `appointments` を壊さない
- まずは「複数単票を束ねて見せる」方式で後方互換を維持する

### 3.3 LINE深連携

目標:

- LINE友だち追加から顧客連携まで自動化
- 予約・リマインド・写真送付をLINE中心に流せるようにする

フェーズ1でやること:

- 写真カルテ共有URLを `line_id` 登録顧客へ即送信
- 顧客詳細 / 一覧に `LINE連携状態` を明示
- 通知ログに `写真送付` を追加

フェーズ2でやること:

- LINE Webhook受信API追加
- 友だち追加イベント / 連携メッセージ / トークン連携導線を追加
- `customers.line_id` の手入力依存を下げる

実装状況:

- 完了:
  - `groomer_app/src/app/api/webhooks/line/route.ts` を追加
  - `LINE_CHANNEL_SECRET` を使った署名検証を追加
  - `supabase/supabase_line_webhook_events.sql` でイベント保存テーブルを追加
  - 既存 `customers.line_id` と照合して `matched_customer_id` を保存する最小自動紐付けを追加
  - 顧客一覧で `LINE ID` 表示を `連携済み` / `未連携` の状態表示に変更
- 残り:
  - 友だち追加から顧客側で連携完了させる導線
  - 複数店舗・未紐付けユーザー向けの再連携導線

フェーズ3でやること:

- LINEから予約導線への遷移最適化
- 会員証 / 公開予約 / 写真送付を同一メッセージ設計で統一
- 将来的には LIFF の検討余地あり

---

## 4. 推奨ブランチ戦略

大きすぎるので、1本で進めず複数ブランチに分割する。

- `feat/medical-record-fast-flow`
- `feat/medical-record-line-share`
- `feat/line-webhook-linking`
- `feat/multi-pet-booking-ui`
- `feat/multi-pet-booking-group-model`

---

## 5. 実装順の詳細

### スプリントA

対象:

- 写真カルテ高速化
- LINE写真送付の最小導線

成果物:

- カルテ起動時プリセット
- 施術前/施術後ボタン化
- 保存後の共有導線
- `line_id` がある顧客への送信API

現状:

- 実装済み。次はテスト基盤の補強か、`feat/medical-record-line-share` に進んで共有メッセージ設計を整える段階。

### スプリントB

対象:

- LINE Webhook連携
- 顧客のLINE紐付け改善

成果物:

- Webhook受信API
- 連携ログ
- 顧客自動紐付け導線

### スプリントC

対象:

- 多頭予約UI

成果物:

- 同一顧客の連続予約支援
- 公開予約での追加ペット導線
- 家族単位の確認表示

### スプリントD

対象:

- 多頭予約データモデル拡張

成果物:

- `appointment group` 設計
- DB migration
- API / UIのグループ対応

---

## 6. 影響範囲

### 写真カルテ

- `groomer_app/src/components/medical-records/MedicalRecordCreateModal.tsx`
- `groomer_app/src/components/medical-records/MedicalRecordShareButton.tsx`
- `groomer_app/src/app/medical-records/page.tsx`
- `groomer_app/src/app/api/medical-records/[record_id]/share/route.ts`
- `groomer_app/src/lib/line.ts`

### 多頭予約

- `groomer_app/src/components/appointments/AppointmentForm.tsx`
- `groomer_app/src/lib/appointments/services/create.ts`
- `groomer_app/src/lib/public-reservations/services/shared.ts`
- `groomer_app/src/lib/public-reservations/services/create.ts`
- `groomer_app/src/lib/public-reservations/services/create-core.ts`
- `groomer_app/src/lib/supabase/database.types.ts`
- `supabase/*.sql`

### LINE深連携

- `groomer_app/src/lib/line.ts`
- `groomer_app/src/lib/cron/services/appointment-reminders.ts`
- `groomer_app/src/app/api/hotel/stays/[stay_id]/report-line/route.ts`
- `groomer_app/src/app/api/customers/*.ts`
- 新規 `groomer_app/src/app/api/webhooks/line/route.ts` 候補

---

## 7. 主要リスク

- 多頭予約は後方互換を崩しやすい
- LINE連携は運用上の認証・Webhook検証が必要
- 写真送付は誤送信防止のUIが必要
- 現場導線最適化はPCよりスマホ前提で考える必要がある

---

## 8. 次チャットで最初にやるべきこと

次のチャットでは以下の順で着手する。

1. `docs/differentiation-feature-roadmap.md` を読む
2. `TASKS.md` の差別化機能セクションを読む
3. 最初の実装対象を `写真カルテ高速化` に固定する
4. ブランチ `feat/medical-record-fast-flow` を作る
5. 予約起点プリセットと保存後共有導線から実装する

---

## 9. 着手時の推奨指示文

別チャットで再開する時の推奨プロンプト:

`docs/differentiation-feature-roadmap.md` と `TASKS.md` を読んで、差別化機能対応を継続してください。まずは `feat/medical-record-fast-flow` として、写真カルテの高速導線改善から実装してください。既存実装を活かし、予約起点プリセット、施術前/施術後ボタン化、保存後共有導線の3点を進めてください。
