"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { AdminDashboardSkeleton } from "@/components/admin/admin-skeleton";

export function AdminGatewayClient() {
  const router = useRouter();

  React.useEffect(() => {
    let isMounted = true;

    async function checkAuthAndRedirect() {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: {
            user?: { role?: string };
            dashboardUrl?: string;
            slug?: string;
          };
        }>("/auth/me");

        if (isMounted && res.success && res.data?.user) {
          const rawUrl = res.data.dashboardUrl;
          const isValid = rawUrl && rawUrl !== "/admin/login" && rawUrl !== "/admin";
          const destination = isValid
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
            return;
          }
        }

        // Not authenticated or no tenant dashboard found
        if (typeof window !== "undefined") {
          window.location.replace("/admin/login");
        } else {
          router.replace("/admin/login");
        }
      } catch {
        // Not authenticated
        if (typeof window !== "undefined") {
          window.location.replace("/admin/login");
        } else {
          router.replace("/admin/login");
        }
      }
    }

    checkAuthAndRedirect();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <AdminDashboardSkeleton />;
}
