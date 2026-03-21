# 動画AI Step 9-2 実行結果テンプレート

実施日: YYYY-MM-DD  
実施者:  
対象環境: staging  
対象コミット:  

## 前提
- `AI_LLM_PROVIDER`:
- `VIDEO_AI_PROVIDER`:
- `AI_LLM_*MODEL`:
- `VIDEO_AI_*URL`:

## 検証マトリクス結果
| Case | 契約AIプラン | 実行tier | 期待 | 実結果 | 判定 |
|---|---|---|---|---|---|
| 1 | assist | assist | 202 + completed |  |  |
| 2 | assist | pro | 403 |  |  |
| 3 | pro | pro | 202 + completed |  |  |
| 4 | pro | pro_plus | 403 |  |  |
| 5 | pro_plus | pro_plus | 202 + completed |  |  |
| 6 | pro_plus | pro_plus（retry） | 失敗から復旧 |  |  |

## SQL確認結果（抜粋）
### 最新ジョブ状態/provider
```sql
-- 実行したSQLを貼る
```

### 1時間以内failed件数/閾値判定
```sql
-- 実行したSQLを貼る
```

### tier別成功率（24h）
```sql
-- 実行したSQLを貼る
```

## 失敗時の詳細
- `job_runs.last_error`:
- `medical_record_ai_video_jobs.error_message`:
- 再実行手順:
- 復旧可否:

## 結論
- Step 9-2 完了可否:
- 残課題:
- 次アクション:
