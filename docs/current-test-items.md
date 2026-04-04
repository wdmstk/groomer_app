# 現行テスト項目一覧（2026-03-17時点）

## 1. テストの全体像

このリポジトリでは、現時点で次の2系統の自動テストを実施しています。

- 単体/ロジックテスト（`node:test`）
  - 配置: `groomer_app/tests/*.test.ts`
  - 対象: ドメインロジック、入力検証、表示整形ヘルパー、課金計算、重複防止、Cronコア処理など
- 画面E2Eテスト（Playwright）
  - 配置: `groomer_app/e2e/*.spec.ts`
  - 対象: 主要画面の表示確認、一覧/モーダル導線、主要フロー（公開予約、ホテル予約、サポート、課金、在庫等）

## 2. 件数サマリ

- 単体/ロジックテスト: 42ファイル / 123ケース
- E2Eテスト: 18ファイル / 44ケース
- 合計: 60ファイル / 167ケース

## 3. 実行コマンド

`groomer_app/package.json` の scripts で定義されている実行方法:

- 単体/ロジックテスト: `npm test`
- E2Eテスト: `npm run test:e2e`
- E2E（ブラウザ可視）: `npm run test:e2e:headed`

## 4. E2Eテスト項目詳細

### appointments-calendar.spec.ts
- スイート: 予約カレンダー
- 週表示で予約申請とスタッフ別の予定を確認できる
- 日表示へ切り替えて日別タイムテーブルを確認できる

### appointments-list.spec.ts
- スイート: 予約一覧
- 実運用に近い予約データで一覧導線を表示できる
- 新規登録と次回予約のモーダル初期表示が機能する

### billing-pages.spec.ts
- スイート: 課金画面
- 課金サマリーと料金内訳、要対応アラートを表示できる
- 課金履歴で通知従量課金と webhook 失敗を表示できる

### customers-list.spec.ts
- スイート: 顧客一覧
- 実運用に近い顧客データを一覧表示できる
- 新規顧客モーダルを開ける

### dashboard-log-pages.spec.ts
- スイート: ダッシュボードログ画面
- 通知ログで内訳、失敗理由、絞り込み結果を表示できる
- 監査ログで要約、フィルタ、JSON詳細を表示できる

### dashboard-pages.spec.ts
- スイート: ダッシュボード画面
- overview と followups タブで主要KPIと優先顧客を表示できる
- operations と reoffers タブで当日運用と再販状況を表示できる
- KPI レポートで集計カードを表示できる

### dev-support.spec.ts
- スイート: 開発者向けサポート
- dev/support-chat で店舗スレッドと返信導線を確認できる
- dev/support-tickets で店舗切替、ステータス更新、返信導線を確認できる

### hotel-page.spec.ts
- スイート: ペットホテル管理
- 一覧、カレンダー、設定、商品台帳の初期表示を確認できる
- 新規予約モーダルの初期表示を確認できる
- ホテル予約の作成・更新・削除と設定保存メッセージを確認できる
- ホテル商品台帳の保存・削除・シーズン切替メッセージを確認できる

### inventory-pages.spec.ts
- スイート: 在庫管理画面
- 在庫ダッシュボードで不足と期限アラートを表示できる
- 発注提案一覧で仕入先ごとの提案と高リスク商品を表示できる
- 商品マスタ一覧と作成・編集モーダル初期表示を確認できる
- 在庫一覧、履歴、レポートの集計表示を確認できる
- 入庫、出庫、発注管理の初期表示を確認できる
- 棚卸で帳簿在庫付き商品選択と差異履歴を表示できる

### ops-today.spec.ts
- スイート: モバイル当日運用
- KPI、予約カード、固定アクションを表示できる

### payments-list.spec.ts
- スイート: 会計一覧
- 実運用に近い会計データを一覧表示できる
- 新規会計モーダルを開ける
- 領収書ページで施術内訳と支払情報を確認できる

### pets-list.spec.ts
- スイート: ペット一覧
- 実運用に近いペットデータを一覧表示できる
- 新規ペットモーダルを開ける

### public-reservations.spec.ts
- スイート: 公開予約フロー
- 公開予約フォームで QR 照合と家族予約サマリーを確認できる
- 即時確定対象外メニューでは希望日時入力メッセージを表示する
- キャンセルページで無効 token と正常キャンセルを確認できる

### service-menus-list.spec.ts
- スイート: 施術メニュー一覧
- 実運用に近いメニューデータと推奨所要時間を表示できる
- 新規メニューモーダルを開ける

