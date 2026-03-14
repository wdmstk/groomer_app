# Supabase Auth を使ったログイン機能の設計

Supabase Auth を使用して、安全で効率的なログイン機能を実装します。Next.js の API Routes と連携し、セッション管理を行います。

## 1. 認証フロー

1.  **ログインページ (`/login`)**: ユーザーはメールアドレスとパスワードを入力します。
2.  **API Routesへのリクエスト**: ログインフォームの送信時に、Next.js の API Routes (`POST /api/auth/login`) へ認証情報が送られます。
3.  **Supabase Authによる認証**: API Routesは、`@supabase/supabase-js` を使用してSupabase Authの `signInWithPassword` メソッドを呼び出します。これにより、Supabaseがユーザーの認証情報を検証します。
4.  **セッションの確立**: 認証が成功すると、Supabase Authはセッション情報を返します。Next.js の API Routesは、このセッション情報をセキュアなHTTP Onlyクッキーとしてクライアントに設定します。
5.  **リダイレクト**: 認証成功後、ユーザーはダッシュボード（例: `/dashboard`）へリダイレクトされます。
6.  **セッションの取得**: ダッシュボードの各ページやAPI Routesでは、クッキーからセッション情報を取得し、`createMiddlewareClient` や `createClientComponentClient`、`createServerComponentClient` といったSupabaseのヘルパー関数を用いて認証済みのSupabaseクライアントを初期化します。これにより、RLSが適用されたデータベースへのアクセスが可能になります。

## 2. ユーザー登録フロー（管理者向け）

このシステムはトリミングサロンのスタッフ向けであり、一般顧客が自由に登録するものではないため、管理者または特定の権限を持つユーザーが新規スタッフを登録するフローを想定します。

1.  **スタッフ登録フォーム**: 管理者用の画面（例: `/dashboard/settings/staffs/new`）で、新規スタッフの氏名、メールアドレス、初期パスワードなどを入力します。
2.  **API Routesへのリクエスト**: フォーム送信時に、Next.js の API Routes (`POST /api/staffs`) へスタッフ情報が送られます。
3.  **Supabase Authによるユーザー作成**: API Routesは、Supabase Authの `admin.createUser` メソッド（サービスロールキーを使用）を呼び出し、新しいユーザーをSupabase Authに登録します。この際、`email_confirm` を `true` に設定することでメール認証をスキップできます（内部管理システムのため）。
4.  **スタッフ情報とSupabase Authユーザーの紐づけ**: `public.staffs` テーブルにスタッフ情報を挿入する際、Supabase Authで作成されたユーザーの `id` を `staffs.user_id` として紐づけます。これにより、`auth.users` テーブルと `public.staffs` テーブルの連携が可能です。
5.  **役割 (Roles) の設定**: SupabaseのカスタムクレームやRLSポリシーと連携させることで、登録されたスタッフに「管理者」や「一般スタッフ」といった役割を付与し、アクセス制御を行うことができます。

## 3. ログアウト機能

1.  **ログアウトボタン**: アプリケーションのヘッダーやサイドバーにログアウトボタンを配置します。
2.  **API Routesへのリクエスト**: ボタンクリック時に、Next.js の API Routes (`POST /api/auth/logout`) へリクエストを送ります。
3.  **Supabase Authによるサインアウト**: API Routesは、Supabase Authの `signOut` メソッドを呼び出します。
4.  **セッションの破棄**: Supabaseのセッションクッキーがクリアされ、クライアント側でもセッション情報が破棄されます。
5.  **リダイレクト**: ユーザーはログインページ (`/login`) へリダイレクトされます。

## 4. Supabase Authの活用ポイント

*   **JWT (JSON Web Tokens)**: Supabase AuthはJWTを利用してセッションを管理します。このトークンは、RLSポリシーを通じてデータベースへのアクセス制御に利用されます。
*   **Row Level Security (RLS)**: `public.staffs` テーブルと `auth.users` テーブルを連携させ、`auth.uid()` を利用して、ログイン中のユーザーが自身のスタッフ情報や、権限に応じてアクセス可能な顧客情報のみにアクセスできるようにRLSを設定します。
*   **カスタムクレーム**: ユーザーに「管理者」「一般スタッフ」などの役割を付与したい場合、Supabase Authのカスタムクレーム機能を利用できます。これにより、JWT内に役割情報を含ませ、API RoutesやRLSで利用することが可能になります。
    *   例: `ALTER ROLE authenticated SET "app.role" = 'staff';`
*   **Supabase Client Helpers**: Next.js (App Router) 環境でSupabase Authを扱うための便利なヘルパー関数が `@supabase/ssr` パッケージから提供されています。
    *   `createServerComponentClient`: サーバーコンポーネントやAPI Routesで認証済みクライアントを取得。
    *   `createClientComponentClient`: クライアントコンポーネントで認証済みクライアントを取得。
    *   `createMiddlewareClient`: ミドルウェアで認証済みクライアントを取得。

## 5. 実装時の考慮事項

*   **環境変数**: SupabaseのAPIキー（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` など）は `.env.local` で管理し、本番環境ではVercelの環境変数に設定します。特に `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドでのみ使用し、クライアントサイドに漏洩しないように厳重に管理します。
*   **漏えいパスワード対策**: Supabase Dashboard の `Authentication > Providers > Email` にある `Leaked password protection` を有効化し、HaveIBeenPwned に登録済みのパスワードを拒否します。
*   **パスワードリセット**: 必要に応じて、Supabase Authのパスワードリセット機能（`resetPasswordForEmail`）を実装します。
*   **UIフィードバック**: ログインフォームの送信中やエラー発生時に、適切なローディング表示やエラーメッセージをユーザーにフィードバックします。

この設計により、Supabase Authの機能を最大限に活用し、セキュアで管理しやすい認証システムを構築できます。
