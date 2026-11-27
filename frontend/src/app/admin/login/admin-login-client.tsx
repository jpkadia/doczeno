"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient, clearClientAuthState } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, Mail, Loader2, ShieldAlert, Eye, EyeOff, Clock, ArrowLeft } from "lucide-react";
import { DoczenoLogo } from "@/components/brand/doczeno-logo";
import { AdminLoginSkeleton } from "@/components/admin/admin-skeleton";
import { ForgotPasswordDialog } from "@/components/admin/forgot-password-dialog";
import Link from "next/link";
import { toast } from "sonner";

interface AuthMeResponse {
  success: boolean;
  data?: {
    user?: {
      id?: string;
      email?: string;
      role?: string;
    };
    authorized?: boolean;
    dashboardUrl?: string;
    slug?: string;
  };
}

interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    dashboardUrl?: string;
    slug?: string;
    user?: {
      role?: string;
    };
  };
}

export function AdminLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInactiveReason = searchParams.get("reason") === "inactivity";

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
      if (isInactiveReason) {
        clearClientAuthState();
        setIsCheckingAuth(false);
        return;
      }

      try {
        const storedLast = Number(localStorage.getItem("doczeno_last_activity_at") || "0");
        if (storedLast > 0 && Date.now() - storedLast >= 15 * 60 * 1000) {
          await apiClient.post("/auth/logout", { reason: "INACTIVITY" }).catch(() => {});
          clearClientAuthState();
          if (isMounted) setIsCheckingAuth(false);
          return;
        }
      } catch {}

      try {
        const res = await apiClient.get<AuthMeResponse>("/auth/me");
        if (isMounted && res.success && res.data?.user) {
          const rawUrl = res.data.dashboardUrl;
          const isValidDashboardUrl = rawUrl && rawUrl !== "/admin/login" && rawUrl !== "/admin";
          const destination = isValidDashboardUrl
            ? rawUrl
            : (res.data.user.role === "SUPERADMIN"
              ? "/superadmin"
              : res.data.slug
              ? `/${res.data.slug}/admin`
              : null);

          if (destination) {
            if (typeof window !== "undefined") {
              window.location.replace(destination);
            } else {
              router.replace(destination);
            }
            // Keep isCheckingAuth = true so login form NEVER flashes
            return;
          }
        }

        if (isMounted) {
          setIsCheckingAuth(false);
        }
      } catch {
        // Not authenticated, present login form
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkExistingAuth();

    return () => {
      isMounted = false;
    };
  }, [isInactiveReason, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiClient.post<LoginResponse>("/auth/login", {
        email: trimmedEmail,
        password,
      });

      toast.success("Signed in successfully. Redirecting to your dashboard...");

      const rawUrl = res.data?.dashboardUrl;
      const isValidDashboardUrl = rawUrl && rawUrl !== "/admin/login" && rawUrl !== "/admin";
      const destination = isValidDashboardUrl
        ? rawUrl
        : (res.data?.user?.role === "SUPERADMIN"
          ? "/superadmin"
          : res.data?.slug
          ? `/${res.data.slug}/admin`
          : "/");

      if (typeof window !== "undefined") {
        window.location.replace(destination);
      } else {
        router.replace(destination);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ||
            "Authentication failed. Please check your credentials.";
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
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Doczeno Home
        </Link>

        <Card className="border shadow-lg">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex justify-center mb-1">
              <DoczenoLogo variant="icon" size="md" withBackground />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Doczeno Admin Console
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sign in with your registered clinic or healthcare administrator account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isInactiveReason && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="font-medium leading-relaxed">
                  Your administrative session expired due to inactivity. Please sign in again.
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
                  Administrator Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter email address"
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
                className="w-full gap-2 font-semibold shadow-sm h-10 mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating Account...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Sign In to Admin Console
                  </>
                )}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-muted-foreground border-t">
              Doczeno Secure Healthcare Platform &bull; End-to-End Encrypted
            </div>
          </CardContent>
        </Card>

        <ForgotPasswordDialog
          open={isForgotPasswordOpen}
          onOpenChange={setIsForgotPasswordOpen}
          initialEmail={email}
        />
      </div>
    </div>
  );
}
