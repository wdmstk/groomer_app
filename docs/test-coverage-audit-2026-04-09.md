# テストカバレッジ監査レポート（2026-04-09）

## 目的
- 現在のテストスイートが、重大な見落としなく仕様を検証できているかを確認する。
- 「全テストが通る」から「仕様とテストの対応関係が追跡可能で、十分に網羅されている」状態へ移行する。

## 対象範囲
- ページルート: `src/app/**/page.tsx`
- APIルート: `src/app/api/**/route.ts`
- テスト資産:
  - E2E: `groomer_app/e2e/*.spec.ts`
  - 単体/統合: `groomer_app/tests/*.test.ts` / `*.test.tsx`

## 監査手順
1. ページ/APIルートを全件列挙
2. ルートとテストの対応表を作成（文字列ベースの機械抽出 + 目視確認）
3. 参照が薄い領域を抽出
4. アサーション有無を確認（`expect(...)` と `assert.*(...)` の両方）

## 現状サマリー
- ページ数: `79`
- APIルート数: `175`
- テストファイル数: `134`
- `expect` または `assert` が存在しないテストファイルは確認されなかった

## 主な所見
### 1) 「テストが通る」ことと「網羅漏れがない」ことは同義ではない
- テスト資産の量は十分にある一方、領域ごとの深さにばらつきがある。
- 一部ページは Vitest のスモーク（見出し表示確認）中心で、直接的なE2E検証がない。

### 2) ページ側の低参照領域（要重点化）
- 直接E2Eがない代表例:
  - マニュアル/法務系ページ（低リスク想定でスモークのみ維持すべきものを含む）
- 監査対応で追加済み:
  - `/visits` 直接E2E
  - `/settings/notifications`、`/settings/public-reserve`、`/settings/storage` の挙動検証（保存/エラー表示、リダイレクト整合）
- 一部ページは「E2E 1本 + 最小限Vitest 1本」に留まり、回帰検知が浅い。

### 3) APIルートの直接テスト不足
- APIルートファイル単位でみると、直接参照されていないものが多い。
- ライブラリテストや画面テストで間接的に担保されるものはあるが、ルート契約の検証としては不足。
- 優先ギャップ（高）:
  - `/api/followups/[followup_id]/status`
  - `/api/followups/[followup_id]/events`
  - `/api/stores/customer-management-settings`
  - `/api/visits` / `/api/visits/[visit_id]`（境界値・異常系の深掘り不足）

## 本監査期間で対応済みの修正
- 来店周期アラートの仕様ズレを修正:
  - 対象期間フィルターの整合（`7/30/all`）
  - 再フォロー期限切れ後の未着手候補への復帰
  - 候補/対応済の重複状態の解消
- APIルートテストを追加:
  - `tests/followups.status-route.vitest.test.ts`
  - `tests/followups.events-route.vitest.test.ts`
  - `tests/stores.customer-management-settings.route.vitest.test.ts`
  - `tests/visits.route.vitest.test.ts`
  - `tests/visits.visit-id-route.vitest.test.ts`
- E2Eの追加/更新:
  - `e2e/customers-followup-alerts.spec.ts`
    - `7/30/all` の対象期間挙動
    - 「期限切れ対応済は未着手候補へ戻り、対応済から外れる」挙動
  - `e2e/visits-page.spec.ts`
    - `/visits` の主要5タブ見出し表示
    - 一覧タブの新規登録モーダル起動
  - `e2e/settings-pages.spec.ts` を挙動検証へ拡張
    - `/settings/notifications` と `/settings/storage` のレガシーURL遷移 + `saved/error` バナー表示
    - `/settings?tab=public-reserve` の保存フォーム `redirect_to` 一貫性

## 残存リスク
- fixture依存が強いテストは、本番相当の統合不整合を見逃す可能性がある（来店周期アラートは `TRACE-048` `TRACE-049` で実データ近似を追加、`followups` ルートは `TRACE-050`〜`TRACE-055` でクエリ境界を補強済み）。
- 日付境界・時差境界・状態遷移の組み合わせ（境界ケース）が、領域によっては不足している。
- APIルート契約テストが体系的に整備されていない。

## 次アクション（優先順）
1. 仕様トレーサビリティ表の運用継続
   - 機能追加/変更ごとに `TRACE-xxx` を同一PRで更新
   - `test:traceability` を必須チェックとして維持
2. 残存リスクの継続監視
   - fixture依存が高い領域（ホテル/サポート等）の実データ近似E2Eを段階追加
   - 日付境界/時差境界のケースを優先的に補強
3. `followups` ルートの候補算出境界の回帰監視
   - `include_candidates=true` 経路の `window_days` / クールダウン境界を継続監視

