# Next.js (App Router) フォルダ構成案

Next.jsのApp Routerをベースとしたフォルダ構成案を提案します。これにより、コードのモジュール性、保守性、スケーラビリティを向上させます。

```
groomer_app/
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── public/
│   ├── images/
│   │   └── logo.png
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── customers/
│   │   │   │   ├── [customer_id]/
│   │   │   │   │   ├── pets/
│   │   │   │   │   │   ├── [pet_id]/
│   │   │   │   │   │   │   ├── medical-records/
│   │   │   │   │   │   │   │   ├── [record_id]/
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── appointments/
│   │   │   │   │   │   ├── [appointment_id]/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── appointments/
│   │   │   │   └── page.tsx
│   │   │   ├── medical-records/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   ├── page.tsx (dashboard home)
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   └── logout/route.ts
│   │   │   ├── customers/
│   │   │   │   ├── [customer_id]/
│   │   │   │   │   ├── pets/
│   │   │   │   │   │   ├── [pet_id]/
│   │   │   │   │   │   │   ├── medical-records/route.ts
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── appointments/route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── appointments/
│   │   │   │   ├── [appointment_id]/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── medical-records/
│   │   │   │   ├── [record_id]/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── staffs/
│   │   │   │   ├── [staff_id]/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── upload/
│   │   │   │   └── route.ts (Supabase Storage)
│   │   │   └── notify/
│   │   │       ├── email/route.ts (Resend)
│   │   │       └── line/route.ts (LINE Messaging API)
│   │   ├── global.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── ... (shadcn/uiなどの汎用UIコンポーネント)
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── customers/
│   │   │   ├── CustomerList.tsx
│   │   │   ├── CustomerForm.tsx
│   │   │   └── ...
│   │   ├── pets/
│   │   │   └── ...
│   │   ├── appointments/
│   │   │   └── ...
│   │   └── medical-records/
│   │       └── ...
│   ├── lib/
│   │   ├── supabase/ (Supabaseクライアント初期化、ユーティリティ)
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   │   └── utils.ts
│   │   ├── api/
│   │   │   ├── customers.ts (Supabaseからのデータ取得ロジック)
│   │   │   ├── pets.ts
│   │   │   └── ...
│   │   ├── auth.ts (認証関連のヘルパー関数)
│   │   ├── resend.ts (Resendクライアント初期化、メール送信ヘルパー)
│   │   └── line.ts (LINEクライアント初期化、メッセージ送信ヘルパー)
│   ├── hooks/
│   │   ├── useCustomers.ts (SWR/React QueryなどデータフェッチングHooks)
│   │   ├── useAuth.ts
│   │   └── useForm.ts
│   ├── types/
│   │   ├── supabase.ts (Supabase CLIで生成される型定義)
│   │   ├── customer.ts
│   │   ├── pet.ts
│   │   └── ... (各種エンティティの型定義)
│   └── utils/
│       ├── date.ts (日付フォーマット、計算などのユーティリティ)
│       ├── helpers.ts
│       └── validation.ts
├── .env.local
├── next.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## 各ディレクトリ・ファイルの役割詳細

*   `public/`: 静的ファイル（画像、faviconなど）。
*   `src/`: アプリケーションの主要なソースコード。
    *   `app/`: App Routerのルートディレクトリ。ルーティングとUIのコケーションを管理します。
        *   `(auth)/`: 認証関連のルートグループ（例: `/login`）。共通のレイアウトを持つことができます。
            *   `login/page.tsx`: ログインページのUI。
            *   `layout.tsx`: 認証関連ページに適用される共通レイアウト。
        *   `(dashboard)/`: ログイン後の主要な業務管理画面のルートグループ。共通のサイドバーやヘッダーを持つことができます。
            *   `customers/page.tsx`: 顧客一覧ページ。
            *   `customers/[customer_id]/page.tsx`: 特定の顧客詳細ページ。
                *   `pets/page.tsx`: 顧客に紐づくペット一覧。
                *   `pets/[pet_id]/page.tsx`: 特定のペット詳細。
                    *   `medical-records/page.tsx`: ペットのカルテ一覧。
                    *   `medical-records/[record_id]/page.tsx`: 特定のカルテ詳細。
            *   `appointments/page.tsx`: 予約カレンダーまたは一覧ページ。
            *   `medical-records/page.tsx`: 全カルテ一覧（またはペット一覧から遷移）。
            *   `settings/page.tsx`: アプリケーション設定画面。
            *   `page.tsx`: ダッシュボードのホーム（トップ）ページ。
            *   `layout.tsx`: ダッシュボードに適用される共通レイアウト（サイドバー、ヘッダーなど）。
        *   `api/`: API Routesを配置するディレクトリ。
            *   `auth/login/route.ts`: ログインAPIエンドポイント。
            *   `customers/route.ts`: 顧客のCRUD操作API。
            *   `customers/[customer_id]/route.ts`: 特定顧客のCRUD操作API。
            *   `upload/route.ts`: ファイルアップロードAPI（Supabase Storage連携）。
            *   `notify/email/route.ts`: Resendを使ったメール通知API。
            *   `notify/line/route.ts`: LINE Messaging APIを使った通知API。
        *   `global.css`: グローバルなスタイルシート。
        *   `layout.tsx`: アプリケーション全体のルートレイアウト。
    *   `components/`: UIコンポーネントを配置するディレクトリ。
        *   `ui/`: shadcn/uiのような汎用的なUIコンポーネント（ボタン、入力フィールドなど）。
        *   `common/`: アプリケーション全体で共通して使われるコンポーネント（ヘッダー、サイドバー、ローディングスピナーなど）。
        *   `[feature_name]/`: 特定の機能に特化したコンポーネント（例: `customers/CustomerList.tsx`）。
    *   `lib/`: 再利用可能なロジック、ユーティリティ関数、外部サービスSDKの初期化などを配置するディレクトリ。
        *   `supabase/`: Supabaseクライアントの初期化と関連ユーティリティ。
            *   `client.ts`: クライアントサイドで使用するSupabaseクライアント。
            *   `server.ts`: サーバーサイド（API Routesやサーバーコンポーネント）で使用するSupabaseクライアント。
            *   `utils.ts`: Supabase関連のヘルパー関数。
        *   `api/`: Supabaseからのデータフェッチングや書き込みロジックをカプセル化した関数群。
        *   `auth.ts`: 認証関連のヘルパー関数（セッション取得など）。
        *   `resend.ts`: Resendクライアントの初期化とメール送信機能。
        *   `line.ts`: LINE Messaging APIクライアントの初期化とメッセージ送信機能。
    *   `hooks/`: カスタムReactフックを配置するディレクトリ（データフェッチング、フォーム管理など）。
        *   `useCustomers.ts`: 顧客データをフェッチするためのカスタムフック。
        *   `useAuth.ts`: 認証状態を管理するためのカスタムフック。
    *   `types/`: TypeScriptの型定義を配置するディレクトリ。
        *   `supabase.ts`: Supabase CLIで自動生成されるデータベースの型定義。
        *   `customer.ts`, `pet.ts`, `appointment.ts` など: 各エンティティの具体的な型定義。
    *   `utils/`: 汎用的なユーティリティ関数（日付操作、バリデーションなど）。
        *   `date.ts`: 日付関連のヘルパー関数。
        *   `validation.ts`: 入力バリデーション関数。
*   `.env.local`: 環境変数を定義するファイル（本番環境ではVercelの環境変数設定を使用）。
*   `next.config.mjs`: Next.jsの設定ファイル。
*   `package.json`: プロジェクトの依存関係とスクリプト定義。
*   `tsconfig.json`: TypeScriptの設定ファイル。
*   `README.md`: プロジェクトの説明。

## Next.js App Router の特徴と活用

*   **サーバーコンポーネントとクライアントコンポーネント**: データフェッチングやデータベースアクセスはサーバーコンポーネントやAPI Routesで行い、インタラクティブなUIはクライアントコンポーネントで行います。これにより、初期ロードパフォーマンスを最適化します。
*   **レイアウトとルートグループ**: `(auth)` や `(dashboard)` のようなルートグループを活用し、認証状態に応じた異なるレイアウトを適用します。
*   **データフェッチング**: `fetch` APIを拡張したNext.jsのデータフェッチング機能や、SWR/React Queryなどのライブラリを`hooks`ディレクトリで活用します。

この構成により、大規模なアプリケーションでも管理しやすく、開発効率を向上させることができます。