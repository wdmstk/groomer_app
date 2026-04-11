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
- APIルート数: `176`
- テストファイル数: `134`
- `expect` または `assert` が存在しないテストファイルは確認されなかった

## 最終網羅判定（2026-04-11）
- 判定: `大塊PR（B1〜B4）で優先領域のルート契約テスト補強を完了`
- 追加TRACE: `TRACE-091`〜`TRACE-182`（B1〜B4 + C1 + C2 + C3）
- 直近検証結果:
  - `npm run test:traceability` => `155 rows verified`
  - 各バッチの対象Vitest（B1〜B4）と `npm run lint` はすべて通過
- 除外/未対象の扱い:
  - 法務系API（`/api/legal/*`）は現時点で `src/app/api` 配下にルート未実装のため、B4では対象外として記録
  - 静的案内ページは除外可能だが、除外時は台帳で理由と代替検証を明記する運用に統一
- 残リスク（継続監視）:
  - fixture依存が高い領域（ホテル/サポート等）の実データ近似E2Eは引き続き拡張余地あり
  - 日付境界・時差境界・複合状態遷移は、機能拡張時に優先して回帰ケースを追加する

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
- fixture依存が強いテストは、本番相当の統合不整合を見逃す可能性がある（来店周期アラートは `TRACE-048` `TRACE-049` で実データ近似を追加、`followups` ルートは `TRACE-050`〜`TRACE-085` でクエリ境界を補強済み）。
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
| TRACE-058 | followups API(GET): `include_candidates=true` と `due` クエリの不変性 | `tests/followups.route.vitest.test.ts` | `due` 指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-059 | followups API(GET): `include_candidates=true` と `assignee` クエリの不変性 | `tests/followups.route.vitest.test.ts` | `assignee` 指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-060 | followups API(GET): `include_candidates=true` の `window_days=30` 候補境界 | `tests/followups.route.vitest.test.ts` | `window_days=30` で 30 日内候補を含み、30 日外候補を除外する |
| TRACE-061 | followups API(GET): `include_candidates=true` と `assignee=user-xxx` の不変性 | `tests/followups.route.vitest.test.ts` | 明示担当 `assignee=user-xxx` 指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-062 | followups API(GET): `include_candidates=true` と `assignee=unassigned` の不変性 | `tests/followups.route.vitest.test.ts` | `assignee=unassigned` 指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-063 | followups API(GET): `include_candidates=true` で不正 `status` 指定時の安全動作 | `tests/followups.route.vitest.test.ts` | 不正 `status=done` 指定でも `200` を返し、候補算出結果（`candidates`）は不変 |
| TRACE-064 | followups API(GET): `include_candidates=true` と `due=all` の不変性 | `tests/followups.route.vitest.test.ts` | `due=all` 指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-065 | followups API(GET): `include_candidates=true` と複数クエリ併用の不変性 | `tests/followups.route.vitest.test.ts` | `status`+`due`+`assignee` 併用指定有無で候補算出結果（`candidates`）が変わらない |
| TRACE-066 | followups API(GET): `include_candidates=true` と `window_days=30`+`status` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=30` で `status` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-067 | followups API(GET): `include_candidates=true` と `window_days=30`+`assignee` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=30` で `assignee` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-068 | followups API(GET): `include_candidates=true` と `window_days=30`+`due` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=30` で `due` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-069 | followups API(GET): `include_candidates=true` と `window_days=7`+`status` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=7` で `status` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-070 | followups API(GET): `include_candidates=true` と `window_days=7`+`assignee` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=7` で `assignee` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-071 | followups API(GET): `include_candidates=true` と `window_days=7`+`due` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=7` で `due` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-072 | followups API(GET): `include_candidates=true` と `window_days=all`+`status`+`due=all`+`assignee=unassigned` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリを併用しても候補算出結果（`candidates`）が変わらない |
| TRACE-073 | followups API(GET): `include_candidates=true` と `window_days=all`+不正`status`+`due`+`assignee` 併用時の不変性 | `tests/followups.route.vitest.test.ts` | 不正 `status` を含む複合クエリ併用でも候補算出結果（`candidates`）が変わらない |
| TRACE-074 | followups API(GET): `include_candidates=true` と `window_days=all`+`due=today` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で `due=today` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-075 | followups API(GET): `include_candidates=true` と `window_days=all`+`status`+`due=today`+`assignee=me` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-076 | followups API(GET): `include_candidates=true` と `window_days=all`+`due=overdue`+`assignee=user-2` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で `due=overdue`+`assignee=user-2` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-077 | followups API(GET): `include_candidates=true` と `window_days=all`+`status=open`+`due=today`+`assignee=user-2` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-078 | followups API(GET): `include_candidates=true` と `window_days=all`+`status=snoozed`+`assignee=unassigned` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で `status=snoozed`+`assignee=unassigned` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-079 | followups API(GET): `include_candidates=true` と `window_days=all`+`status=in_progress`+`due=all`+`assignee=user-2` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-080 | followups API(GET): `include_candidates=true` と `window_days=all`+`status=resolved_no_need`+`due=overdue`+`assignee=me` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-081 | followups API(GET): `include_candidates=true` と `window_days=all`+`due=today`+`assignee=unassigned` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-082 | followups API(GET): `include_candidates=true` と `window_days=all`+不正`due`+`assignee=me` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で不正 `due` を含むクエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-083 | followups API(GET): `include_candidates=true` と `window_days=all`+`due=all`+`assignee=user-999` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-084 | followups API(GET): `include_candidates=true` と `window_days=all`+`status=resolved_lost`+`due=all`+`assignee=me` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で複合クエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-085 | followups API(GET): `include_candidates=true` と `window_days=all`+不正`status`+`due=today`+`assignee=unassigned` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で不正 `status` を含むクエリ指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-086 | followups API(GET): `include_candidates=true` と `window_days=all`+`status=resolved_booked` 併用の不変性 | `tests/followups.route.vitest.test.ts` | `window_days=all` で `status=resolved_booked` 指定有無にかかわらず候補算出結果（`candidates`）が変わらない |
| TRACE-088 | followups API(GET): `include_candidates=true` と不正 `window_days` 指定の安全動作 | `tests/followups.route.vitest.test.ts` | 不正 `window_days` は `all` と同等扱いになり候補算出結果（`candidates`）が一致する |
| TRACE-089 | followups API(GET): `include_candidates=false` 時の候補算出スキップ契約 | `tests/followups.route.vitest.test.ts` | `include_candidates=false` で `candidates=[]` を返し、候補算出用テーブル参照が発生しない |
| TRACE-090 | followups API(GET): `due=today/overdue` のJST日付境界判定 | `tests/followups.route.vitest.test.ts` | JST基準日（例: `2026-04-11`）で `due_on=today` / `due_on<today` のフィルタ値が評価される |
| TRACE-091 | customers API(GET): 顧客一覧取得の基本契約 | `tests/customers.route.vitest.test.ts` | 正常時に `200` で顧客配列を返す |
| TRACE-092 | customers API(POST): `full_name` 必須バリデーション | `tests/customers.route.vitest.test.ts` | `full_name` 欠落で `400` + `氏名は必須です。` |
| TRACE-093 | customers API(POST): `tags` 正規化（trim/空要素除去） | `tests/customers.route.vitest.test.ts` | JSON配列タグを正規化し、監査ログ `after.tags` に反映される |
| TRACE-094 | customers API(POST-form): 不正 `redirect_to` の安全フォールバック | `tests/customers.route.vitest.test.ts` | 外部URL指定時も `307` で `/customers/manage?view=customers` へ遷移する |
| TRACE-095 | customers/[customer_id] API(PUT): `full_name` 必須バリデーション | `tests/customers.customer-id-route.vitest.test.ts` | `full_name` が空の場合 `400` + `氏名は必須です。` |
| TRACE-096 | customers/[customer_id] API(POST): 不正 `_method` の拒否 | `tests/customers.customer-id-route.vitest.test.ts` | `_method=unknown` は `405` + `Unsupported method` |
| TRACE-097 | customers/[customer_id] API(POST put/patch): 更新後リダイレクトとタグ正規化 | `tests/customers.customer-id-route.vitest.test.ts` | `_method=put` で `307` リダイレクトし、`tags` が正規化され監査ログに反映される |
| TRACE-098 | customers/[customer_id] API(DELETE): 依存削除と監査ログ連携 | `tests/customers.customer-id-route.vitest.test.ts` | `deleteCustomerWithDependencies` 呼び出し後に `200` 成功応答と `deleted` 監査ログ記録が行われる |
| TRACE-099 | customers/ltv API(GET): LTV集計取得の正常契約 | `tests/customers.ltv-route.vitest.test.ts` | 集計取得成功時に `200` でLTV配列を返す |
| TRACE-100 | customers/ltv API(GET): 例外時のエラー応答契約 | `tests/customers.ltv-route.vitest.test.ts` | 集計処理が例外の場合 `500` + 例外メッセージを返す |
| TRACE-101 | customers/[customer_id]/member-portal-reissue-requests API(GET): 未認証拒否 | `tests/customers.member-portal-reissue-requests-route.vitest.test.ts` | 未認証時は `401` + `Unauthorized` を返す |
| TRACE-102 | customers/[customer_id]/member-portal-reissue-requests API(GET): pending応答整形 | `tests/customers.member-portal-reissue-requests-route.vitest.test.ts` | `pendingRequest` を `requestedAt` / `note` 形式へ整形して返す |
| TRACE-103 | appointments API(GET): 予約一覧取得の基本契約 | `tests/appointments.route.vitest.test.ts` | 正常時に `200` で予約配列を返す |
| TRACE-104 | appointments API(POST): `Accept: application/json` のJSON応答契約 | `tests/appointments.route.vitest.test.ts` | JSON受理時は `200` で `{ id, groupId, appointment }` を返し、監査ログ記録が呼ばれる |
| TRACE-105 | appointments API(POST): 競合時のエラー契約 | `tests/appointments.route.vitest.test.ts` | サービス層競合時は `409` + `conflict` を含むJSONを返す |
| TRACE-106 | appointments/[appointment_id] API(POST): `_method=delete` の削除導線 | `tests/appointments.appointment-id-route.vitest.test.ts` | 削除成功時に `303` で `/appointments?tab=list` へ遷移し、削除サービスが呼ばれる |
| TRACE-107 | appointments/[appointment_id] API(POST): 不正 `_method` の拒否 | `tests/appointments.appointment-id-route.vitest.test.ts` | `_method=unknown` は `405` + `Unsupported method` を返す |
| TRACE-108 | appointments/[appointment_id] API(PUT): サービス層バリデーションエラーの透過 | `tests/appointments.appointment-id-route.vitest.test.ts` | サービス層が `AppointmentServiceError(400)` を返した場合、同じ `400` とメッセージを返す |
| TRACE-109 | visits API(GET): 来店一覧取得の基本契約 | `tests/visits.route.vitest.test.ts` | 正常時に `200` で来店配列を返す |
| TRACE-110 | visits API(GET): 一覧取得失敗時のエラー応答契約 | `tests/visits.route.vitest.test.ts` | クエリエラー時に `500` + エラーメッセージを返す |
| TRACE-111 | followups API(GET): 有効 `status` クエリの適用契約 | `tests/followups.route.vitest.test.ts` | `status=in_progress` 指定時に `status` フィルタ（`eq`）が適用される |
| TRACE-112 | payments API(GET): 会計一覧取得の基本契約 | `tests/payments.route.vitest.test.ts` | 正常時に `200` で会計配列を返す |
| TRACE-113 | payments API(POST): ヘッダ冪等キーの引き継ぎ契約 | `tests/payments.route.vitest.test.ts` | form側に未指定でも `x-idempotency-key` が作成入力へ反映される |
| TRACE-114 | payments API(POST): 不正 `redirect_to` の安全フォールバック | `tests/payments.route.vitest.test.ts` | 外部URL指定時も `/receipts/{payment_id}` へ遷移する |
| TRACE-115 | payments API(POST): サービス層バリデーションエラー透過 | `tests/payments.route.vitest.test.ts` | `PaymentServiceError` の status/message をそのまま返す |
| TRACE-116 | payments/[payment_id] API(GET): 会計詳細取得の基本契約 | `tests/payments.payment-id-route.vitest.test.ts` | 正常時に `200` で会計詳細を返す |
| TRACE-117 | payments/[payment_id] API(POST): `_method=delete` の削除導線 | `tests/payments.payment-id-route.vitest.test.ts` | 削除成功時に `/payments` へ遷移し、削除サービスが呼ばれる |
| TRACE-118 | payments/[payment_id] API(POST): 不正 `_method` の拒否 | `tests/payments.payment-id-route.vitest.test.ts` | `_method=unknown` は `405` + `Unsupported method` を返す |
| TRACE-119 | payments/[payment_id] API(PUT): サービス層バリデーションエラー透過 | `tests/payments.payment-id-route.vitest.test.ts` | `PaymentServiceError` の status/message をそのまま返す |
| TRACE-120 | invoices API(GET): 請求一覧取得の基本契約 | `tests/invoices.route.vitest.test.ts` | 正常時に `200` で請求配列を返す |
| TRACE-121 | invoices API(POST): 不正JSON入力の拒否 | `tests/invoices.route.vitest.test.ts` | 不正JSON時に `400` + `Invalid JSON body.` を返す |
| TRACE-122 | invoices API(POST): 明細ソース未指定の必須チェック | `tests/invoices.route.vitest.test.ts` | `appointment_ids` と `hotel_stay_ids` 未指定時に `400` を返す |
| TRACE-123 | invoices/[invoice_id] API(GET): 請求未存在時の404契約 | `tests/invoices.invoice-id-routes.vitest.test.ts` | 該当請求が無い場合 `404` + `Invoice not found.` を返す |
| TRACE-124 | invoices/[invoice_id] API(PATCH): 編集不可ステータスの拒否 | `tests/invoices.invoice-id-routes.vitest.test.ts` | `paid/void` は `409` + `INVOICE_NOT_EDITABLE...` を返す |
| TRACE-125 | invoices/[invoice_id]/pay API(POST): 既存会計の再利用契約 | `tests/invoices.invoice-id-routes.vitest.test.ts` | 既存会計がある場合 `200` で `reused: true` を返す |
| TRACE-126 | invoices/[invoice_id]/pay API(POST): void請求の会計禁止 | `tests/invoices.invoice-id-routes.vitest.test.ts` | `status=void` は `409` + `INVOICE_NOT_EDITABLE...` を返す |
| TRACE-127 | pos/sessions/open API(POST): 開局重複時の409契約 | `tests/pos.routes.vitest.test.ts` | 既にopenセッションがある場合 `409` + `POS_SESSION_ALREADY_OPEN` を返す |
| TRACE-128 | pos/sessions/[session_id]/close API(POST): 不正JSON入力の拒否 | `tests/pos.routes.vitest.test.ts` | 不正JSON時に `400` + `POS_INVALID_JSON` を返す |
| TRACE-129 | pos/orders API(POST): 明細必須バリデーション | `tests/pos.routes.vitest.test.ts` | `lines` が空配列の場合 `400` + `POS_LINES_REQUIRED` を返す |
| TRACE-130 | pos/orders/[order_id]/confirm API(POST): 決済方法必須バリデーション | `tests/pos.routes.vitest.test.ts` | `method` 未指定時に `400` + `POS_PAYMENT_METHOD_REQUIRED` を返す |
| TRACE-131 | pos/orders/[order_id]/void API(POST): 取消理由必須バリデーション | `tests/pos.routes.vitest.test.ts` | `reason` 未指定時に `400` + `POS_VOID_REASON_REQUIRED` を返す |
| TRACE-132 | pos/cash-drawer-events API(POST): 金額の下限バリデーション | `tests/pos.routes.vitest.test.ts` | `amount < 0` の場合 `400` + `POS_AMOUNT_INVALID` を返す |
| TRACE-133 | inventory/items API(POST): 商品名必須バリデーション | `tests/inventory.routes.vitest.test.ts` | `name` 未指定時に `400` + `商品名は必須です。` を返す |
| TRACE-134 | inventory/movements API(POST): 出庫時在庫不足の拒否 | `tests/inventory.routes.vitest.test.ts` | 現在庫より多い `outbound` は `400` + 在庫不足メッセージを返す |
| TRACE-135 | inventory/stocktake API(POST): 差分ゼロ時の早期リダイレクト | `tests/inventory.routes.vitest.test.ts` | `actual_quantity` と現在庫が同一の場合 `307` で `/inventory/stocktake` へ遷移する |
| TRACE-136 | inventory/movements API(GET): 在庫履歴取得の基本契約 | `tests/inventory.routes.vitest.test.ts` | 正常時に `200` で在庫移動配列を返す |
| TRACE-137 | hotel/stays API(POST): 不正JSON入力の拒否 | `tests/hotel.routes.vitest.test.ts` | 不正JSON時に `400` + `Invalid JSON body.` を返す |
| TRACE-138 | hotel/transports API(POST): `stay_id` 必須バリデーション | `tests/hotel.routes.vitest.test.ts` | `stay_id` 未指定時に `400` + `stay_id is required.` を返す |
| TRACE-139 | consents/templates API(POST): 不正JSON入力の拒否 | `tests/consents.routes.vitest.test.ts` | 不正JSON時に `400` + `invalid json body.` を返す |
| TRACE-140 | consents/templates API(POST): `name` 必須バリデーション | `tests/consents.routes.vitest.test.ts` | `name` 未指定時に `400` + `name is required.` を返す |
| TRACE-141 | consents/documents API(POST): 入力検証エラーの400契約 | `tests/consents.routes.vitest.test.ts` | バリデーション `ok=false` の場合 `400` + 検証メッセージを返す |
| TRACE-142 | medical-records API(POST): サービス層バリデーションエラー透過 | `tests/medical-records.routes.vitest.test.ts` | `MedicalRecordServiceError(400)` 時に `400` と同メッセージを返す |
| TRACE-143 | medical-records API(POST): 予期しない例外の500契約 | `tests/medical-records.routes.vitest.test.ts` | 予期しない `Error` 発生時に `500` + 例外メッセージを返す |
| TRACE-144 | webhooks/line API(POST): 署名不一致の拒否 | `tests/webhooks.routes.vitest.test.ts` | 署名検証失敗時に `400` + `Invalid signature` を返す |
| TRACE-145 | webhooks/stripe API(POST): 秘密鍵未設定時の拒否 | `tests/webhooks.routes.vitest.test.ts` | Webhook secret 未設定時に `500` + `Missing Stripe webhook secrets` を返す |
| TRACE-146 | webhooks/komoju API(POST): 秘密鍵未設定時の拒否 | `tests/webhooks.routes.vitest.test.ts` | Webhook secret 未設定時に `500` + `Missing KOMOJU webhook secrets` を返す |
| TRACE-147 | stores/active API(POST): `storeId` 必須バリデーション | `tests/stores.misc-routes.vitest.test.ts` | `storeId` 未指定時に `400` + `storeId is required.` を返す |
| TRACE-148 | stores/member-card-settings API(POST): 未認証拒否 | `tests/stores.misc-routes.vitest.test.ts` | 未認証時に `401` + `Unauthorized` を返す |
| TRACE-149 | stores/ltv-rank-settings API(POST): しきい値順序バリデーション | `tests/stores.misc-routes.vitest.test.ts` | 売上しきい値が `gold >= silver >= bronze` を満たさない場合 `400` を返す |
| TRACE-150 | stores/public-reserve-slot-settings API(POST): 営業時間入力バリデーション | `tests/stores.misc-routes.vitest.test.ts` | 開始/終了時刻欠落時に `400` + 営業時間エラーメッセージを返す |
| TRACE-151 | support-tickets API(POST): 件名必須バリデーション | `tests/support.routes.vitest.test.ts` | `subject` 未指定時に `400` + `件名は必須です。` を返す |
| TRACE-152 | support-tickets API(PATCH): `ticket_id` 必須バリデーション | `tests/support.routes.vitest.test.ts` | `ticket_id` 未指定時に `400` + `ticket_id は必須です。` を返す |
| TRACE-153 | support-chat/messages API(POST): 空メッセージ拒否 | `tests/support.routes.vitest.test.ts` | 空白メッセージ時に `400` + `メッセージは必須です。` を返す |
| TRACE-154 | dev/subscriptions/[store_id] API(POST): 課金ステータス不正入力の拒否 | `tests/dev-subscriptions.route.vitest.test.ts` | 不正 `billing_status` で `303` リダイレクトし、エラーメッセージを返す |
| TRACE-155 | hq/kpi-summary API(GET): 未認証拒否 | `tests/hq.kpi-summary.route.vitest.test.ts` | 未認証時に `401` + `ログインが必要です。` を返す |
| TRACE-156 | hq/kpi-summary API(GET): HQ閲覧対象なしの403契約 | `tests/hq.kpi-summary.route.vitest.test.ts` | HQ権限対象店舗が無い場合 `403` + Pro対象なしメッセージを返す |
| TRACE-157 | auth/login API(POST): ログイン成功時の遷移契約 | `tests/auth.routes.vitest.test.ts` | 認証成功時に `301` で `/dashboard` へリダイレクトする |
| TRACE-158 | auth/login API(POST): ログイン失敗時のエラー遷移契約 | `tests/auth.routes.vitest.test.ts` | 認証失敗時に `301` で `/login?error=...` へリダイレクトする |
| TRACE-159 | auth/logout API(POST): ログアウト遷移契約 | `tests/auth.routes.vitest.test.ts` | `signOut` 実行後に `301` で `/login` へリダイレクトする |
| TRACE-160 | billing/options API(POST): ownerガードエラー透過 | `tests/billing.routes.vitest.test.ts` | `requireOwnerStoreMembership` が失敗した場合、同じ status/message を返す |
| TRACE-161 | billing/options API(POST): 対象外プランのオプション申込拒否 | `tests/billing.routes.vitest.test.ts` | オプション契約不可プランで有効化要求時、`307` リダイレクト + エラーメッセージを返す |
| TRACE-162 | billing/options API(POST): requested列未適用時の移行ガイダンス | `tests/billing.routes.vitest.test.ts` | `*_requested` 列不足エラー時、マイグレーション案内付きで `/billing?error=...` へ遷移する |
| TRACE-163 | billing/preferred-provider API(POST): 不正provider拒否 | `tests/billing.routes.vitest.test.ts` | `provider` が `stripe/komoju` 以外の場合 `400` を返す |
| TRACE-164 | billing/preferred-provider API(POST): 不正billing_statusのフォールバック | `tests/billing.routes.vitest.test.ts` | 現在ステータスが許可外値でも `trialing` で `updateStoreSubscriptionStatus` を呼ぶ |
| TRACE-165 | billing/subscription/actions API(POST): 不正action拒否 | `tests/billing.routes.vitest.test.ts` | 許可外 `action` の場合 `400` + `invalid action.` を返す |
| TRACE-166 | billing/subscription/actions API(POST): 対象サブスク未存在の404契約 | `tests/billing.routes.vitest.test.ts` | 対象サブスクが見つからない場合 `404` + エラーメッセージを返す |
| TRACE-167 | billing/subscription/actions API(POST): 返金依頼記録契約 | `tests/billing.routes.vitest.test.ts` | `refund_request` で `insertBillingOperation` を記録し、`200` で成功メッセージを返す |
| TRACE-168 | billing/subscription/actions API(POST): 即時解約フロー契約 | `tests/billing.routes.vitest.test.ts` | `cancel_immediately` でプロバイダ解約・状態更新を実行し、`200` で成功メッセージを返す |
| TRACE-169 | billing/stripe/checkout API(POST): ownerメール欠落時の拒否 | `tests/billing.checkout-routes.vitest.test.ts` | ownerメールが空の場合 `400` + `User email is required.` を返す |
| TRACE-170 | billing/stripe/checkout API(POST): 再利用セッション返却契約 | `tests/billing.checkout-routes.vitest.test.ts` | 再利用可能セッションがある場合 `reused: true` で既存 `checkout_url/session_id` を返す |
| TRACE-171 | billing/komoju/checkout API(POST): 既存有効契約時の409契約 | `tests/billing.checkout-routes.vitest.test.ts` | 既存 `active/trialing/past_due` 契約がある場合 `409` + 解約誘導メッセージを返す |
| TRACE-172 | billing/setup-assistance/checkout API(POST): 不正provider時のフォールバック | `tests/billing.checkout-routes.vitest.test.ts` | 許可外 `provider` 指定時は `stripe` フォールバックで決済セッションを作成する |
| TRACE-173 | billing/storage-addon/checkout API(POST): 容量追加セッション再利用契約 | `tests/billing.checkout-routes.vitest.test.ts` | `subscriptionScope=storage_addon` の再利用セッションがある場合 `reused: true` を返す |
| TRACE-174 | billing/storage-addon/checkout API(POST): units正規化（最小1）契約 | `tests/billing.checkout-routes.vitest.test.ts` | 不正 `units` 入力時も `units=1` として扱い、`addon_gb=10` `amount_jpy=300` を返す |
| TRACE-175 | appointments reservation-payment checkout API(POST): 未認証拒否 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | 未認証時に `401` + `Unauthorized` を返す |
| TRACE-176 | appointments reservation-payment checkout API(POST): 予約未存在の404契約 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | 対象予約がない場合 `404` + エラーメッセージを返す |
| TRACE-177 | appointments reservation-payment checkout API(POST): 事前決済設定OFF時の拒否 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | 店舗の事前決済設定が無効時に `400` を返す |
| TRACE-178 | appointments reservation-payment checkout API(POST): 事前決済対象外予約の拒否 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | `reservation_payment_method != prepayment` の場合 `400` を返す |
| TRACE-179 | appointments reservation-payment checkout API(POST): 金額0円時の拒否 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | 決済対象合計が0円以下の場合 `400` を返す |
| TRACE-180 | appointments reservation-payment checkout API(POST): プロバイダ接続未設定時の拒否 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | 店舗のプロバイダ接続情報が無い場合 `400` を返す |
| TRACE-181 | appointments reservation-payment claim API(POST): 無断キャンセル以外の拒否 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | `appointment.status != 無断キャンセル` の場合 `400` を返す |
| TRACE-182 | appointments reservation-payment claim API(POST): 請求処理成功時のリダイレクト契約 | `tests/appointments.reservation-payment-routes.vitest.test.ts` | 請求更新成功時に `303` リダイレクトし、監査ログ記録を呼び出す |
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
