# 動画カルテ + AIプラン SQL適用 Runbook（OP-2026-03-20）

## 目的
1. 既存の写真カルテを壊さずに、動画カルテとAI Assist/Pro/Pro+拡張を安全に反映する。
2. SQL適用順序を固定し、ステージング検証後に本番へ同順序で展開する。
3. 容量連動・RLS・課金オプションの後方互換性を確認する。

## 対象SQL（適用順）
1. `supabase/supabase_medical_record_videos.sql`
2. `supabase/supabase_storage_pet_videos.sql`
3. `supabase/supabase_medical_record_ai_tags.sql`
4. `supabase/supabase_store_subscriptions_ai_options.sql`
5. `supabase/supabase_store_subscriptions_option_entitlements.sql`
6. `supabase/supabase_medical_record_ai_assist.sql`
7. `supabase/supabase_medical_record_ai_pro_insights.sql`
8. `supabase/supabase_medical_record_ai_pro_plus.sql`
9. `supabase/supabase_medical_record_ai_video_jobs.sql`
10. `supabase/supabase_multistore_rls.sql`

## なぜこの順序か
1. 先に動画テーブル/バケットを作ることで、動画保存APIの参照先を確保する。
2. 次にAIタグ・AIプラン列・requested/effective列・Assist/Pro/Pro+テーブルを作り、APIが参照する列/テーブルを先に準備する。
3. 最後にRLSを適用して、新規テーブルを既存マルチ店舗制御へ統合する。

## 課金確定ゲート（requested / effective）
1. `store_subscriptions` はオプション状態を `requested`（申込）と `effective`（利用可）で管理する。
2. `/api/billing/options` は `requested` のみ更新し、支払い確定前に機能は有効化しない。
3. Stripe/KOMOJU webhook 成功イベントで `requested -> effective` を反映する。
4. 機能ゲート（AI/ホテル/通知強化）は `effective` を優先参照する。
5. 互換期間は旧列（`ai_plan_code` / `hotel_option_enabled` / `notification_option_enabled`）へ同期する。

## 実施手順（ステージング）
1. ステージングのDBバックアップを取得する。
2. 上記の順序でSQLを適用する（`if not exists` を含むため再実行可能）。
3. 環境変数を設定する（まずは `mock` 運用、段階的に実APIへ切替）。
  - `AI_LLM_PROVIDER=mock`
  - `VIDEO_AI_PROVIDER=mock`
  - 実APIへ切替時のみ以下を設定
    - `AI_LLM_PROVIDER=openai`, `OPENAI_API_KEY`
    - `VIDEO_AI_PROVIDER=external`, `VIDEO_AI_API_KEY`, `VIDEO_AI_EXTRACT_HIGHLIGHTS_URL`, `VIDEO_AI_GENERATE_SHORT_URL`
4. Next.jsステージングを最新 `main` でデプロイする。
5. 主要機能を確認する。
  - 写真カルテ作成/編集/共有が従来どおり動く
  - 動画アップロード・再生・サムネ生成・LINE短尺送信が動く
  - `/billing` の AI Assist / Pro / Pro+ 切替表示と保存が動く
  - AI Assist / Pro / Pro+ APIがプランゲートどおり動く
  - `/api/cron/medical-record-ai-video` 実行で `medical_record_ai_video_jobs` が `queued -> processing -> completed|failed` へ遷移する
6. 実API切替前に、`mock` で運用導線（画面・ジョブ・再実行）を先に安定化する。

## 実施手順（本番）
1. 本番メンテ告知を出す（短時間の運用監視強化）。
2. ステージングと同じ順序でSQLを適用する。
3. 本番を `main` 最新コミットへデプロイする。
4. 検証SQLとアプリ疎通確認を実施する。
5. 監視期間（最低24時間）でジョブ失敗率と通知ログを監視する。

## 検証SQL（適用後）
```sql
-- 新規テーブル存在確認
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'medical_record_videos',
    'medical_record_ai_tag_jobs',
    'medical_record_ai_assist_jobs',
    'medical_record_ai_assist_results',
    'medical_record_ai_video_jobs',
    'medical_record_ai_pro_insights',
    'medical_record_ai_pro_plus_health_insights',
    'store_ai_monthly_reports'
  )
order by tablename;
```

```sql
-- AIプラン列確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'store_subscriptions'
  and column_name = 'ai_plan_code';
```

```sql
-- RLS有効確認
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'medical_record_videos',
    'medical_record_ai_assist_jobs',
    'medical_record_ai_assist_results',
    'medical_record_ai_video_jobs',
    'medical_record_ai_pro_insights',
    'medical_record_ai_pro_plus_health_insights',
    'store_ai_monthly_reports'
  )
order by tablename;
```

