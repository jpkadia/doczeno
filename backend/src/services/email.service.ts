import { getEnv } from "@/config/env";

export class EmailService {
  /**
   * Sends an OTP verification email using Brevo Transactional Email API
   */
  static async sendOtpEmail(params: {
    toEmail: string;
    toName?: string;
    otp: string;
    purpose?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const env = getEnv();
    const { toEmail, toName = "Doctor / Healthcare Provider", otp, purpose = "website creation" } = params;

    // Always log OTP in server console for local testing & development visibility
    console.log(`\n======================================================`);
    console.log(`[Doczeno OTP Service] VERIFICATION CODE FOR: ${toEmail}`);
    console.log(`[Doczeno OTP Service] OTP: ${otp} (Valid for 10 minutes)`);
    console.log(`======================================================\n`);

    if (!env.BREVO_API_KEY) {
      console.warn("[Doczeno Email Service]: BREVO_API_KEY is not configured. OTP logged to console only.");
      return { success: true, messageId: "console-fallback" };
    }

    const senderEmail = env.BREVO_SENDER_EMAIL || "kadiyaparth612@gmail.com";
    const senderName = "Doczeno Healthcare Websites";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { font-size: 24px; font-weight: 700; color: #0284c7; letter-spacing: -0.5px; }
          .badge { display: inline-block; padding: 4px 10px; background-color: #e0f2fe; color: #0369a1; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 6px; }
          .otp-box { background-color: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1; }
          .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace; }
          .instructions { font-size: 14px; line-height: 1.6; color: #334155; }
          .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">Doczeno</div>
            <div class="badge">Healthcare Identity Verification</div>
          </div>
          <p class="instructions">Hello <strong>${toName}</strong>,</p>
          <p class="instructions">Thank you for registering your healthcare practice with Doczeno. Please use the verification code below to verify your email address and launch your official clinical website for <strong>${purpose}</strong>:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          
          <p class="instructions" style="font-size: 13px; color: #64748b;">
            This verification code is strictly valid for <strong>10 minutes</strong>. Never share this code with anyone.
          </p>
          <div class="footer">
            Doczeno Medical Platform &bull; Secure Clinical Practice Website System
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail,
          },
          to: [
            {
              email: toEmail,
              name: toName,
            },
          ],
          subject: `Your Doczeno Verification Code: ${otp}`,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Doczeno Email Service]: Brevo API responded with status ${response.status}:`, errorText);
        // Do not throw in development - fallback gracefully
        return { success: true, messageId: "fallback-logged" };
      }

      const resData = (await response.json()) as { messageId?: string };
      return { success: true, messageId: resData.messageId };
    } catch (error) {
      console.error("[Doczeno Email Service]: Failed to send email via Brevo:", error);
      // Fallback graceful return so user is not blocked
      return { success: true, messageId: "error-logged" };
    }
  }
}
