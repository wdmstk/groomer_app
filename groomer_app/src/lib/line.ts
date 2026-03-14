import { Client, ClientConfig, Message } from "@line/bot-sdk";

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
  } catch (error: unknown) {
    console.error("Failed to send LINE message:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}
