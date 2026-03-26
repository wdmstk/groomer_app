# 電子同意書（施術同意書）機能仕様書

更新日: 2026-03-26  
Task ID: `TASK-422`

## 1. 目的と利用シーン
- 施術前同意書を紙から電子化し、顧客/ペット単位で取得・保存・検索できるようにする。
- 店頭端末署名とLINE経由の遠隔署名の両方に対応する。
- テンプレート改訂時に版管理し、旧版も参照可能にする。

## 2. 店舗側操作フロー
1. 顧客詳細またはペット詳細から「同意書作成」。
2. 同意書テンプレートを選択（公開版のみ）。
3. 顧客・ペット・施術情報を差し込み表示で確認。
4. 署名方法を選択。
5. 店頭署名: その場で顧客に端末を渡して署名。
6. 遠隔署名: LINEで署名URL送信。
7. 署名完了後、PDF自動生成・保存。
8. カルテ画面に同意状況を反映（有効/未署名/期限切れ）。

## 3. 顧客側署名フロー（スマホ）
1. URLを開く。
2. 同意書本文を確認。
3. 必須チェック項目に同意。
4. 署名キャンバスに手書き署名。
5. 送信で署名完了。
6. 完了画面でPDF閲覧リンクを表示。

## 4. テンプレート編集機能
- 店舗ごとにテンプレート管理。
- ステータス: `draft / published / archived`。
- `published` 後は編集不可。複製して新版本を作成。
- 差し込み変数例:
  - `{{store_name}}`
  - `{{customer_name}}`
  - `{{pet_name}}`
  - `{{service_name}}`
  - `{{consent_date}}`

## 5. 署名技術仕様
- 署名画像: `PNG`（base64受信→ストレージ保存）。
- 署名補助データ: ストロークJSON（任意）。
- 署名日時: サーバ時刻を正とする。
- 証跡データ:
  - `ip_hash`
  - `user_agent_hash`
  - `device_type`
  - `signed_at`
- 改ざん検知:
  - 署名時点本文の `document_hash (SHA-256)` を保存。

## 6. データ構造（新規）
### `consent_templates`
- `id`, `store_id`, `name`, `category`, `status`, `current_version_id`, timestamps

### `consent_template_versions`
- `id`, `template_id`, `store_id`, `version_no`, `title`, `body_html`, `body_text`, `document_hash`, `published_at`, timestamps

### `consent_documents`
- `id`, `store_id`, `customer_id`, `pet_id`, `template_id`, `template_version_id`, `status`, `expires_at`, `signed_at`, `pdf_path`, timestamps

### `consent_signatures`
- `id`, `store_id`, `document_id`, `signer_name`, `signature_image_path`, `signature_strokes`, `consent_checked`, `signed_at`, `ip_hash`, `ua_hash`, `device_type`

### `consent_delivery_logs`
- `id`, `store_id`, `document_id`, `channel`, `target`, `status`, `sent_at`, `error_message`

### `consent_audit_logs`
- `id`, `store_id`, `entity_type`, `entity_id`, `action`, `actor_user_id`, `payload`, `created_at`

## 7. 履歴管理
- 顧客・ペット詳細に同意書履歴タブを追加。
- 表示項目:
  - 同意書名
  - 版
  - 署名日時
  - ステータス
  - 署名方法（店頭/LINE）
  - PDFリンク
- 過去版閲覧可、編集不可。
- 再署名ボタンで新規ドキュメント発行。

## 8. PDF生成仕様
- 署名完了時にバックグラウンド生成。
- PDF内容:
  - 店舗情報
  - 顧客/ペット情報
  - テンプレート本文（署名時点固定）
  - 署名画像
  - 署名日時
  - 文書ID/版/document_hash
- 生成失敗時は再生成ジョブキューにリトライ。

## 9. セキュリティ要件
- `store_id` スコープRLS必須。
- 署名URLはワンタイムトークン + 有効期限。
- 顧客公開エンドポイントは最小情報のみ返却。
- 署名画像/PDFはprivateバケット保存。
- 重要操作は監査ログに記録。

## 10. 法的観点（実装必須項目）
- 同意対象の明示（文書タイトル/内容）。
- 同意主体の特定（氏名 + 顧客/ペット紐付け）。
- 同意日時（サーバ時刻）。
- 同意行為証跡（チェック + 署名 + 端末/ネットワーク情報）。
- 同意時点本文の固定（版 + ハッシュ）。

## 11. UIワイヤー（テキスト）
### 店舗: 顧客詳細 > 同意書タブ
- ヘッダー: 現在有効な同意書ステータス
- アクション: `同意書作成` `LINE送信` `店頭署名開始`
- 一覧: 履歴テーブル

### 店舗: テンプレート管理
- 左: テンプレート一覧
- 右: エディタ + プレビュー
- 下: 版履歴

### 顧客: 署名画面
- 本文
- 同意チェック
- 署名キャンバス
- 送信ボタン

## 12. API仕様（初期）
### テンプレート作成
- `POST /api/consents/templates`

### テンプレート版公開
- `POST /api/consents/templates/:template_id/versions`

### 同意ドキュメント作成
- `POST /api/consents/documents`

### 署名URL取得（公開）
- `GET /api/public/consents/:token`

### 署名送信（公開）
- `POST /api/public/consents/:token/sign`

### 同意履歴一覧
- `GET /api/consents/documents?customer_id=&pet_id=`

### PDF取得
- `GET /api/consents/documents/:document_id/pdf`

### 再送/失効
- `POST /api/consents/documents/:document_id/resend`
- `POST /api/consents/documents/:document_id/revoke`

## 13. 通知・リマインド
- 署名依頼をLINE送信。
- 未署名リマインド:
  - 24時間後
  - 72時間後
  - 期限前日
- 店舗向けダッシュボードに未署名件数を表示。

## 14. 運用注意点
- 本人確認の運用ルールをスタッフへ周知。
- 施術開始前チェックに「同意済み」を含める。
- テンプレート更新時は再署名対象を明確化。

## 15. 将来拡張
- AIによるリスク説明文の自動生成。
- ペット属性に応じた同意書テンプレ自動提案。
- 多言語同意書。
- 電子契約サービス連携（高度署名）。

