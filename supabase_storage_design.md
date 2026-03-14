# Supabase Storage を使った写真アップロード機能の設計

Supabase Storage を利用して、ペットの施術前後や皮膚トラブルなどの写真を安全かつ効率的にアップロード・管理する機能を設計します。

## 1. 全体フロー

1.  **ファイル選択**: クライアント側（Next.jsのフロントエンド）でユーザーが写真ファイルを選択します。
2.  **API Routesへのアップロードリクエスト**: 選択されたファイルは、`FormData` を使用してNext.js の API Routes (`POST /api/upload`) へ送信されます。
3.  **Supabase Storageへのアップロード**: API Routesは、`@supabase/supabase-js` を使用してSupabase Storageの `upload` メソッドを呼び出し、ファイルを指定されたバケットとパスにアップロードします。
4.  **公開URLの取得とデータベース保存**: アップロード成功後、Supabase Storageからファイルの公開URL（または署名付きURL）を取得し、このURLを `medical_records` テーブルの `photos` カラムに保存します。
5.  **レスポンス**: アップロードされたファイルのURLをクライアントに返します。

## 2. 実装詳細

### 2.1. Supabase Storage の設定

1.  **バケットの作成**: Supabaseプロジェクト内で、写真保存用のバケットを作成します。例えば `pet-photos` とします。
2.  **ポリシー (Security Policy) の設定**: バケットに対してRLS（Row Level Security）ポリシーを設定し、認証されたユーザーのみがファイルをアップロード、読み取り、削除できるようにします。例えば、`auth.uid()` が存在する場合のみアクセスを許可するポリシーを設定します。
    *   **Insert Policy (アップロード)**:
        ```sql
        CREATE POLICY 