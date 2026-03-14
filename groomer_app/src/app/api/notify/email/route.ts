import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend"; // 作成したヘルパー関数をインポート

export async function POST(request: Request) {
  const { to, subject, html, from } = await request.json();

  if (!to || !subject || !html) {
    return NextResponse.json({ error: "Missing required fields (to, subject, html)" }, { status: 400 });
  }

  // 認証チェックをここに追加することも検討（例: 管理者ユーザーのみメール送信APIを叩ける）

  const { success, error } = await sendEmail({ to, subject, html, from });

  if (success) {
    return NextResponse.json({ message: "Email sent successfully" });
  } else {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
