"use client";

import * as React from "react";

export function AdminDashboardSkeleton() {
  return (
    <div
      className="min-h-screen bg-slate-50 flex overflow-hidden select-none"
      aria-busy="true"
      aria-label="Loading admin dashboard"
    >
      {/* Sidebar Skeleton (Desktop) */}
      <aside className="w-64 border-r border-slate-200 bg-white p-4 flex-col justify-between hidden md:flex shrink-0">
        <div className="space-y-6">
          {/* Logo & Brand Box */}
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>

          {/* Navigation Item Boxes */}
          <div className="space-y-2">
            {[90, 75, 82, 68, 85, 70, 78, 60].map((widthPct, idx) => (
              <div
                key={idx}
                className="h-9 w-full rounded-lg bg-slate-100 flex items-center gap-3 px-3 animate-pulse"
              >
                <div className="h-4 w-4 rounded bg-slate-200 shrink-0" />
                <div
                  className="h-3 bg-slate-200 rounded"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Action Box */}
        <div className="pt-4 border-t border-slate-100">
          <div className="h-9 w-full rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </aside>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-slate-100 rounded-full animate-pulse" />
            <div className="h-9 w-9 bg-slate-200 rounded-full animate-pulse" />
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Page Title & Subtitle Boxes */}
          <div className="space-y-2">
            <div className="h-7 w-64 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-slate-100 rounded animate-pulse" />
          </div>

          {/* Metric Cards Grid (4 boxes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
                  <div className="h-8 w-8 bg-slate-100 rounded-lg animate-pulse" />
                </div>
                <div className="h-8 w-20 bg-slate-200 rounded-md animate-pulse" />
                <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Main Content Layout (Table & Side Card) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Large Table/List Card Skeleton */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
                <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-slate-100 shrink-0 animate-pulse" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-44 bg-slate-200 rounded animate-pulse" />
                        <div className="h-2.5 w-28 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Side Card Skeleton */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 space-y-2 animate-pulse"
                  >
                    <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
                    <div className="h-2.5 w-1/2 bg-slate-200/70 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function AdminLoginSkeleton() {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-background via-secondary/15 to-secondary/35 flex flex-col items-center justify-center p-4 select-none"
      aria-busy="true"
      aria-label="Loading authentication"
    >
      <div className="w-full max-w-md space-y-4">
        {/* Back Link Placeholder */}
        <div className="h-4 w-36 bg-slate-200/70 rounded animate-pulse" />

        {/* Login Card Skeleton */}
        <div className="border border-slate-200 bg-white rounded-xl shadow-lg p-6 space-y-5">
          {/* Card Header */}
          <div className="flex flex-col items-center space-y-3 pb-2">
            <div className="h-12 w-12 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-6 w-32 rounded-full bg-blue-50 border border-blue-100 animate-pulse" />
            <div className="h-6 w-48 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-3.5 w-60 rounded bg-slate-100 animate-pulse" />
          </div>

          {/* Form Fields Skeleton */}
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-10 w-full rounded-md bg-slate-50 border border-slate-200/80 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-10 w-full rounded-md bg-slate-50 border border-slate-200/80 animate-pulse" />
            </div>

            {/* Submit Button Skeleton */}
            <div className="h-10 w-full rounded-md bg-[#1a76d1]/25 border border-[#1a76d1]/30 animate-pulse mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Smart Skeleton: Displays dashboard skeleton when session cookie or localStorage token exists,
 * or fallback login skeleton when unauthenticated.
 */
export function SmartAdminLoadingSkeleton() {
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const hasCookie = document.cookie.includes("doczeno_session");
      const hasToken = Boolean(localStorage.getItem("doczeno_auth_token"));
      setHasSession(hasCookie || hasToken);
    }
  }, []);

  if (hasSession === false) {
    return <AdminLoginSkeleton />;
  }

  return <AdminDashboardSkeleton />;
}

// Aliases for compatibility
export const SuperadminDashboardSkeleton = AdminDashboardSkeleton;
export const SuperadminLoginSkeleton = AdminLoginSkeleton;
