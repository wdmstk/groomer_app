import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string; // または text: string
  from?: string; // 例: "onboarding@resend.dev"
}

export async function sendEmail({ to, subject, html, from = "onboarding@resend.dev" }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: from,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
    console.log("Email sent successfully:", data);
    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error in sendEmail function:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}