## 実API切替チェック（開発者向け）
1. `AI_LLM_PROVIDER=openai` に変更し、`OPENAI_API_KEY` を設定する。
2. Assist/Pro/Pro+ を1件ずつ実行し、`result_payload.provider` が `openai:*` になることを確認する。
3. `VIDEO_AI_PROVIDER=external` に変更し、動画APIのURL/キーを設定する。
4. Pro+ を実行し、`result_payload.provider` が外部動画AI provider 名になることを確認する。
5. 失敗時は `medical_record_ai_video_jobs.error_message` と `job_runs` を照合し、再実行（retry）で復旧手順を確認する。

## Step 9 ステージング疎通確認（実施チェックリスト）
1. 事前条件
  - `store_subscriptions.ai_plan_code` が対象店舗で `assist / pro / pro_plus` に切替可能
  - テスト用の `medical_records` と `medical_record_videos` が1件以上存在
  - `CRON_SECRET_KEY` が設定済み
2. 実行順
  - まず `mock` で導線確認（Assist/Pro/Pro+）
  - 次に LLM 実API（`AI_LLM_PROVIDER=openai`）
  - 最後に 動画AI 実API（`VIDEO_AI_PROVIDER=external`）
3. 判定基準
  - ジョブ状態: `queued -> processing -> completed`（失敗時は `failed` + `error_message`）
  - プランゲート: 契約外 tier は 403
  - provider 判定:
    - mock時: `assist_flash_mock` / `pro_vision_mock` / `video_ai_mock`
    - 実API時: `openai:*` / 外部動画AI provider 名

### 実行コマンド例（ステージング）
`BASE_URL` と `CRON_SECRET_KEY`、`VIDEO_ID` は環境に合わせて置換する。

```bash
# 1) Assist ジョブ投入
curl -sS -X POST "$BASE_URL/api/medical-records/videos/$VIDEO_ID/ai-assist" \
  -H "content-type: application/json" \
  -d '{"action":"queue"}'

# 2) Pro ジョブ投入
curl -sS -X POST "$BASE_URL/api/medical-records/videos/$VIDEO_ID/ai-pro" \
  -H "content-type: application/json" \
  -d '{"action":"queue"}'

# 3) Pro+ ジョブ投入
curl -sS -X POST "$BASE_URL/api/medical-records/videos/$VIDEO_ID/ai-pro-plus" \
  -H "content-type: application/json" \
  -d '{"action":"queue"}'

# 4) cron 実行（処理）
curl -sS "$BASE_URL/api/cron/medical-record-ai-video" \
  -H "authorization: Bearer $CRON_SECRET_KEY"
```

```bash
# 5) 各tierの最新ステータス確認
curl -sS "$BASE_URL/api/medical-records/videos/$VIDEO_ID/ai-assist"
curl -sS "$BASE_URL/api/medical-records/videos/$VIDEO_ID/ai-pro"
curl -sS "$BASE_URL/api/medical-records/videos/$VIDEO_ID/ai-pro-plus"
```

### 検証マトリクス（記録用）
| Case | 契約AIプラン | 実行tier | 期待 |
|---|---|---|---|
| 1 | assist | assist | 202 + completed、provider=assist系 |
| 2 | assist | pro | 403 |
| 3 | pro | pro | 202 + completed、provider=pro系 |
| 4 | pro | pro_plus | 403 |
| 5 | pro_plus | pro_plus | 202 + completed、provider=videoAI系 |
| 6 | pro_plus | pro_plus（retry） | 既存失敗ジョブから復旧できる |

### 確認SQL（Step 9）
```sql
-- 最新ジョブ状態と provider 確認
select
  created_at,
  tier,
  status,
  (result_payload ->> 'provider') as provider,
  error_message
from public.medical_record_ai_video_jobs
order by created_at desc
limit 30;
```

```sql
-- tier別成功率（当日）
select
  tier,
  status,
  count(*) as jobs
from public.medical_record_ai_video_jobs
where created_at >= date_trunc('day', now())
group by tier, status
order by tier, status;
```

```sql
-- Pro+ 健康気づきの更新確認
select
  analyzed_at,
  gait_risk,
  skin_risk,
  tremor_risk,
  respiration_risk,
  stress_level,
  fatigue_level,
  confidence
from public.medical_record_ai_pro_plus_health_insights
order by analyzed_at desc
limit 20;
```

```sql
-- 月次レポートの provider 確認
select
  report_month,
  (metrics ->> 'summaryProvider') as summary_provider,
  generated_at
from public.store_ai_monthly_reports
order by generated_at desc
limit 12;
```

## 運用監視ダッシュボードSQL（固定）
```sql
-- 1) job_runs 監視（medical-record-ai-video の直近実行）
select
  id,
  status,
  trigger,
  started_at,
  finished_at,
  last_error,
  meta
from public.job_runs
where job_name = 'medical-record-ai-video'
order by started_at desc
limit 50;
```