### settings-pages.spec.ts
- スイート: 設定画面
- 通知設定の既定値補正と権限表示を確認できる
- 公開予約設定の初期値と除外日を確認できる
- 容量設定の使用量警告と保存フォーム初期値を確認できる

### staffs-list.spec.ts
- スイート: スタッフ一覧
- ライトプラン上限と権限ラベル、招待一覧を表示できる
- 新規スタッフモーダルを開ける

### support-chat.spec.ts
- スイート: サポートチャット
- owner view で会話表示と送信導線を確認できる

### support-tickets.spec.ts
- スイート: サポート問い合わせ
- support-chat は E2E owner view を表示する
- チケット一覧、起票、コメント追記を表示できる

## 5. 単体/ロジックテスト項目詳細（原文）

### appointments.calendar-presentation.test.ts
- calendar presentation helpers parse delay alert with impacted pet summary
- calendar presentation helpers format conflict and requested status

### appointments.delete.test.ts
- deleteAppointment clears dependent rows before deleting appointment
- deleteAppointment blocks deletion when payments exist

### appointments.form-presentation.test.ts
- appointment form helpers build conflict message with JST range
- appointment form helpers select latest valid template for same pet
- appointment form helpers build created summary for family booking continuation

### appointments.presentation.test.ts
- appointment list presentation helpers format realistic reservation data
- appointment list presentation helpers fallback to 未登録 for missing values
- appointment list presentation helpers map status actions and completion states
- appointment list presentation helpers expose transition timestamps for progress rows

### appointments.shared.test.ts
- toUtcIsoFromJstInput converts JST local datetime to UTC iso
- calculateMenuSummary merges names and duration
- validateAppointmentWriteInput rejects missing menu ids

### billing.presentation.test.ts
- billing presentation helpers format dates and labels
- billing presentation helpers resolve badge classes

### billing.pricing.test.ts
- amountForOptions returns enabled option total for standard monthly plan
- amountForOptions returns zero for light plan even when toggles are true
- amountForSubscription includes base plan and enabled options
- amountForStorageAddonUnits converts units to monthly amount
- amountForPlanWithStoreCountAndOptions applies store discount before option add-on
- subscription env keys include enabled options and additional suffix

### cron.appointment-reminders-core.test.ts
- addDaysToJstDate shifts JST date correctly
- buildJstDayWindowIso returns iso range for JST day
- getJstDate resolves date in JST
- toStoreNotificationSettings normalizes out-of-range values
- shouldSendReminderNow checks timing and hour
- makeReminderDedupeKey includes timing and channel
- makeReminderDedupeKey prefers group id when present

### cron.hotel-vaccine-alerts-core.test.ts
- classifyVaccineAlertLevel maps thresholds
- diffDaysDateKey calculates JST day difference
- buildHotelVaccineDedupeKey includes stay and level
- buildHotelVaccineAlertMessage includes name, pet and remaining days

### cron.job-locks-core.test.ts
- appendManualLockReleaseAudit preserves existing meta and appends audit entry
- appendManualLockReleaseAudit keeps only the latest 20 entries
- validateReleaseJobLockInput rejects blank values

### cron.job-runs-core.test.ts
- listFailedJobRunsCore clamps limit and maps rows
- listFailedJobRunsCore rejects unsupported job names
- listJobRunsCore passes status, page, and date filters and returns pagination info
- listJobRunsCore rejects unsupported trigger values

### cron.notification-usage-billing-core.test.ts
- countUniqueSentMessagesByStore dedupes by dedupe_key and falls back to id
- calculateNotificationUsageCharge uses option limit when enabled
- getPreviousMonthJstPeriod resolves previous month boundaries

### cron.rerun-core.test.ts
- rerunCronJobCore starts and finishes a manual rerun with source job id
- rerunCronJobCore rejects when a recent running job exists

### cron.shared-core.test.ts
- startJobRunCore acquires lock and inserts job run
- startJobRunCore rejects when lock is already held
- finishJobRunCore updates and releases lock

### customer-ltv.test.ts
- getCustomerLtvRankLabel falls back to B
- getCustomerLtvRankTone returns stable badge class

### customers.presentation.test.ts
- customer presentation helpers format LINE status and fallback labels
- customer presentation helpers format tags and no-show badge

### hotel.feature-gate.test.ts
- isHotelFeatureEnabledForStore respects explicit store allowlist
- isHotelFeatureEnabledForStore supports wildcard
- isHotelFeatureEnabledForStore disables when env is empty

### hotel.pricing-core.test.ts
- calculateHotelPricing: per_night with transport and holiday surcharge
- calculateHotelPricing: per_hour rounds up stay and overtime
- calculateHotelPricing: flat mode uses planned times when actual times are absent
- calculateHotelPricing: throws when planned checkout is not after planned checkin

### hotel.report-line.test.ts
- renderHotelStayReportLineTemplate renders customer, pet and status label
- getJstDateKey converts UTC date into JST date key
- buildHotelStayReportDedupeKey is stable with normalized whitespace

### hotel.stay-items.test.ts
- parseSelectedStayItems ignores invalid rows and normalizes quantity
- buildStayItemSnapshots creates snapshot rows and totals
- summarizeCapacityTimeline detects peak occupancy

### hotel.transports-core.test.ts
- parseTransportType returns pickup/dropoff only
- parseTransportStatus applies fallback
- deriveInitialTransportStatus uses scheduled when datetime exists
- buildTransportStatusPatch sets timestamp field by status

### hq.access.test.ts
- canRoleUseHqCapability enforces owner/admin/staff matrix
- getStoreIdsByHqCapability filters stores by capability
- getManageableRoleByStoreId returns role map scoped by capability

### line-webhooks.test.ts
- verifyLineSignature returns true for a valid signature
- verifyLineSignature returns false for an invalid signature

### medical-record-tag-usage.test.ts
- getVisibleMedicalRecordTags prioritizes attention tags first
- buildMedicalRecordTagFilterOptions returns counts sorted by frequency then priority
- filterMedicalRecordsByAi narrows list by status and tag
- getMedicalRecordAiStatusOptions includes all bucket and idle fallback

### medical-records.share.test.ts
- buildMedicalRecordShareUrl creates a shared medical record URL
- buildMedicalRecordShareLineMessage includes customer, pet, and URL

### medical-records.shared.test.ts
- normalizeStatus returns finalized only for finalized input
- validateMedicalRecordWriteInput rejects missing required fields

### notification-templates.medical-record-share.test.ts
- renderMedicalRecordShareLineTemplate fills customer, pet, and share url

### object-utils.test.ts
- isObjectRecord returns true only for plain object-like values
- asObjectOrNull returns object or null
- asObject returns object or empty object fallback
- asJsonObjectOrNull returns JSON object or null
- asJsonObject returns JSON object or empty object fallback

### payments.duplicate-guard.test.ts
- ensureAppointmentHasNoOtherPayment allows appointments without existing payments
- ensureAppointmentHasNoOtherPayment rejects duplicate payments for the same appointment
- isDuplicatePaymentError detects unique constraint violations
- findPaymentByAppointment returns the existing payment row
- findPaymentByIdempotencyKey returns the existing payment row
- findVisitByAppointment returns the existing visit row

### payments.presentation.test.ts
- payment presentation helpers build JST appointment labels
- payment presentation helpers format paid status and fallback values

### payments.shared.test.ts
- calculatePaymentTotals handles tax included and excluded menus
- validatePaymentWriteInput requires appointmentId

### pets.presentation.test.ts
- pet presentation helpers preserve 0kg and relation fallback
- pet presentation helpers build QR display url from payload and fallback safely

### public-reservations.create-core.test.ts
- createPublicReservationCore creates customer, pet, appointment, and cancel URL
- createPublicReservationCore confirms instantly for instant-bookable menus
- createPublicReservationCore rejects instant confirmation when slot conflicts
- createPublicReservationCore rejects instant confirmation when start is outside published slots

### public-reservations.presentation.test.ts
- public reservation presentation helpers format slot display in JST
- public reservation presentation helpers build family booking summary and slot message

### public-reservations.shared.test.ts
- normalizePublicReservationInput trims string fields
- normalizeName ignores spaces and case
- time helpers convert and add minutes
- validatePublicReservationInput requires required fields and menus
- normalizeQrLookupInput trims qrPayload

### reservation-cancel-token.test.ts
- reservation cancel token preserves optional groupId

### service-menus.presentation.test.ts
- service menu presentation helpers apply default labels for null values

### settings.presentation.test.ts
- settings presentation helpers normalize roles and booleans
- settings presentation helpers clamp ints and followup days

### staffs.presentation.test.ts
- staff presentation helpers format membership labels and light-plan cap
- staff presentation helpers format invite expiry in JST

### storage-quota.test.ts
- buildStorageQuotaWarningMessage includes upstream message when available
- buildStorageQuotaWarningMessage falls back to a generic message

