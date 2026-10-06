"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Lock, Mail, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface SlugAdminLoginClientProps {
  slug: string;
  displayName: string;
  subtitle: string;
  logoUrl?: string;
}

export function SlugAdminLoginClient({
  slug,
  displayName,
  subtitle,
  logoUrl,
}: SlugAdminLoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email address and password.");
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.post("/auth/login", {
        email: email.trim(),
        password,
        targetSlug: slug,
      });

      toast.success("Welcome back! Loading administration console...");
      router.push(`/${slug}/admin`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Invalid credentials. Please verify your email and password.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
              <span>Practice Admin Portal</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
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
                    onClick={() =>
                      toast.info(
                        "Please contact Doczeno support or your primary account administrator to reset your credentials."
                      )
                    }
                    className="text-[11px] text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
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
              Doczeno Secure Healthcare Platform &bull; Tenant Protected
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
