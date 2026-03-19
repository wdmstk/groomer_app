# Backup Runbook

このドキュメントは、`groomer_app` の本番運用向けバックアップ手順です。  
対象は Supabase DB と Supabase Storage（既定: `pet-photos`）です。

## 1. 対象と方針

- DB: 日次フルバックアップ（`pg_dump --format=custom`）
- Storage: 日次フルバックアップ（オブジェクト全件ダウンロード）
- 保持期間: 30日（必要に応じて延長）

## 2. 前提

- `pg_dump` が実行環境にインストール済み
- Node.js 18+（`fetch` 利用のため）
- `@supabase/supabase-js` はプロジェクト依存関係として導入済み
- バックアップ保存先が確保済み（例: `/var/backups/groomer_app`）

## 3. 環境変数

`/etc/groomer_backup.env` のような root のみ読み取り可能ファイルに保存します。

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:6543/postgres?sslmode=require
SUPABASE_UPLOAD_BUCKET=pet-photos
BACKUP_DIR=/var/backups/groomer_app
```

## 4. 手動実行

リポジトリルート: `/mnt/c/xampp/htdocs/groomer_app/groomer_app`

```bash
source /etc/groomer_backup.env
bash ./scripts/backup_db.sh
node ./scripts/backup_storage.mjs
```

## 5. cron 登録例

JST サーバー前提の例です。

```cron
0 2 * * * /bin/bash -lc 'source /etc/groomer_backup.env && cd /mnt/c/xampp/htdocs/groomer_app/groomer_app && bash ./scripts/backup_db.sh'
20 2 * * * /bin/bash -lc 'source /etc/groomer_backup.env && cd /mnt/c/xampp/htdocs/groomer_app/groomer_app && node ./scripts/backup_storage.mjs'
40 2 * * * /bin/bash -lc 'source /etc/groomer_backup.env && find "$BACKUP_DIR" -type f -mtime +30 -delete'
```

## 6. 生成物

- DB: `${BACKUP_DIR}/db/db_YYYY-MM-DD_HHMMSS.dump`
- Storage: `${BACKUP_DIR}/storage_YYYY-MM-DD_<timestamp>/...`
- Storage manifest: `manifest.json`

`manifest.json` には成功件数と失敗件数が記録されます。  
失敗件数が0でない場合は再実行してください。

## 7. 復元手順（最小）

### 7.1 DB 復元

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$SUPABASE_DB_URL" \
  /path/to/db_YYYY-MM-DD_HHMMSS.dump
```

### 7.2 Storage 復元

1. バックアップディレクトリ配下のファイルを列挙  
2. Supabase Storage の同一バケットへ再アップロード  
3. `manifest.json` の `failureCount` を確認

補足: 復元直後は `/api/cron/scan-storage-orphans` を手動実行し、DB参照とStorage実体の差分を点検してください。

## 8. 月次点検

- ランダムに1日分を選び、ステージングに復元して整合性を確認
- `medical_record_photos.storage_path` のサンプルが実ファイルと一致するか確認
- 失敗が続く場合は、`SUPABASE_SERVICE_ROLE_KEY` の権限と期限を確認