### store-invites.accept-core.test.ts
- acceptStoreInviteCore consumes invite after duplicate staff email fallback

### stores.bootstrap-core.test.ts
- validateStoreBootstrapInput trims and validates store name
- bootstrapStoreCore creates store and owner records
- bootstrapStoreCore rejects non-owner users with existing memberships

## 5.1 単体/ロジックテスト内容（日本語要約）

### appointments.calendar-presentation.test.ts
- 遅延アラート文面の解析と、影響を受けるペット要約の表示を検証
- 競合表示と申請ステータス表示の整形を検証

### appointments.delete.test.ts
- 予約削除時に関連データを先に削除してから本体を削除することを検証
- 会計データがある予約は削除不可であることを検証

### appointments.form-presentation.test.ts
- 競合メッセージにJST時間帯が正しく入ることを検証
- 同じペット向けテンプレートの最新有効版を選ぶことを検証
- 家族予約の連続作成時サマリーの生成を検証

### appointments.presentation.test.ts
- 実運用に近い予約データの一覧表示整形を検証
- 欠損値のフォールバック表示（未登録）を検証
- ステータス別アクションと完了状態のマッピングを検証
- 進行中行の遷移時刻露出を検証

### appointments.shared.test.ts
- JST入力日時をUTC ISOへ変換する処理を検証
- メニュー名と所要時間の集計を検証
- 予約更新入力でメニューID必須チェックを検証

### billing.presentation.test.ts
- 請求日付・ラベル整形を検証
- バッジCSSクラス解決を検証

### billing.pricing.test.ts
- プラン/オプション別料金計算を検証
- ライトプラン時のオプション課金無効化を検証
- 基本料金＋オプション合算を検証
- ストレージ追加単位の月額換算を検証
- 複数店舗割引適用順序を検証
- 課金連携用の環境キー生成を検証

### cron.appointment-reminders-core.test.ts
- JST日付計算と対象日ウィンドウ計算を検証
- 通知設定値の補正（範囲外値の正規化）を検証
- リマインド送信タイミング判定を検証
- 重複送信防止キー生成を検証

### cron.hotel-vaccine-alerts-core.test.ts
- ワクチン期限の警告レベル分類を検証
- JST日付差分計算を検証
- 通知重複防止キー生成を検証
- 通知本文生成（顧客名・ペット名・残日数）を検証

### cron.job-locks-core.test.ts
- 手動ロック解除監査ログの追記を検証
- 監査ログ保持件数上限（最新20件）を検証
- ロック解除入力の必須チェックを検証

### cron.job-runs-core.test.ts
- 失敗ジョブ一覧の件数制限・整形を検証
- 非対応ジョブ名の拒否を検証
- 一覧取得のフィルタ/ページング処理を検証
- 非対応トリガー値の拒否を検証

### cron.notification-usage-billing-core.test.ts
- 通知数集計時の重複排除ロジックを検証
- 従量課金計算（オプション上限反映）を検証
- 前月JST期間境界の算出を検証

### cron.rerun-core.test.ts
- 手動再実行の開始・終了フローを検証
- 直近で実行中ジョブがある場合の再実行拒否を検証

### cron.shared-core.test.ts
- ジョブ実行開始時のロック取得と実行記録作成を検証
- ロック中の開始拒否を検証
- 実行終了時の更新とロック解放を検証

### customer-ltv.test.ts
- LTVランクラベルのフォールバックを検証
- LTVランクトーン（見た目クラス）の安定性を検証

### customers.presentation.test.ts
- LINE連携状態と代替ラベル整形を検証
- タグ表示・無断キャンセルバッジ整形を検証

### hotel.feature-gate.test.ts
- 店舗別許可リストによる機能ON/OFFを検証
- ワイルドカード許可を検証
- 環境変数未設定時の無効化を検証

### hotel.pricing-core.test.ts
- 宿泊日単位課金＋送迎＋繁忙期加算を検証
- 時間単位課金の切り上げ計算を検証
- 実績時刻未入力時の予定時刻利用を検証
- チェックアウト不正時のエラーを検証

### hotel.report-line.test.ts
- ホテル滞在レポート文面生成を検証
- UTC日時からJST日付キー生成を検証
- 重複防止キー生成の安定性を検証

### hotel.stay-items.test.ts
- 滞在オプション入力の不正値除外・数量正規化を検証
- スナップショット行と合計算出を検証
- 収容数タイムラインのピーク検出を検証

