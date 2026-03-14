# 全体アーキテクチャ

## 概要

本システムは、Next.jsをフロントエンドおよびAPI Routes、Supabaseをバックエンド（データベース、認証、ストレージ）、Resendをメール通知、LINE Messaging APIを予約リマインドに利用し、Vercelでホスティングする無料スタックで構築されます。

## 各コンポーネントの役割

### 1. Next.js (Frontend & API Routes)

*   **Frontend**: ユーザーインターフェース（UI）を提供し、顧客管理、予約管理、ペットカルテ管理の各画面をレンダリングします。App Routerを使用し、サーバーコンポーネントとクライアントコンポーネントを適切に使い分けます。
*   **API Routes**: Supabaseとの連携、ResendやLINE Messaging APIの呼び出し、複雑なビジネスロジックの実行など、サーバーサイドの処理を担当します。認証ミドルウェアを介してセキュリティを確保します。

### 2. Supabase

*   **PostgreSQL Database**: 顧客情報、ペット情報、予約、来店履歴、カルテなどのすべてのデータを格納します。RLS（Row Level Security）を適用し、データのセキュリティを確保します。
*   **Auth**: ユーザー認証（メールアドレス/パスワード、OAuthなど）を提供します。Next.jsアプリケーションと連携し、セッション管理を行います。
*   **Storage**: ペットの写真や施術前後の写真などの画像ファイルを保存します。認証されたユーザーのみがアクセスできるように設定します。

### 3. Resend

*   **メール通知**: 予約完了通知、予約前日リマインド、キャンセル通知など、ユーザーへのメール送信を行います。Next.jsのAPI RoutesからResend APIを呼び出します。

### 4. LINE Messaging API

*   **予約リマインド**: 予約日の前日にLINEメッセージでリマインドを送信します。SupabaseのWebhookやNext.jsのAPI RoutesからLINE Messaging APIを呼び出します。

### 5. Vercel

*   **ホスティング**: Next.jsアプリケーションをデプロイし、公開します。サーバーレスファンクション（API Routes）もVercel上で実行されます。

## データフロー概要

1.  **ユーザーアクセス**: ユーザー（トリミングサロンのスタッフ）がVercelにデプロイされたNext.jsアプリケーションにアクセスします。
2.  **認証**: Supabase Authを介してログインし、認証トークンを取得します。
3.  **データ操作**: Next.jsのフロントエンドからAPI Routesを呼び出し、API RoutesがSupabaseのデータベース、Auth、Storageと連携してデータを操作します。
4.  **通知**: 予約登録や変更時、Next.jsのAPI RoutesがResendやLINE Messaging APIを呼び出し、メールやLINEメッセージを送信します。
5.  **スケジュールされたタスク**: 予約前日リマインドなど、定期的な処理はSupabaseのFunctions（Edge Functions）やNext.jsのAPI RoutesとVercel Cron Jobsなどを組み合わせて実現します。

```mermaid
graph TD
    A[ユーザー (Webブラウザ)] -->|アクセス| B(Vercel)
    B -->|Next.js App| C(Next.js Frontend)
    C -->|API Call| D(Next.js API Routes)
    D -->|DB/Auth/Storage| E(Supabase)
    D -->|Send Email| F(Resend)
    D -->|Send LINE Message| G(LINE Messaging API)
    E -->|Database| H(PostgreSQL)
    E -->|Authentication| I(Supabase Auth)
    E -->|File Storage| J(Supabase Storage)
```

## セキュリティ考慮事項

*   **Supabase RLS**: データベースへのアクセスはRLSによって厳密に制御されます。
*   **API Routes認証**: API RoutesはNext.js Authなどのミドルウェアによって保護され、認証されたユーザーのみがアクセスできるようにします。
*   **環境変数**: APIキーやシークレットは環境変数として安全に管理します（Vercelの環境変数など）。

## スケーラビリティ

*   **Next.js (Vercel)**: サーバーレス構成のため、必要に応じて自動的にスケールします。
*   **Supabase**: PostgreSQLは高いスケーラビリティを持ち、AuthやStorageも多くの負荷に対応できます。
*   **Resend/LINE Messaging API**: 各サービスのAPIは高い信頼性とスケーラビリティを提供します。