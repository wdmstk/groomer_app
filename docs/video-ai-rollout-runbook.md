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
5. `supabase/supabase_medical_record_ai_assist.sql`
6. `supabase/supabase_medical_record_ai_pro_insights.sql`
7. `supabase/supabase_medical_record_ai_pro_plus.sql`
8. `supabase/supabase_multistore_rls.sql`

## なぜこの順序か
1. 先に動画テーブル/バケットを作ることで、動画保存APIの参照先を確保する。
2. 次にAIタグ・AIプラン列・Assist/Pro/Pro+テーブルを作り、APIが参照する列/テーブルを先に準備する。
3. 最後にRLSを適用して、新規テーブルを既存マルチ店舗制御へ統合する。

## 実施手順（ステージング）
1. ステージングのDBバックアップを取得する。
2. 上記の順序でSQLを適用する（`if not exists` を含むため再実行可能）。
3. Next.jsステージングを最新 `main` でデプロイする。
4. 主要機能を確認する。
  - 写真カルテ作成/編集/共有が従来どおり動く
  - 動画アップロード・再生・サムネ生成・LINE短尺送信が動く
  - `/billing` の AI Assist / Pro / Pro+ 切替表示と保存が動く
  - AI Assist / Pro / Pro+ APIがプランゲートどおり動く

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
    'medical_record_ai_pro_insights',
    'medical_record_ai_pro_plus_health_insights',
    'store_ai_monthly_reports'
  )
order by tablename;
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
