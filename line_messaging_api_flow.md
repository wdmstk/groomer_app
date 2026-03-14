# LINE Messaging API を使った予約リマインドフロー

LINE Messaging API を利用して、顧客への予約リマインドメッセージを送信する機能を実装します。主に予約前日のリマインド通知に活用します。

## 1. LINE通知の目的とトリガー

| 通知の種類         | 目的                     | トリガーとなるイベント                                    | 受信者         |
| :----------------- | :----------------------- | :-------------------------------------------------------- | :------------- |
| 予約完了通知 (任意) | 予約が正常に受け付けられたことを顧客に伝える | `POST /api/appointments` 成功時（メールと併用または選択） | 顧客           |
| 予約前日リマインド | 予約忘れ防止             | Vercel Cron Jobs (`GET /api/cron/remind-appointments`) で翌日予約が検出された時 | 顧客           |

## 2. 全体フロー

1.  **顧客のLINE連携**: 顧客は、サロンが提供するLINE公式アカウントを友だち追加し、LINE ID とサロンの顧客情報を紐づける必要があります。これは、初回登録時やマイページなどでLINE連携ボタンを提供し、Oauth2.0連携を通じてユーザーIDを取得・保存するフローを想定します。（今回はシンプルな実装として、顧客情報にLINE IDを直接登録する形とします。実際の運用では、LINEのOAuth連携を通じてユーザーIDを取得するのがよりセキュアでユーザーフレンドリーです。）
2.  **イベント発生**: Next.js アプリケーション内でLINE通知が必要なイベント（例: 予約前日リマインドの実行）が発生します。
3.  **API Routesへのリクエスト**: サーバーサイドの処理（Vercel Cron JobsからのAPI Route呼び出し）から、対応する Next.js API Routes (`POST /api/notify/line`) へLINEメッセージ送信のリクエストを送ります。リクエストには、送信先LINE ID、メッセージ内容などの情報を含めます。
4.  **LINE Messaging APIの呼び出し**: API Routes は、`@line/bot-sdk` ライブラリを使用して LINE Messaging API を呼び出し、メッセージを送信します。
5.  **レスポンス**: LINE Messaging API からの応答を受け取り、成功/失敗を返します。

## 3. 実装詳細

### 3.1. LINE Messaging API の設定

1.  **LINE Developersアカウントの作成とプロバイダー作成**: LINE Developersサイトでアカウントを作成し、プロバイダーを作成します。
2.  **Messaging APIチャネルの作成**: プロバイダー内でMessaging APIチャネルを作成します。
3.  **チャネルアクセストークンとチャネルシークレットの取得**: 作成したチャネルの設定ページから「チャネルアクセストークン」と「チャネルシークレット」を取得します。
4.  **環境変数への設定**: 取得したトークンとシークレットを `.env.local` ファイルに設定します。
    ```
    LINE_CHANNEL_ACCESS_TOKEN=YOUR_CHANNEL_ACCESS_TOKEN
    LINE_CHANNEL_SECRET=YOUR_CHANNEL_SECRET
    ```

### 3.2. LINEクライアントの初期化 (`src/lib/line.ts`)

LINE Messaging API クライアントを初期化し、メッセージ送信ヘルパー関数を提供します。

```typescript
import { Client, ClientConfig, Message } from '@line/bot-sdk';

const clientConfig: ClientConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 
    (console.error("LINE_CHANNEL_ACCESS_TOKEN is not set"), ""),
  channelSecret: process.env.LINE_CHANNEL_SECRET || 
    (console.error("LINE_CHANNEL_SECRET is not set"), ""),
};

// 環境変数が設定されていない場合はクライアントを初期化しないか、エラーをスロー
const client = (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET)
  ? new Client(clientConfig)
  : null;

interface SendLineMessageOptions {
  to: string; // LINE User ID
  messages: Message[];
}

export async function sendLineMessage({ to, messages }: SendLineMessageOptions) {
  if (!client) {
    console.error("LINE client is not initialized due to missing environment variables.");
    return { success: false, error: "LINE API not configured" };
  }
  try {
    const response = await client.pushMessage(to, messages);
    console.log("LINE message sent successfully:", response);
    return { success: true, response };
  } catch (error: any) {
    console.error("Failed to send LINE message:", error);
    return { success: false, error: error.message || "An unknown error occurred" };
  }
}
```

