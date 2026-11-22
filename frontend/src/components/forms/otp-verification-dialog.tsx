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
import { apiClient } from "@/lib/api-client";
import { Loader2, ArrowRight, RotateCw, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";

interface OtpVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  name?: string;
  onVerified: (otp: string) => Promise<void>;
}

export function OtpVerificationDialog({
  open,
  onOpenChange,
  email,
  name,
  onVerified,
}: OtpVerificationDialogProps) {
  const [otp, setOtp] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState(30);
  const [canResend, setCanResend] = React.useState(false);

  const sendOtpCode = React.useCallback(async () => {
    try {
      setIsResending(true);
      setErrorMessage(null);
      await apiClient.post("/onboarding/send-otp", { email, name });
      toast.success(`Verification code sent to ${email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Failed to send verification code. Please check your email.";
      setErrorMessage(msg);
    } finally {
      setIsResending(false);
    }
  }, [email, name]);

  // Send initial OTP when modal opens
  React.useEffect(() => {
    if (open && email) {
      setOtp("");
      setErrorMessage(null);
      setCountdown(30);
      setCanResend(false);
      sendOtpCode();
    }
  }, [open, email, sendOtpCode]);

  // Countdown timer for resend
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (open && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [open, countdown]);

  const handleResend = async () => {
    if (!canResend || isResending) return;
    await sendOtpCode();
    setCountdown(45);
    setCanResend(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);
      // Call parent onVerified callback which submits form with OTP
      await onVerified(cleanOtp);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Incorrect verification code. Please check your email and try again.";
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md border border-blue-100 shadow-xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Email Verification</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            We have sent a 6-digit verification code to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
            Enter the code below to launch your website.
          </DialogDescription>
        </DialogHeader>

        {/* Spam folder note */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="leading-snug text-left">
            Can&apos;t find the email in your inbox? Please check your <strong>Spam</strong> or <strong>Junk</strong> folder.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="otp-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wider block text-center">
              6-Digit Verification Code
            </Label>
            <div className="flex justify-center">
              <Input
                id="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  setOtp(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;"
                className="text-center text-2xl tracking-[0.4em] font-mono h-14 max-w-[240px] font-bold"
                autoFocus
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive text-center font-medium">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>Didn&apos;t receive code?</span>
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                {isResending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                Resend Code
              </button>
            ) : (
              <span>Resend in {countdown}s</span>
            )}
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={otp.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify & Launch
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