## 仕様トレーサビリティ表（初版）
| Test ID | 仕様項目 | テストファイル | 検証アサーション（抜粋） |
| --- | --- | --- | --- |
| TRACE-001 | 来店周期アラート: 3区分表示（未着手候補/対応中/対応済） | `e2e/customers-followup-alerts.spec.ts` | `未着手 顧客` は未着手候補のみ、`対応中 顧客` は対応中のみ、`対応済 顧客` は対応済のみ表示 |
| TRACE-002 | 来店周期アラート: 対象期間 7/30/all 切替 | `e2e/customers-followup-alerts.spec.ts` | `対象期間` を `30`/`7` で古い対応済が非表示、`all` で再表示 |
| TRACE-003 | 来店周期アラート: 再フォロー期限超過時の復帰 | `e2e/customers-followup-alerts.spec.ts` | 同一顧客が未着手候補に表示され、対応済から除外される |
| TRACE-048 | 来店周期アラート: 実データ近似の状態遷移 | `e2e/customers-followup-alerts.spec.ts` | 候補→キュー追加→対応開始→不要完了で、未着手候補/対応中/対応済の各表が連動更新される |
| TRACE-049 | 来店周期アラート: 担当者/期限フィルタの連動 | `e2e/customers-followup-alerts.spec.ts` | `担当者=自分` + `期限=overdue` の選択で、対応中一覧が該当担当・期限超過の行だけに絞り込まれる |
| TRACE-050 | followups API(GET): `assignee=me` + `due=overdue` + `window_days` 組み合わせ | `tests/followups.route.vitest.test.ts` | `assigned_user_id=user.id`・`due_on<today`・`recommended_at>=now-7days` が同時に適用される |
| TRACE-051 | followups API(GET): `window_days=all` の境界 | `tests/followups.route.vitest.test.ts` | `recommended_at` の `gte` フィルタが適用されない |
| TRACE-052 | followups API(GET): `due=today` + 明示 `assignee` の組み合わせ | `tests/followups.route.vitest.test.ts` | `assigned_user_id=<指定値>` と `due_on=today` の `eq` フィルタが同時に適用される |
| TRACE-053 | followups API(GET): 不正 `status` クエリの安全動作 | `tests/followups.route.vitest.test.ts` | 無効 `status` 指定時は `status` フィルタを適用せず、`200` で安全に応答する |
| TRACE-054 | followups API(GET): `include_candidates=true` の再フォロークールダウン境界 | `tests/followups.route.vitest.test.ts` | `resolved_no_need` のクールダウン内顧客は候補除外、クールダウン超過顧客は候補に復帰する |
| TRACE-055 | followups API(GET): `include_candidates=true` の `window_days` 候補境界 | `tests/followups.route.vitest.test.ts` | `window_days=7` では直近候補のみ、`window_days=all` では期間外候補も含まれる |
| TRACE-056 | followups API(GET): `include_candidates=true` の未来予約除外 | `tests/followups.route.vitest.test.ts` | 未来予約がある顧客は候補から除外され、未来予約がない顧客のみ候補に含まれる |
| TRACE-057 | followups API(GET): `include_candidates=true` と `status` クエリの不変性 | `tests/followups.route.vitest.test.ts` | `status` 指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-004 | followups status API: 不正statusの拒否 | `tests/followups.status-route.vitest.test.ts` | `bad_status` で `400` + `有効な status を指定してください。` |
| TRACE-005 | followups status API: snoozed必須項目 | `tests/followups.status-route.vitest.test.ts` | `status=snoozed` かつ `snoozed_until` 欠落で `400` |
| TRACE-032 | followups status API: 不正snoozed_untilの拒否 | `tests/followups.status-route.vitest.test.ts` | `status=snoozed` かつ無効日付 `snoozed_until` で `400` |
| TRACE-026 | followups status API: 更新対象なしリクエストの拒否 | `tests/followups.status-route.vitest.test.ts` | 空ボディ等で更新対象が無い場合 `400` + `更新対象がありません。` |
| TRACE-028 | followups status API: 不正resolution_typeの拒否 | `tests/followups.status-route.vitest.test.ts` | 解決系更新で許可外 `resolution_type` は `400` |
| TRACE-022 | followups status API: 解決済みからの不正再開遷移拒否 | `tests/followups.status-route.vitest.test.ts` | `resolved_no_need -> in_progress` が `400` + 不正遷移メッセージ |
| TRACE-031 | followups status API: openからresolved_bookedへの直遷移拒否 | `tests/followups.status-route.vitest.test.ts` | `open -> resolved_booked` は `400`（in_progress経由必須） |
| TRACE-033 | followups status API: 担当者解除（null指定）の許可 | `tests/followups.status-route.vitest.test.ts` | `assigned_user_id: null` の更新は `200` で成功 |
| TRACE-034 | followups status API: snoozed成功時の応答/イベント整合 | `tests/followups.status-route.vitest.test.ts` | `status=snoozed` 更新成功で `200` かつ `event_type=snoozed` を記録 |
| TRACE-042 | followups status API: resolved成功時の応答/イベント整合 | `tests/followups.status-route.vitest.test.ts` | `in_progress -> resolved_no_need` 成功で `200` かつ `event_type=resolved` を記録 |
| TRACE-006 | followups events API: 不正event_typeの拒否 | `tests/followups.events-route.vitest.test.ts` | `bad_event` で `400` + `有効な event_type を指定してください。` |
| TRACE-007 | followups events API: 解決済みへの連絡記録禁止 | `tests/followups.events-route.vitest.test.ts` | `resolved_*` タスクに `contacted_line` を追加すると `400` |
| TRACE-025 | followups events API: 解決済みへのメモ記録は許可 | `tests/followups.events-route.vitest.test.ts` | `resolved_*` タスクに `note_added` を追加でき `201` を返す |
| TRACE-023 | followups events API: 電話連絡resultの許可値制限 | `tests/followups.events-route.vitest.test.ts` | `contacted_phone` で許可外 `result` を送ると `400` |
| TRACE-024 | followups events API: 同日同チャネル重複送信の拒否 | `tests/followups.events-route.vitest.test.ts` | 同一 followup + 同日 + 同チャネルは `409`（重複送信防止） |
| TRACE-027 | followups events API: 電話番号未登録時の電話連絡拒否 | `tests/followups.events-route.vitest.test.ts` | `contacted_phone` 実行時に顧客電話番号未登録なら `400` |
| TRACE-029 | followups events API: 顧客未存在時の連絡記録拒否 | `tests/followups.events-route.vitest.test.ts` | `contacted_phone` 実行時に顧客が見つからない場合 `404` |
| TRACE-030 | followups events API: LINE ID未登録時のLINE連絡拒否 | `tests/followups.events-route.vitest.test.ts` | `contacted_line` 実行時に顧客LINE ID未登録なら `400` |
| TRACE-035 | followups events API: 空白本文のLINE連絡拒否 | `tests/followups.events-route.vitest.test.ts` | `contacted_line` で `payload.body` が空白のみの場合 `400` |
| TRACE-036 | followups events API: dedupe副作用ログ失敗時も重複拒否を維持 | `tests/followups.events-route.vitest.test.ts` | dedupe検出時に副作用insertが失敗しても主応答は `409` |
| TRACE-021 | followups再フォロー判定: クールダウン境界日の解除 | `tests/followups.refollow-policy.vitest.test.ts` | `snoozed/no_need/lost` が「ちょうど閾値日」でブロック解除されることを確認 |
| TRACE-008 | 店舗顧客管理設定API: 権限制御 | `tests/stores.customer-management-settings.route.vitest.test.ts` | 未認証 `401`、`staff` 権限で `403` |
| TRACE-009 | 店舗顧客管理設定API: クランプ/安全リダイレクト | `tests/stores.customer-management-settings.route.vitest.test.ts` | 極端値が `1..365` / `5..100` へ補正、`//evil...` は既定リダイレクトへ |
| TRACE-010 | visits API(POST): 必須/店舗整合性チェック | `tests/visits.route.vitest.test.ts` | `customer_id` 欠落で `400`、店舗不整合で `400` |
| TRACE-011 | visits API(POST): 予約重複時の既存編集導線 | `tests/visits.route.vitest.test.ts` | 既存来店ありで `307` + `/visits?tab=list&edit=...` |
| TRACE-012 | visits API(PUT): 予約重複409 | `tests/visits.visit-id-route.vitest.test.ts` | 同一予約に別来店がある場合 `409` + `visit_id` を返却 |
| TRACE-037 | visits API(POST): 不正visit_date形式の拒否 | `tests/visits.route.vitest.test.ts` | `visit_date` が無効形式の場合 `400` + `来店日時は必須です。` |
| TRACE-038 | visits API(PUT): 不正visit_date形式の拒否 | `tests/visits.visit-id-route.vitest.test.ts` | `visit_date` が無効形式の場合 `400` + `来店日時は必須です。` |
| TRACE-039 | visits API(PUT): 店舗整合性不正の拒否 | `tests/visits.visit-id-route.vitest.test.ts` | 顧客/担当/予約のいずれかが店舗不整合の場合 `400` |
| TRACE-040 | visits API(POST): 合計金額の非数入力拒否 | `tests/visits.route.vitest.test.ts` | `total_amount` が非数の場合 `400` + `合計金額は数値で入力してください。` |
| TRACE-041 | visits API(PUT): 合計金額の非数入力拒否 | `tests/visits.visit-id-route.vitest.test.ts` | `total_amount` が非数の場合 `400` + `合計金額は数値で入力してください。` |
| TRACE-043 | visits API(POST-override PUT): 合計金額の非数入力拒否 | `tests/visits.visit-id-route.vitest.test.ts` | `_method=put` のフォーム更新で `total_amount` が非数なら `400` |
| TRACE-044 | visits API(POST-override PUT): 不正visit_date形式の拒否 | `tests/visits.visit-id-route.vitest.test.ts` | `_method=put` のフォーム更新で `visit_date` が無効形式なら `400` |
| TRACE-045 | visits API(POST-override PATCH): 合計金額の非数入力拒否 | `tests/visits.visit-id-route.vitest.test.ts` | `_method=patch` のフォーム更新で `total_amount` が非数なら `400` |
| TRACE-046 | visits API(POST-override PATCH): 不正visit_date形式の拒否 | `tests/visits.visit-id-route.vitest.test.ts` | `_method=patch` のフォーム更新で `visit_date` が無効形式なら `400` |
| TRACE-047 | visits API(POST-override PATCH): 正常更新 | `tests/visits.visit-id-route.vitest.test.ts` | `_method=patch` のフォーム更新が正常入力で `307` リダイレクト（`/visits`）を返す |
| TRACE-013 | 来店履歴ページ: 主要タブ表示 | `e2e/visits-page.spec.ts` | `list/revisit/followup/cycle/quality` 各見出しを確認 |
| TRACE-014 | 顧客一覧ページ: 基本情報表示とモーダル導線 | `e2e/customers-list.spec.ts` | 顧客行の主要項目（氏名/電話/LTV等）表示と `新規顧客登録` モーダル起動を確認 |
| TRACE-015 | 会計一覧ページ: 一覧表示と領収書表示 | `e2e/payments-list.spec.ts` | 会計行の金額/ステータス表示、`領収書` で支払情報と明細表示を確認 |
| TRACE-018 | 在庫管理ページ: ダッシュボード/商品/履歴の表示 | `e2e/inventory-pages.spec.ts` | 在庫ダッシュボード指標、商品マスタ表示、在庫履歴行の表示を確認 |
| TRACE-019 | ホテル管理ページ: タブ表示と予約導線 | `e2e/hotel-page.spec.ts` | 一覧/カレンダー/運用設定/商品台帳の表示と新規予約モーダル表示を確認 |
| TRACE-020 | サポート問い合わせ: チケット起票とコメント追記 | `e2e/support-tickets.spec.ts` | チケット起票成功表示、新規チケット行表示、コメント投稿結果表示を確認 |
| TRACE-016 | settings: レガシーURL遷移と保存/エラー表示 | `e2e/settings-pages.spec.ts` | `/settings/notifications` `/settings/storage` で `saved/error` 表示と新URL遷移を確認 |
| TRACE-017 | settings: 公開予約フォームの遷移先維持 | `e2e/settings-pages.spec.ts` | `public-reserve` の保存フォーム `redirect_to=/settings?tab=public-reserve` を確認 |

