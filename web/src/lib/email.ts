import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, code: string) {
  await resend.emails.send({
    from: "DailyCodeforce <onboarding@resend.dev>",
    to: email,
    subject: "Verify your email - DailyCodeforce",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #0891b2; font-size: 24px; margin-bottom: 8px;">DailyCodeforce</h1>
        <p style="color: #374151; font-size: 16px;">Verify your email address to get started.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Your verification code:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; margin: 0; font-family: monospace;">${code}</p>
        </div>
        <p style="color: #9ca3af; font-size: 13px;">This code expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}