```sql
-- 2) medical_record_ai_video_jobs 監視（tier / status / provider）
select
  created_at,
  tier,
  status,
  provider,
  attempts,
  (result_payload ->> 'provider') as payload_provider,
  error_message
from public.medical_record_ai_video_jobs
order by created_at desc
limit 200;
```

```sql
-- 3) 1時間以内 failed 件数と閾値判定（例: 5件）
with failed_stats as (
  select count(*)::int as failed_last_hour
  from public.medical_record_ai_video_jobs
  where status = 'failed'
    and completed_at >= now() - interval '1 hour'
)
select
  failed_last_hour,
  5 as threshold,
  (failed_last_hour >= 5) as alert_triggered
from failed_stats;
```

```sql
-- 4) tier別 成功率（24時間）
with base as (
  select
    tier,
    status
  from public.medical_record_ai_video_jobs
  where created_at >= now() - interval '24 hour'
)
select
  tier,
  count(*) as total_jobs,
  count(*) filter (where status = 'completed') as completed_jobs,
  count(*) filter (where status = 'failed') as failed_jobs,
  round(
    100.0 * (count(*) filter (where status = 'completed')) / nullif(count(*), 0),
    2
  ) as success_rate_percent
from base
group by tier
order by tier;
```

## 障害時対応
1. 新規APIのみを一時停止する（UIボタンを非表示、または該当エンドポイントを一時的に無効化）。
2. 既存写真カルテ導線は継続運用する（本機能は追加実装のため分離可能）。
3. DBは破壊的ロールバックを行わず、原因修正SQLを追加適用する。
4. `job_runs` とアプリログで失敗箇所（RLS/列不足/Storageコピー失敗）を特定する。

## 完了判定
1. 既存写真カルテの回帰なし。
2. 動画保存・サムネ・LINE短尺が本番で動作。
3. AI Assist/Pro/Pro+の契約状態・表示制御・APIゲートが一致。
4. 容量上限到達時に既存追加容量課金導線へ遷移。

## PR提出前チェック（動画AI段階実装）
### 1) PR本文テンプレート
```md
## 概要
- Assist / Pro / Pro+ の動画機能をプラン境界どおりに実装
- Pro+ のみ外部動画AIを利用し、Assist/Proでは非利用を担保
- `/dev/cron` に動画AIジョブ監視（閾値アラート含む）を追加

## 変更範囲
- API: `api/medical-records/videos/*`, `api/cron/medical-record-ai-video`, `api/admin/cron/medical-record-ai-video/dashboard`
- Service: `src/lib/ai/*`, `src/lib/cron/services/medical-record-ai-video*.ts`, `src/lib/medical-records/*`
- UI: `MedicalRecordVideoAiActions`, `/dev/cron` 監視カード
- SQL: `supabase_medical_record_ai_video_jobs.sql`（既存非破壊）
- Docs: Runbook / .env サンプル / staging check template

## 互換性・安全性
- 既存写真カルテAPI/DBは破壊的変更なし
- 既存ジョブキュー（queued -> processing -> completed|failed）を踏襲
- プランゲート: 契約外tierは403

## 検証結果
- `npm run lint`: pass
- `npm run build`: pass
- Step 9-2（staging実API疎通）は別途実施予定
```

### 2) レビュー確認観点
1. Pro+ 以外から `videoAI.*` が呼ばれていないこと。
2. `AI_LLM_PROVIDER` / `VIDEO_AI_PROVIDER` が `mock` と `external` で安全に切替できること。
3. `medical_record_ai_video_jobs` の `provider` / `result_payload.provider` / `error_message` が追跡可能であること。
4. `/dev/cron` で failed 閾値超過時に警告表示されること。
5. 既存の写真カルテ導線（作成/編集/共有）が回帰していないこと。

### 3) スクリーンショット取得項目
1. カルテ動画タブ（Assist契約時）: Assist操作のみ表示。
2. カルテ動画タブ（Pro契約時）: Pro操作が表示、Pro+操作は非表示。
3. カルテ動画タブ（Pro+契約時）: Pro+操作とハイライト生成導線が表示。
4. `/dev/cron` 動画AIジョブ監視カード（通常時）。
5. `/dev/cron` failed閾値超過アラート表示時。
6. `/billing` の AIプラン選択UI（Assist/Pro/Pro+）。

### 4) 差分整理コマンド（PR作成直前）
```bash
git status --short
git diff --stat
git diff -- TASKS.md docs/video-ai-rollout-runbook.md groomer_app/.env.billing.example
git diff -- groomer_app/src/lib/ai groomer_app/src/lib/cron/services groomer_app/src/components/dev/CronJobsManager.tsx
```
