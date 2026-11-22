"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  RotateCcw,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
  targetSlug?: string;
  doctorSlug?: string;
  portalName?: string;
  onSuccess?: () => void;
}

type Step = "EMAIL" | "OTP" | "NEW_PASSWORD" | "SUCCESS";

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialEmail = "",
  targetSlug,
  doctorSlug,
  portalName,
  onSuccess,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = React.useState<Step>("EMAIL");
  const [email, setEmail] = React.useState(initialEmail);
  const [otp, setOtp] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Resend OTP countdown timer
  const [countdown, setCountdown] = React.useState(0);

  // Sync initialEmail when opened
  React.useEffect(() => {
    if (open) {
      if (initialEmail && !email) {
        setEmail(initialEmail);
      }
      setErrorMessage(null);
    } else {
      // Reset state on close
      setStep("EMAIL");
      setOtp("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setErrorMessage(null);
      setCountdown(0);
    }
  }, [open, initialEmail]);

  // Countdown decrement
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Password validation rules
  const hasMinLength = newPassword.length >= 6;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;
  const canSubmitPassword = isPasswordValid && passwordsMatch;

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid administrator email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        "/auth/forgot-password/send-otp",
        {
          email: cleanEmail,
          targetSlug,
          doctorSlug,
        }
      );

      toast.success(res.message || `Verification code sent to ${cleanEmail}`);
      setStep("OTP");
      setCountdown(30);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to send verification code. Please check your email.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<{
        success: boolean;
        message: string;
        data: { resetToken: string };
      }>("/auth/forgot-password/verify-otp", {
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        targetSlug,
        doctorSlug,
      });

      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken);
        toast.success("Verification code confirmed. Please set your new password.");
        setStep("NEW_PASSWORD");
      } else {
        throw new Error("Unable to obtain password reset authorization.");
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Invalid or expired verification code.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setErrorMessage("Password must satisfy all security requirements (min 6 characters, uppercase, number & symbol).");
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage("Create new password and Confirm new password must match.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        "/auth/forgot-password/reset",
        {
          email: email.trim().toLowerCase(),
          resetToken,
          newPassword,
          confirmPassword,
        }
      );

      toast.success(res.message || "Password updated successfully!");
      setStep("SUCCESS");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to reset password. Please start over.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        <DialogHeader className="text-left space-y-1.5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-[#1a76d1] flex items-center justify-center shrink-0">
              {step === "SUCCESS" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : step === "NEW_PASSWORD" ? (
                <Lock className="h-5 w-5" />
              ) : step === "OTP" ? (
                <KeyRound className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">
                {step === "EMAIL" && "Reset Admin Password"}
                {step === "OTP" && "Verify Verification Code"}
                {step === "NEW_PASSWORD" && "Create New Password"}
                {step === "SUCCESS" && "Password Reset Complete"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {step === "EMAIL" &&
                  `Enter your registered administrator email${portalName ? ` for ${portalName}` : ""}.`}
                {step === "OTP" && `Enter the 6-digit code sent to ${email}.`}
                {step === "NEW_PASSWORD" && "Create and confirm your new secure administrator password."}
                {step === "SUCCESS" && "You can now log in using your new credentials."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2 animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: ENTER EMAIL */}
        {step === "EMAIL" && (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Administrator Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="doctor@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-[#1a76d1]"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                A 6-digit verification code will be sent to this email address.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !email.trim()}
                className="text-xs font-medium h-9 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5" />
                    Send OTP
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: ENTER OTP */}
        {step === "OTP" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
            {/* Spam folder note banner */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="leading-snug text-left">
                Can&apos;t find the email in your inbox? Please check your <strong>Spam</strong> or <strong>Junk</strong> folder.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="forgot-otp" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  6-Digit Verification Code
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("EMAIL");
                    setErrorMessage(null);
                  }}
                  className="text-[11px] text-[#1a76d1] hover:text-[#1560aa] hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Change Email
                </button>
              </div>

              <div className="relative">
                <Input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => {
                    // Only digits allowed
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                  }}
                  className="text-center font-mono text-lg tracking-[0.5em] h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#1a76d1] font-semibold"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                <span>Valid for 10 minutes</span>
                {countdown > 0 ? (
                  <span className="text-muted-foreground">Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={isLoading}
                    className="text-[#1a76d1] hover:text-[#1560aa] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Resend Code
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || otp.trim().length !== 6}
                className="text-xs font-medium h-9 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify OTP
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: CREATE NEW PASSWORD */}
        {step === "NEW_PASSWORD" && (
          <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
            {/* Create new Password */}
            <div className="space-y-1.5">
              <Label htmlFor="forgot-new-password" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Create new Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="forgot-new-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-10 text-sm h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-[#1a76d1]"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>

              {/* Password conditions checklist */}
              <div className="grid grid-cols-2 gap-1.5 pt-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-[#1a76d1] font-medium" : "text-muted-foreground"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${hasMinLength ? "bg-[#1a76d1]" : "bg-slate-300 dark:bg-slate-700"}`} />
                  Min 6 characters
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-[#1a76d1] font-medium" : "text-muted-foreground"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${hasUppercase ? "bg-[#1a76d1]" : "bg-slate-300 dark:bg-slate-700"}`} />
                  1 uppercase (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? "text-[#1a76d1] font-medium" : "text-muted-foreground"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${hasNumber ? "bg-[#1a76d1]" : "bg-slate-300 dark:bg-slate-700"}`} />
                  1 number (0-9)
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-[#1a76d1] font-medium" : "text-muted-foreground"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${hasSpecial ? "bg-[#1a76d1]" : "bg-slate-300 dark:bg-slate-700"}`} />
                  1 special symbol
                </div>
              </div>
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <Label htmlFor="forgot-confirm-password" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Confirm new password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="forgot-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-10 text-sm h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-[#1a76d1]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <p className={`text-[11px] font-medium pt-0.5 ${passwordsMatch ? "text-[#1a76d1]" : "text-destructive"}`}>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !canSubmitPassword}
                className="text-xs font-medium h-9 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Create New Password
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="space-y-4 pt-2 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 border border-blue-200 text-[#1a76d1] flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Password Successfully Reset!
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your administrator account password has been updated. You can now use your new password to sign in.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full text-xs font-medium h-9 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-2 shadow-sm mt-2"
            >
              Sign In with New Password
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
