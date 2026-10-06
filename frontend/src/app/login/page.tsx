"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Building2,
  Stethoscope,
  ArrowRight,
  Lock,
  Mail,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Intelligent role routing based on input email
    setTimeout(() => {
      if (email.includes("superadmin")) {
        router.push("/superadmin");
      } else if (email.includes("apollo") && email.includes("rajiv")) {
        router.push("/apollo/dr-rajiv-shah/admin");
      } else if (email.includes("apollo")) {
        router.push("/apollo/admin");
      } else if (email.includes("parth") || email.includes("doctor")) {
        router.push("/dr-parth-kadiya/admin");
      } else {
        router.push("/superadmin");
      }
      setIsLoading(false);
    }, 400);
  };

  const handleRoleQuickLogin = (targetPath: string) => {
    setIsLoading(true);
    router.push(targetPath);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md mb-3">
          DZ
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Doczeno Admin Authentication
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign into your verified healthcare administration portal
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold text-slate-900">Sign In to Admin Console</CardTitle>
            <CardDescription className="text-xs">
              Enter your authorized staff or physician credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCustomLogin} className="space-y-3">
              <FormField id="email" label="Account Email" required>
                <div className="relative">
                  <Mail className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="doctor@doczeno.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs"
                    required
                  />
                </div>
              </FormField>

              <FormField id="password" label="Password" required>
                <div className="relative">
                  <Lock className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 text-xs"
                    required
                  />
                </div>
              </FormField>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 mt-2"
              >
                {isLoading ? "Authenticating..." : "Sign In"}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 text-[10px] font-semibold tracking-wider">
                  Or Instant Demo Access
                </span>
              </div>
            </div>

            {/* Quick Demo Role Cards */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleRoleQuickLogin("/superadmin")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Platform Superadmin</span>
                    <span className="text-[10px] text-slate-500">Global tenant oversight & stats</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleRoleQuickLogin("/apollo/admin")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Hospital Admin</span>
                    <span className="text-[10px] text-slate-500">Apollo Hospitals & Doctor Roster</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleRoleQuickLogin("/dr-parth-kadiya/admin")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Independent Doctor</span>
                    <span className="text-[10px] text-slate-500">Dr. Parth Kadiya (Solo Practice)</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleRoleQuickLogin("/apollo/dr-rajiv-shah/admin")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-100/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-amber-200 text-amber-900 flex items-center justify-center">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">Hospital Doctor</span>
                      <span className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-medium">Locked Facility</span>
                    </div>
                    <span className="text-[10px] text-slate-600">Dr. Rajiv Shah at Apollo Hospitals</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          </CardContent>
          <CardFooter className="pt-2 text-center flex justify-center border-t border-slate-100">
            <Link href="/" className="text-xs text-emerald-700 hover:underline">
              Return to Doczeno Public Homepage
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
