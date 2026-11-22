"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, Mail, Loader2, ShieldAlert, Eye, EyeOff, Clock, ArrowLeft } from "lucide-react";
import { DoczenoLogo } from "@/components/brand/doczeno-logo";
import { SuperadminLoginSkeleton } from "@/components/admin/superadmin-skeleton";
import Link from "next/link";
import { toast } from "sonner";

export function SuperadminLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInactiveReason = searchParams.get("reason") === "inactivity";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function checkExistingAuth() {
      // Don't auto-redirect if user was just logged out due to inactivity
      if (isInactiveReason) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { user?: { role?: string } };
        }>("/auth/me?requiredRole=SUPERADMIN");

        if (isMounted && res.success && res.data?.user?.role === "SUPERADMIN") {
          if (typeof window !== "undefined") {
            window.location.replace("/superadmin");
          } else {
            router.replace("/superadmin");
          }
          // Keep isCheckingAuth = true so form NEVER flashes
          return;
        }

        if (isMounted) {
          setIsCheckingAuth(false);
        }
      } catch {
        // Not authenticated as superadmin, continue to display login form
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
      setErrorMessage("Please enter both superadmin email and password.");
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.post("/auth/login", {
        email: trimmedEmail,
        password,
        requiredRole: "SUPERADMIN",
      });

      toast.success("Platform Superadmin authenticated successfully.");
      if (typeof window !== "undefined") {
        window.location.replace("/superadmin");
      } else {
        router.replace("/superadmin");
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
    return <SuperadminLoginSkeleton />;
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-xs font-semibold text-[#1560aa] mx-auto">
              <ShieldCheck className="h-4 w-4 text-[#1a76d1]" />
              <span>Platform Superadmin</span>
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Master Governance Console
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sign in with master administrator credentials
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isInactiveReason && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="leading-relaxed font-medium">
                  Your previous administrative session timed out due to inactivity for security compliance. Please sign in again.
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
                <Label htmlFor="superadmin-email" className="text-xs font-medium">
                  Superadmin Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="superadmin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter superadmin email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="superadmin-password" className="text-xs font-medium">
                  Master Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="superadmin-password"
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
                className="w-full gap-2 font-semibold shadow-sm bg-[#1a76d1] hover:bg-[#1560aa] text-white transition-all h-10 mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating Authority...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Authenticate Superadmin
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
