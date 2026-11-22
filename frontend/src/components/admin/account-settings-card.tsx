"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Key,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface AccountSettingsCardProps {
  email: string;
  roleTitle: string;
  slug?: string;
  publishStatus?: string;
}

export function AccountSettingsCard({
  email,
  roleTitle,
  slug,
  publishStatus = "PUBLISHED",
}: AccountSettingsCardProps) {
  // Password Change State
  const [oldPassword, setOldPassword] = React.useState("");
  const [isOldPasswordVerified, setIsOldPasswordVerified] = React.useState(false);
  const [isVerifyingOld, setIsVerifyingOld] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showOldPassword, setShowOldPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  // Account Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = React.useState("");
  const [showDeletePassword, setShowDeletePassword] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);

  // Password Complexity Validation Rules
  const hasMinLength = newPassword.length >= 6;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferentFromOld = newPassword.length > 0 && newPassword !== oldPassword;
  const isNewPasswordValid =
    hasMinLength &&
    hasUppercase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch &&
    isDifferentFromOld;

  // Step 1: Verify Old Password
  const handleVerifyOldPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim()) {
      toast.error("Please enter your current password.");
      return;
    }

    setIsVerifyingOld(true);
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>(
        "/auth/verify-old-password",
        { oldPassword }
      );
      if (res.success) {
        setIsOldPasswordVerified(true);
        toast.success("Current password verified. You can now create your new password.");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Incorrect current password.";
      toast.error(msg);
    } finally {
      setIsVerifyingOld(false);
    }
  };

  // Step 2: Submit New Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewPasswordValid) {
      toast.error("Please ensure all password criteria are met.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>(
        "/auth/change-password",
        {
          oldPassword,
          newPassword,
          confirmPassword,
        }
      );
      if (res.success) {
        toast.success("Password changed successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setIsOldPasswordVerified(false);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Failed to change password.";
      toast.error(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Step 3: Permanent Delete Account
  const handlePermanentDeleteAccount = async () => {
    if (!deleteConfirmPassword.trim()) {
      toast.error("Please enter your password to confirm account deletion.");
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await apiClient.delete<{ success: boolean; message?: string }>(
        "/auth/delete-account",
        {
          body: { password: deleteConfirmPassword },
        }
      );
      if (res.success) {
        toast.success("Your account and website have been permanently deleted.");
        setIsDeleteDialogOpen(false);
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.replace("/");
          }
        }, 1200);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Failed to delete account.";
      toast.error(msg);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 1. Basic Account & Publication Info */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#1a76d1]" />
            <span>{roleTitle} Overview</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Registered credentials and public website status.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs">
          {slug && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-900 block">Website Slug URL</span>
                <span className="font-mono text-slate-600">/{slug}</span>
              </div>
              <Badge variant="outline" className="bg-white text-slate-700 font-mono text-[10px]">
                Active Route
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <div>
              <span className="font-bold text-slate-900 block">Publication State</span>
              <span className="text-slate-500">Public visibility of clinical website</span>
            </div>
            <Badge variant={publishStatus === "PUBLISHED" ? "success" : "secondary"}>
              {publishStatus}
            </Badge>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">Registered Email</span>
            <span className="text-slate-700 font-mono">{email}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Change Password Section */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <span>Change Account Password</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Enter your current password to unlock and create a new secure password.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          {/* Step 1: Current Password Input & Verification */}
          <form onSubmit={handleVerifyOldPassword} className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="current-password" className="text-xs font-semibold text-slate-700">
                  Current (Old) Password *
                </Label>
                {isOldPasswordVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1560aa] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    <Check className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  id="current-password"
                  type={showOldPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    if (isOldPasswordVerified) {
                      setIsOldPasswordVerified(false);
                    }
                  }}
                  disabled={isOldPasswordVerified}
                  placeholder="Enter current password"
                  className={`pr-10 text-xs ${
                    isOldPasswordVerified
                      ? "border-[#1a76d1] bg-blue-50/40 text-blue-900"
                      : ""
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isOldPasswordVerified && (
              <Button
                type="submit"
                size="sm"
                disabled={isVerifyingOld || !oldPassword.trim()}
                className="text-xs font-semibold"
              >
                {isVerifyingOld ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Current Password"
                )}
              </Button>
            )}
          </form>

          {/* Step 2: New Password Fields (Rendered only after Old Password is verified) */}
          {isOldPasswordVerified && (
            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in-50">
              <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#1a76d1] shrink-0" />
                <span>Old password confirmed. Please enter and confirm your new password below.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
                    Create New Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="pr-10 text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">
                    Confirm New Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="pr-10 text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-[11px]">
                <span className="font-semibold text-slate-700 block">Password Requirements:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-[#1560aa] font-medium" : "text-slate-500"}`}>
                    <Check className={`h-3 w-3 ${hasMinLength ? "text-[#1a76d1]" : "text-slate-300"}`} />
                    <span>At least 6 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-[#1560aa] font-medium" : "text-slate-500"}`}>
                    <Check className={`h-3 w-3 ${hasUppercase ? "text-[#1a76d1]" : "text-slate-300"}`} />
                    <span>At least 1 uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? "text-[#1560aa] font-medium" : "text-slate-500"}`}>
                    <Check className={`h-3 w-3 ${hasNumber ? "text-[#1a76d1]" : "text-slate-300"}`} />
                    <span>At least 1 number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-[#1560aa] font-medium" : "text-slate-500"}`}>
                    <Check className={`h-3 w-3 ${hasSpecial ? "text-[#1a76d1]" : "text-slate-300"}`} />
                    <span>At least 1 special symbol (@, #, $, !)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? "text-[#1560aa] font-medium" : "text-slate-500"}`}>
                    <Check className={`h-3 w-3 ${passwordsMatch ? "text-[#1a76d1]" : "text-slate-300"}`} />
                    <span>Passwords match</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isDifferentFromOld ? "text-[#1560aa] font-medium" : "text-slate-500"}`}>
                    <Check className={`h-3 w-3 ${isDifferentFromOld ? "text-[#1a76d1]" : "text-slate-300"}`} />
                    <span>Different from old password</span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isUpdatingPassword || !isNewPasswordValid}
                className="text-xs font-semibold bg-[#1a76d1] hover:bg-[#1560aa] text-white"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  "Confirm & Update Password"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 3. Danger Zone: Permanent Account Deletion */}
      <Card className="bg-white border-rose-200 shadow-2xs">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span>Danger Zone &mdash; Permanent Account Deletion</span>
          </CardTitle>
          <CardDescription className="text-xs text-rose-600/80">
            Irreversible deletion of your account, website, all photos, and patient records.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Deleting your account is permanent. All published website pages, uploaded doctor &amp; clinic photos, scheduled appointments, AI patient chats, and patient reviews will be completely erased from the system.
          </p>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-xs font-semibold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Permanently Delete Account</span>
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Permanent Deletion */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-rose-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <span>Confirm Permanent Account Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Are you sure you want to permanently delete your account and all associated data?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold">What will be permanently erased:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-700">
                <li>Your public doctor / hospital website</li>
                <li>All profile &amp; facility photos and uploaded media files</li>
                <li>All patient appointments and inquiries</li>
                <li>All AI chatbot conversations and testimonials</li>
                <li>Your administrative login credentials</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm-password" className="text-xs font-semibold text-slate-700">
                Enter Account Password to Confirm *
              </Label>
              <div className="relative">
                <Input
                  id="delete-confirm-password"
                  type={showDeletePassword ? "text" : "password"}
                  value={deleteConfirmPassword}
                  onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="pr-10 text-xs border-rose-300 focus-visible:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeletingAccount}
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmPassword("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeletingAccount || !deleteConfirmPassword.trim()}
              onClick={handlePermanentDeleteAccount}
              className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Deleting Everything...
                </>
              ) : (
                "Yes, Permanently Delete Everything"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