### hotel.transports-core.test.ts
- 送迎種別の許容値判定を検証
- 送迎ステータスのフォールバックを検証
- 初期ステータス決定ロジックを検証
- ステータス更新時の時刻パッチ生成を検証

### hq.access.test.ts
- 役割別HQ権限マトリクスを検証
- 権限別に操作可能店舗を絞り込む処理を検証
- 権限スコープに応じた管理可能ロール取得を検証

### line-webhooks.test.ts
- LINE署名検証の成功ケースを検証
- LINE署名検証の失敗ケースを検証

### medical-record-tag-usage.test.ts
- 注目タグ優先表示を検証
- タグフィルタ候補の頻度順/優先順ソートを検証
- AIステータス/タグでの絞り込みを検証
- AIステータス選択肢生成（all/idle含む）を検証

### medical-records.share.test.ts
- カルテ共有URL生成を検証
- LINE共有メッセージ生成を検証

### medical-records.shared.test.ts
- カルテステータス正規化を検証
- カルテ入力の必須項目チェックを検証

### notification-templates.medical-record-share.test.ts
- カルテ共有テンプレートの差し込み生成を検証

### object-utils.test.ts
- オブジェクト判定ユーティリティを検証
- null許容/非許容のオブジェクト変換を検証
- JSONオブジェクト変換のフォールバックを検証

### payments.duplicate-guard.test.ts
- 予約への重複会計登録防止を検証
- 一意制約エラー判定を検証
- 予約ID/冪等キーから既存会計検索を検証
- 予約に紐づく来店情報検索を検証

### payments.presentation.test.ts
- JST予約ラベル生成を検証
- 支払状態・欠損時フォールバック整形を検証

### payments.shared.test.ts
- 税込/税別混在時の会計合計計算を検証
- 会計入力で予約ID必須チェックを検証

### pets.presentation.test.ts
- 体重0kg保持と関係性表示フォールバックを検証
- QR表示URL生成と安全なフォールバックを検証

### public-reservations.create-core.test.ts
- 公開予約作成時の顧客/ペット/予約/キャンセルURL生成を検証
- 即時確定対象メニューでの自動確定を検証
- 枠競合時の即時確定拒否を検証
- 公開枠外時間の即時確定拒否を検証

### public-reservations.presentation.test.ts
- 公開予約スロット表示（JST整形）を検証
- 家族予約サマリーと案内文生成を検証

### public-reservations.shared.test.ts
- 公開予約入力値トリムと正規化を検証
- 名前比較の空白/大小文字差無視を検証
- 時刻変換と分加算ヘルパーを検証
- 必須項目/メニュー必須バリデーションを検証
- QR照合入力のトリムを検証

### reservation-cancel-token.test.ts
- 予約キャンセルトークンに任意groupIdを保持できることを検証

### service-menus.presentation.test.ts
- 施術メニュー表示のデフォルトラベル適用を検証

### settings.presentation.test.ts
- 権限値と真偽値の正規化を検証
- 数値項目とフォローアップ日数の範囲補正を検証

### member-portal-expiry.test.ts
- 会員証TTL（30/90/180）の正規化を検証
- 失効判定が `max(発行基準, 最終来店基準, 現在expires_at)` で算出されることを検証

### staffs.presentation.test.ts
- 所属ラベル整形とライトプラン上限表示を検証
- 招待期限のJST整形を検証

### storage-quota.test.ts
- ストレージ警告文に上流メッセージを含める処理を検証
- 上流メッセージ欠損時の汎用警告文フォールバックを検証

### store-invites.accept-core.test.ts
- 重複メール時のフォールバックを含む招待承認処理を検証

### stores.bootstrap-core.test.ts
- 店舗作成入力のトリム・検証を検証
- 店舗とオーナー情報の初期作成を検証
- 既存所属がある非オーナーの作成拒否を検証

## 5.2 E2E 追加（Phase2）

### settings-pages.spec.ts
- 公開予約設定で会員証TTLセレクト（30/90/180）初期値と説明文を検証

### member-portal-phase2.spec.ts
- 顧客管理βで pending 再発行リクエストを検知し、`resolveReissueRequest=true` で再発行APIを実行することを検証

### member-portal-reissue.spec.ts
- 期限切れ画面想定の再発行依頼ボタンから、公開API `/api/public/member-portal/[token]/reissue-request` を呼び出せることを検証

## 6. 補足

- 本資料は `groomer_app/tests` と `groomer_app/e2e` の現行テストコードから抽出した内容です。
- 新規テスト追加や名称変更があった場合は、本資料も更新してください。
