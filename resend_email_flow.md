# Resend を使ったメール通知フロー

Resend を利用して、トリミングサロンの顧客やスタッフへのメール通知機能を実装します。Next.js の API Routes を介して Resend API を安全に呼び出します。

## 1. メール通知の目的とトリガー

| 通知の種類         | 目的                     | トリガーとなるイベント                                    | 受信者         |
| :----------------- | :----------------------- | :-------------------------------------------------------- | :------------- |
| 予約完了通知       | 予約が正常に受け付けられたことを顧客に伝える | `POST /api/appointments` 成功時                         | 顧客           |
| 予約変更通知       | 予約内容が変更されたことを顧客に伝える | `PUT /api/appointments` で予約情報が更新された時      | 顧客           |
| 予約キャンセル通知 | 予約がキャンセルされたことを顧客に伝える | `PUT /api/appointments` でステータスが「キャンセル」になった時 | 顧客           |
| 予約前日リマインド | 予約忘れ防止             | Vercel Cron Jobs (`GET /api/cron/remind-appointments`) で翌日予約が検出された時 | 顧客           |
| 管理者向け通知     | 特定の重要なイベント発生 | 例: 新規顧客登録、大規模な予約変更など                   | サロン管理者   |

## 2. 全体フロー

1.  **イベント発生**: Next.js アプリケーション内でメール通知が必要なイベント（例: 予約登録成功）が発生します。
2.  **API Routesへのリクエスト**: クライアントサイドまたはサーバーサイドのコードから、対応する Next.js API Routes (`POST /api/notify/email`) へメール送信のリクエストを送ります。リクエストには、送信先、件名、本文などの情報を含めます。
3.  **Resend APIの呼び出し**: API Routes は、`@resend/node` ライブラリを使用して Resend API を呼び出し、メールを送信します。
4.  **レスポンス**: Resend API からの応答を受け取り、成功/失敗をクライアントに返します。

## 3. 実装詳細

### 3.1. Resend の設定

1.  **APIキーの取得**: ResendのダッシュボードでAPIキーを発行します。
2.  **環境変数への設定**: 取得したAPIキーを `.env.local` ファイルに設定します。
    ```
    RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
    ```
3.  **ドメインの認証**: Resendでメールを送信するドメインを認証します。これにより、信頼性が向上し、SPF/DKIM/DMARCの設定が可能になります。

### 3.2. Resend クライアントの初期化 (`src/lib/resend.ts`)

Resend クライアントを初期化し、メール送信ヘルパー関数を提供します。

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string; // または text: string
  from?: string; // 例: 'onboarding@resend.dev'
}

export async function sendEmail({ to, subject, html, from = 'onboarding@resend.dev' }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: from,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
    console.log('Email sent successfully:', data);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in sendEmail function:', error);
    return { success: false, error: error.message || 'An unknown error occurred' };
  }
}
```

### 3.3. Next.js API Routes (`src/app/api/notify/email/route.ts`)

フロントエンドまたはサーバーサイドからメール送信リクエストを受け取り、`sendEmail` ヘルパー関数を呼び出します。

```typescript
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend'; // 作成したヘルパー関数をインポート

export async function POST(request: Request) {
  const { to, subject, html, from } = await request.json();

  if (!to || !subject || !html) {
    return NextResponse.json({ error: 'Missing required fields (to, subject, html)' }, { status: 400 });
  }

  // 認証チェックをここに追加することも検討（例: 管理者ユーザーのみメール送信APIを叩ける）

  const { success, error } = await sendEmail({ to, subject, html, from });

  if (success) {
    return NextResponse.json({ message: 'Email sent successfully' });
  } else {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
```

### 3.4. 予約登録APIからの呼び出し (`POST /api/appointments/route.ts` の例)

予約登録成功時にメール通知をトリガーする例です。

```typescript
// src/app/api/appointments/route.ts (抜粋)

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
// import { Database } from '@/types/supabase';

export async function POST(request: Request) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { customer_id, pet_id, staff_id, start_time, end_time, menu, duration, notes } = await request.json();

  // ... 予約重複チェックなどのロジック ...

  const { data: appointment, error: dbError } = await supabase
    .from('appointments')
    .insert({ customer_id, pet_id, staff_id, start_time, end_time, menu, duration, notes })
    .select()
    .single();

  if (dbError) {
    console.error('Failed to create appointment:', dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // --- メール通知をトリガー --- 
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('email, full_name')
    .eq('id', customer_id)
    .single();

  if (customerData && customerData.email) {
    const emailSubject = `予約完了のお知らせ: ${menu}`;
    const emailHtml = `
      <p>${customerData.full_name}様</p>
      <p>トリミングのご予約が完了しました。</p>
      <p>日時: ${new Date(start_time).toLocaleString()}</p>
      <p>メニュー: ${menu}</p>
      <p>ご来店お待ちしております。</p>
    `;

    // 内部APIを呼び出す
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notify/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: customerData.email,
        subject: emailSubject,
        html: emailHtml,
      }),
    });
  }
  // --------------------------

  return NextResponse.json(appointment);
}
```

### 3.5. メールテンプレートの利用

ResendはReactベースのメールテンプレートもサポートしています。`src/emails/` ディレクトリなどにReactコンポーネントとしてテンプレートを定義し、`resend.emails.send` で `react` プロパティを使用することで、よりリッチなメールを送信できます。

*   例: `src/emails/AppointmentConfirmation.tsx`

## 4. その他の考慮事項

*   **エラー監視とリトライ**: メール送信は外部サービスに依存するため、失敗時のエラー監視と必要に応じたリトライメカニズム（Supabase Functionsや専用のキューサービスなど）を検討します。
*   **Fromアドレス**: 送信元メールアドレス (`from`) はResendで認証済みのものを使用します。
*   **パーソナライズ**: 顧客名や予約内容を動的にメール本文に含めることで、パーソナライズされた通知を提供します。
*   **バッチ送信**: 予約リマインドなど、複数のメールを一度に送信する際は、Resendのバッチ送信機能を利用してAPIコール数を最適化できます。

このフローにより、効果的なメール通知システムをResendを使って構築できます。