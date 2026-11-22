"use client";

import * as React from "react";
import { AdminDashboardSkeleton, AdminLoginSkeleton } from "./admin-skeleton";

interface AdminLoadingScreenProps {
  type?: "dashboard" | "login";
  title?: string;
  subtitle?: string;
}

export function AdminLoadingScreen({
  type = "dashboard",
}: AdminLoadingScreenProps) {
  if (type === "login") {
    return <AdminLoginSkeleton />;
  }
  return <AdminDashboardSkeleton />;
}