### 運用ルール（この表の更新）
- 新規機能または仕様変更を入れた場合は、同一PRで「仕様項目1行」を追加/更新する。
- 各行に `TRACE-xxx` の `Test ID` を付与し、対応テストコード内にも同じIDを記載する。
- `検証アサーション` は「期待結果が読める文」にする（HTTP status、表示有無、遷移先など）。
- 主要フロー（顧客・予約・会計・通知・設定）は最低1行以上を維持する。
- `npm run test:traceability` をPR時に実行し、表内のテストパス実在チェックを自動化する（`.github/workflows/traceability-guard.yml`）。
- GitHubのBranch protectionで `Traceability Guard` を Required status check に設定する（リポジトリ設定側）。
- 設定手順は `docs/traceability-guard-setup.md` を参照する。
- `test:traceability` で主要カテゴリ（顧客/予約/会計/通知/設定）の欠落も検知する。
- `test:traceability` で、参照テストファイルに `test/it` と `expect/assert` が存在し、かつ表の `Test ID` がテスト内に記載されていることを検証する。

## 監査完了の判定基準
- 高リスクフローについて、以下を満たすこと:
  - 実運用に近いE2Eが最低1本以上ある
  - 主要APIに境界/異常系を含むルートテストがある
- 仕様トレーサビリティ表が存在し、機能追加・変更時に更新される運用が定着している
