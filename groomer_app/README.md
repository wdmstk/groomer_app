このプロジェクトは [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) で作成した [Next.js](https://nextjs.org) アプリです。

## はじめかた

まずは開発サーバーを起動します。

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
# または
bun dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと確認できます。

`app/page.tsx` を編集すると、ページは自動で更新されます。

このプロジェクトは [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) を使い、Vercel の [Geist](https://vercel.com/font) フォントを最適化して読み込みます。

## テスト運用ルール（必読）

### 基本方針
- テストは実際の機能を検証する
- `expect(true).toBe(true)` のような無意味なアサーションは禁止
- 各テストケースで「具体的な入力」と「期待される出力」を検証する
- モックは必要最小限にし、実際の挙動に近づける

### ハードコーディング禁止
- テストを通すためだけのハードコードは禁止
- 本番コードに `if(testmode)` のような分岐は入れない
- テスト専用マジックナンバーを本番コードへ埋め込まない
- 環境差分は環境変数/設定ファイルで分離する

### 実装原則
- Red-Green-Refactor で進める（失敗テストから開始）
- 境界値・異常系・エラー系を必ず含める
- カバレッジ率だけでなく実際の品質を重視する
- テスト名は何を検証しているか明確に書く
- 仕様が曖昧な場合は仮実装せず、仕様確認を優先する

### テストフレームワーク
- 新規/改修の unit test は Vitest を標準とする
- 既存の `node:test` は段階移行対象として当面共存
- E2E は Playwright を利用する

### 推奨実行順序（PR前）
1. `npm run lint`
2. `npx vitest run`（新規/改修 unit test）
3. `npm test`（既存 node:test 互換確認）
4. `npm run test:e2e`（影響画面がある変更）

## 参考リンク

Next.js の詳細は以下を参照してください。

- [Next.js Documentation](https://nextjs.org/docs): 機能・APIの公式ドキュメント
- [Learn Next.js](https://nextjs.org/learn): インタラクティブなチュートリアル

## Supabase型の更新

`src/lib/supabase/database.types.ts` は Supabase から再生成できます。

1. `SUPABASE_PROJECT_ID` を設定
2. 必要に応じて `supabase login` 済みの状態にする
3. 以下を実行

```bash
npm run types:generate:supabase
```

フィードバックやコントリビュートは [Next.js GitHub リポジトリ](https://github.com/vercel/next.js) を参照してください。

## Vercel デプロイ

Next.js の開発元が提供する [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) を使うと簡単にデプロイできます。

詳細は [Next.js のデプロイガイド](https://nextjs.org/docs/app/building-your-application/deploying) を参照してください。

## マルチストア E2E 確認（Supabase）

### 事前準備

1. `../supabase_multistore_migration.sql` を適用する。
2. `../supabase_multistore_rls.sql` を適用する。
3. `../supabase_rls_hardening_memberships_subscriptions.sql` を適用する。
4. 環境変数を設定する。
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（`api/cron/remind-appointments` に必須）
   - `CRON_SECRET_KEY`
   - `QR_PAYLOAD_SIGNING_SECRET`（公開予約QRの署名検証。未設定時は `CRON_SECRET_KEY` を使用）
   - `RESERVATION_CANCEL_SECRET`（任意。未設定時は `CRON_SECRET_KEY` を使用）
5. スタッフ招待機能を使う場合は `../supabase_store_invites.sql` を適用する。
6. 開発者専用のサブスク管理を使う場合は `../supabase_store_subscriptions.sql` を適用する。
7. 開発者専用ページ用の環境変数を設定する（どちらか必須）。
   - `DEVELOPER_ADMIN_EMAILS`（カンマ区切りメールアドレス）
   - `DEVELOPER_ADMIN_USER_IDS`（カンマ区切り Supabase Auth User ID）
8. 試用期間の日数デフォルトを変更する場合は `DEFAULT_TRIAL_DAYS` を設定する（未設定時30日）。

### 手動確認フロー

1. `store_memberships` で、同一ユーザーに対して2店舗分の所属情報を作成する。
2. ログイン後、サイドバーの `StoreSwitcher` でアクティブ店舗を切り替える。
3. 店舗Aで、顧客/ペット/スタッフ/メニュー/予約/会計を作成する。
4. 店舗Bへ切り替え、店舗Aのデータが以下に表示されないことを確認する。
   - `/customers/manage?view=customers`
   - `/customers/manage?view=pets`
   - `/staffs`
   - `/service-menus`
   - `/appointments`
   - `/visits`
   - `/medical-records`
   - `/payments`
5. 所属していない店舗IDで `POST /api/stores/active` を呼び、`403` になることを確認する。
6. `POST /api/upload` を呼び、返却URLのパスが `<active_store_id>/...` で始まることを確認する。
7. `Authorization: Bearer <CRON_SECRET_KEY>` ヘッダー付きで `GET /api/cron/remind-appointments` を呼び、以下を確認する。
   - `store_id` が一致する予約/顧客ペアのみ通知対象になる
   - リマインド文面に店舗名が含まれる
8. 開発者権限ユーザーで `/dev/subscriptions` にアクセスし、店舗ごとに課金状態を更新できることを確認する。
9. `billing_status != active` かつ試用期間終了後、ログイン時に `/billing-required` へ遷移することを確認する。
10. Stripe/KOMOJU決済を使う場合は `../supabase_billing_providers.sql` を適用し、`.env.billing.example` を参考に環境変数を追加する。
11. サブスク運用Cronを使う場合は、以下を日次実行する。
   - `GET /api/cron/billing-trial-rollover`（trialing期限切れの自動課金）
   - `GET /api/cron/billing-reminders`（試用終了7/3/当日・past_due発生通知）
   - `GET /api/cron/billing-status-sync`（Stripe/KOMOJU状態との日次同期）
12. 在庫管理を使う場合は `../supabase_inventory_management.sql` を適用する。
13. 予約業務KPI計測（作成時間/クリック数など）を永続保存する場合は `../supabase_appointment_metrics.sql` を適用する。
14. 犬種×メニュー標準時間・スタッフ補正係数を使う場合は `../supabase_service_duration_defaults.sql` を適用する。
15. 予約ステータス遷移時刻（受付/施術中/会計待ち/完了）を記録する場合は `../supabase_appointment_status_flow.sql` を適用する。
16. カルテを予約/会計へ紐づける場合は `../supabase_medical_records_links.sql` を適用する。
17. ペットごとのQRプロフィール画像を保存する場合は `../supabase_pet_qr_profiles.sql` を適用する。
18. カルテ写真アップロードを使う場合は `../supabase_storage_pet_photos.sql` を適用し、必要に応じて `SUPABASE_UPLOAD_BUCKET` を設定する（未設定時 `pet-photos`）。
19. 写真カルテ（施術前後の自動整理、時系列ギャラリー、7日限定共有）を使う場合は `../supabase_medical_record_photos.sql` を適用する。
20. 写真カルテAIタグを活用する場合は、カルテ一覧 `/medical-records?tab=list` でタグチップと解析状態から絞り込みできる。運用時は `/api/cron/medical-record-ai-tags` の定期実行を登録する。
21. Supabase Dashboard の `Authentication > Providers > Email` で `Leaked password protection` を **ON** にする（HaveIBeenPwned連携）。
22. 利用者ごとのUIテーマ切替を使う場合は `../supabase_staffs_ui_theme.sql` を適用する。
23. LINE webhook 連携（`/api/webhooks/line`）または顧客削除時のLINEイベント参照を使う場合は `../supabase_line_webhook_events.sql` を適用する。
24. LINE自動マーケ機能を使う場合は `../supabase_line_auto_marketing.sql` を適用する。

### Cron登録とは

「Cronに登録する」とは、上記APIを**毎日自動実行するスケジュール設定**を作ることです。  
これらのCron APIは `Authorization: Bearer <CRON_SECRET_KEY>` ヘッダーが必須です。

例: Vercel Cron を使う場合

1. VercelのProject Settingsで `CRON_SECRET_KEY` を環境変数に設定する。  
2. `vercel.json` にcronジョブを定義する。  
3. 定刻にVercelがAPIを呼び出し、自動で状態同期・通知を実行する。

`vercel.json` 例:

```json
{
  "crons": [
    { "path": "/api/cron/billing-status-sync", "schedule": "0 2 * * *" },
    { "path": "/api/cron/billing-reminders", "schedule": "10 2 * * *" },
    { "path": "/api/cron/billing-trial-rollover", "schedule": "20 2 * * *" }
  ]
}
```

補足:
- 時刻はUTC基準です（必要に応じて調整）。
- GitHub Actions や外部Cronサービスでも同様に、上記APIへ定期的に `GET` すれば運用可能です。

### API整合性チェック（スポット）

1. `appointment.customer_id` と異なる `customer_id` で会計を作成/更新し、`400` になることを確認する。
2. 別店舗のIDを使って来店履歴/カルテを作成し、`400` になることを確認する。

## 業務効率化SaaS TODO（優先3テーマ）

### 1) 予約登録を“最短操作”に固定する（コア体験）
- [o] 新規予約モーダルを1画面化（顧客選択→ペット選択→コース→時間→担当を縦並び）
- [o] 顧客名入力で2文字以上インクリメンタル検索、未登録はその場で簡易作成
- [o] 前回内容をコピーボタン（コース・担当・所要時間を自動セット）
- [o] 週/日タイムラインでドラッグ&ドロップ変更、競合時間は即エラー表示
- [o] KPI: 「予約1件作成時間」「クリック数」「当日変更対応時間」をイベント計測

### 2) 所要時間の自動化を先に入れる（業務効率の中核）
- [o] 犬種×メニューの標準時間マスタ（`service_duration_defaults`）
- [o] 予約作成時に自動入力、スタッフ別補正（早い/遅い）を係数で上書き
- [o] 予約枠の空き判定を「開始時刻だけでなく終了時刻まで」で厳密化
- [o] 遅延発生時に後続予約へ `+10/+20分` の影響アラート
- [o] KPI: 「時間見積もり誤差」「押し予約発生率」「1日あたり処理件数」

### 3) “再来店運用”を半自動化して固定化する（継続利用の土台）
- [o] 施術完了時にワンタップ次回予約（推奨来店日を自動提示）
- [o] 来店周期アラート（例: 前回来店+45日で対象抽出、一覧と一括連絡）
- [o] 無断キャンセル履歴を顧客カードにバッジ表示、予約時に警告
- [o] ベータ運用向け「手動通知（LINE/電話）」前提の軽量導線
- [o] KPI: 「次回予約化率」「再来店漏れ件数」「無断キャンセル再発率」

## 次の業務効率化SaaS TODO（第2フェーズ / 優先順）

### 優先1: 予約当日の運用安定化（当日崩れを減らす）
- [o] 受付/施術中/会計待ち/完了のステータス遷移をワンタップ化し、遷移時刻を自動記録

### 優先2: 現場の空き最適化（売上機会損失を減らす）
- [ ] キャンセル枠の即時再販導線（「直前空き」一覧 + 手動通知対象の自動抽出）

### 優先3: 失注防止の標準化（抜け漏れ連絡を減らす）
- [ ] 来店周期アラートに「対応済み/保留/不要」管理を追加し、未対応のみを継続表示

## 法務ドキュメント管理

法務ドキュメントは `src/` と同階層の `docs/legal/` で管理します。

- `docs/legal/tokushoho.md`: 特定商取引法に基づく表記
- `docs/legal/privacy-policy.md`: プライバシーポリシー
- `docs/legal/terms-of-service.md`: 利用規約
- `docs/legal/security-description.md`: セキュリティ説明書（企業向け）
