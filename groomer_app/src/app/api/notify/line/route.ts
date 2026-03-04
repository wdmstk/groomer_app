import { NextResponse } from "next/server";
import { sendLineMessage } from "@/lib/line"; // 作成したヘルパー関数をインポート
import { Message } from "@line/bot-sdk";

export async function POST(request: Request) {
  const { to, message } = await request.json(); // message は { type: "text", text: "..." } などの形式を想定

  if (!to || !message) {
    return NextResponse.json({ error: "Missing required fields (to, message)" }, { status: 400 });
  }

  // message が Message[] の型と一致するかバリデーション
  const messages: Message[] = Array.isArray(message) ? message : [message];

  // 認証チェックをここに追加することも検討（例: Vercel Cron Jobsからの呼び出しのみ許可）

  const { success, error } = await sendLineMessage({ to, messages });

  if (success) {
    return NextResponse.json({ message: "LINE message sent successfully" });
  } else {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
