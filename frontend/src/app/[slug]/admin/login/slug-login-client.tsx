"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Lock, Mail, ArrowLeft, Loader2, ShieldAlert, Clock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { AdminLoginSkeleton } from "@/components/admin/admin-skeleton";
import { ForgotPasswordDialog } from "@/components/admin/forgot-password-dialog";
import { toast } from "sonner";

interface SlugAdminLoginClientProps {
  slug: string;
  doctorSlug?: string;
  redirectPath?: string;
  displayName: string;
  subtitle: string;
  logoUrl?: string;
}

export function SlugAdminLoginClient({
  slug,
  doctorSlug,
  redirectPath,
  displayName,
  subtitle,
  logoUrl,
}: SlugAdminLoginClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInactiveReason = searchParams.get("reason") === "inactivity";
  const isUnauthorized = searchParams.get("unauthorized") === "true";

  const targetRedirect = redirectPath || (doctorSlug ? `/${slug}/${doctorSlug}/admin` : `/${slug}/admin`);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function checkExistingAuth() {
      if (isInactiveReason || isUnauthorized) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const queryParams = new URLSearchParams({ targetSlug: slug });
        if (doctorSlug) queryParams.set("doctorSlug", doctorSlug);

        const res = await apiClient.get<{
          success: boolean;
          data?: { authorized?: boolean };
        }>(`/auth/me?${queryParams.toString()}`);

        if (isMounted && res.success && res.data?.authorized) {
          if (typeof window !== "undefined") {
            window.location.replace(targetRedirect);
          } else {
            router.replace(targetRedirect);
          }
          // Keep isCheckingAuth = true so form NEVER flashes
          return;
        }

        if (isMounted) {
          setIsCheckingAuth(false);
        }
      } catch {
        // Not authenticated or not authorized for this slug, display login form
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkExistingAuth();

    return () => {
      isMounted = false;
    };
  }, [slug, doctorSlug, targetRedirect, isInactiveReason, isUnauthorized, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Please enter both email address and password.");
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.post("/auth/login", {
        email: trimmedEmail,
        password,
        targetSlug: slug,
        doctorSlug,
      });

      toast.success("Welcome back! Loading administration console...");
      if (typeof window !== "undefined") {
        window.location.replace(targetRedirect);
      } else {
        router.replace(targetRedirect);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ||
            "Invalid credentials. Please verify your email and password.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  if (isCheckingAuth) {
    return <AdminLoginSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/15 to-secondary/35 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Public Website
        </Link>

        <Card className="border shadow-lg">
          <CardHeader className="text-center space-y-3 pb-4">
            {logoUrl ? (
              <div className="mx-auto h-16 w-16 rounded-full overflow-hidden border bg-muted shadow-inner flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={displayName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Stethoscope className="h-7 w-7" />
              </div>
            )}

            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                {displayName}
              </CardTitle>
              <CardDescription
                className="text-xs text-muted-foreground pt-1"
                dangerouslySetInnerHTML={{ __html: subtitle }}
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-xs font-semibold text-secondary-foreground mx-auto">
              <Lock className="h-3 w-3" />
              <span>Admin Portal</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isInactiveReason && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="font-medium leading-relaxed">
                  Your session expired due to inactivity for security reasons. Please log in again to continue.
                </div>
              </div>
            )}

            {isUnauthorized && !errorMessage && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="font-medium leading-relaxed">
                  Access restricted: Please sign in with the administrator account authorized for this portal.
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-medium">
                  Admin Login Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="doctor@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password" className="text-xs font-medium">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 font-semibold shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In to Admin
                  </>
                )}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Doczeno Secure Healthcare Platform &bull; Encrypted &amp; Protected
            </div>
          </CardContent>
        </Card>

        <ForgotPasswordDialog
          open={isForgotPasswordOpen}
          onOpenChange={setIsForgotPasswordOpen}
          initialEmail={email}
          targetSlug={slug}
          doctorSlug={doctorSlug}
          portalName={displayName}
        />
      </div>
    </div>
  );
}
