import crypto from "crypto";
import { Otp } from "@/models";
import { EmailService } from "./email.service";

export class OtpService {
  /**
   * Generates a 6-digit numeric OTP, saves it with a 10-minute TTL, and sends it via email.
   */
  static async generateAndSendOtp(params: {
    email: string;
    name?: string;
    purpose?: "ONBOARDING" | "PASSWORD_RESET" | "EMAIL_CHANGE";
  }): Promise<{ success: boolean; message: string }> {
    const email = params.email.trim().toLowerCase();
    const purpose = params.purpose || "ONBOARDING";

    // Generate secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any previous active OTPs for this email and purpose
    await Otp.deleteMany({ email, purpose });

    // Store in database
    await Otp.create({
      email,
      otp,
      purpose,
      attempts: 0,
      isVerified: false,
      expiresAt,
    });

    // Send email via Brevo
    await EmailService.sendOtpEmail({
      toEmail: email,
      toName: params.name,
      otp,
      purpose:
        purpose === "ONBOARDING"
          ? "website creation"
          : purpose === "PASSWORD_RESET"
          ? "password reset"
          : "admin email change",
    });

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${email}.`,
    };
  }

  /**
   * Validates the provided OTP. Enforces max 5 attempts and expiry.
   */
  static async verifyOtp(params: {
    email: string;
    otp: string;
    purpose?: "ONBOARDING" | "PASSWORD_RESET" | "EMAIL_CHANGE";
  }): Promise<{ valid: boolean }> {
    const email = params.email.trim().toLowerCase();
    const purpose = params.purpose || "ONBOARDING";
    const otpCode = params.otp.trim();

    const record = await Otp.findOne({
      email,
      purpose,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      throw new Error("Verification code has expired or was not requested. Please request a new code.");
    }

    if (record.attempts >= 5) {
      await Otp.deleteOne({ _id: record._id });
      throw new Error("Too many incorrect attempts. Please request a new verification code.");
    }

    if (record.otp !== otpCode) {
      record.attempts += 1;
      await record.save();
      throw new Error("Incorrect verification code. Please check your email and try again.");
    }

    // Mark as verified or delete after successful verification
    await Otp.deleteOne({ _id: record._id });
    return { valid: true };
  }
}