### 3.3. Next.js API Routes (`src/app/api/notify/line/route.ts`)

サーバーサイドからLINEメッセージ送信リクエストを受け取り、`sendLineMessage` ヘルパー関数を呼び出します。

```typescript
import { NextResponse } from 'next/server';
import { sendLineMessage } from '@/lib/line'; // 作成したヘルパー関数をインポート
import { Message } from '@line/bot-sdk';

export async function POST(request: Request) {
  const { to, message } = await request.json(); // message は { type: 'text', text: '...' } などの形式を想定

  if (!to || !message) {
    return NextResponse.json({ error: 'Missing required fields (to, message)' }, { status: 400 });
  }

  // message が Message[] の型と一致するかバリデーション
  const messages: Message[] = Array.isArray(message) ? message : [message];

  // 認証チェックをここに追加することも検討（例: Vercel Cron Jobsからの呼び出しのみ許可）

  const { success, error } = await sendLineMessage({ to, messages });

  if (success) {
    return NextResponse.json({ message: 'LINE message sent successfully' });
  } else {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
```

### 3.4. スケジュールされた予約リマインド (`GET /api/cron/remind-appointments/route.ts`)

Vercel Cron Jobsから呼び出されるAPI Routeで、翌日予約の顧客に対してLINEリマインドを送信します。

```typescript
// src/app/api/cron/remind-appointments/route.ts (抜粋)

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { format, addDays } from 'date-fns';

export async function GET(request: Request) {
  const supabase = createServerComponentClient({ cookies });

  // セキュリティ対策: Cron Jobsからの呼び出しのみ許可する認証メカニズムを実装
  // 例: 特定のAPIキーをヘッダーに含める、IPアドレス制限など
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd'); // 翌日の日付
  const startOfDay = `${tomorrow}T00:00:00.000Z`;
  const endOfDay = `${tomorrow}T23:59:59.999Z`;

  try {
    const { data: upcomingAppointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select(
        `
          id,
          start_time,
          menu,
          customers(full_name, line_id)
        `
      )
      .gte("start_time", startOfDay)
      .lte("start_time", endOfDay)
      .eq("status", "予約済");

    if (appointmentsError) {
      console.error("Error fetching upcoming appointments:", appointmentsError);
      return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }

    for (const appointment of upcomingAppointments || []) {
      const customer = appointment.customers;
      if (customer && customer.line_id) {
        const messageText = `
${customer.full_name}様、明日のトリミング予約のご案内です。
日時: ${new Date(appointment.start_time).toLocaleString()}
メニュー: ${appointment.menu}
ご来店を心よりお待ちしております。
        `;

        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notify/line`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customer.line_id,
            message: { type: "text", text: messageText },
          }),
        });

        console.log(`LINE reminder sent to ${customer.full_name} (${customer.line_id}) for appointment ${appointment.id}`);
      }
    }

    return NextResponse.json({ message: "LINE reminders sent successfully" });
  } catch (error: any) {
    console.error("Error in LINE reminder cron job:", error);
    return NextResponse.json({ error: error.message || "An unknown error occurred" }, { status: 500 });
  }
}
```

## 4. その他の考慮事項

*   **LINE連携の仕組み**: 顧客のLINE ID を取得・管理するフローは、別途UIとバックエンドロジックが必要です。友だち追加時のWebhookでユーザーIDを取得し、Supabaseの顧客情報と紐づける、または顧客が手動でLINE IDを登録するなどの方法があります。今回は簡略化のため、`customers.line_id` に直接LINE IDが登録されている前提で進めます。
*   **メッセージの種類**: LINE Messaging APIは、テキストメッセージだけでなく、スタンプ、画像、カルーセルなど多様なメッセージタイプをサポートしています。よりリッチな通知を行う場合は、これらを活用できます。
*   **エラーハンドリング**: LINE APIの呼び出しが失敗した場合のログ記録、リトライメカニズムを実装します。
*   **Vercel Cron Jobsのスケジュール**: Cronのスケジュールは、リマインドを送信したい時間に合わせて設定します。
*   **APIの認証**: `api/cron/remind-appointments` エンドポイントは、外部から簡単に叩かれないよう、`CRON_SECRET_KEY` などを用いた認証を必ず実装します。

このフローにより、LINE Messaging API を使った効果的な予約リマインドシステムを構築できます。