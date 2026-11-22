import { Metadata } from "next";
import { AdminGatewayClient } from "./admin-gateway-client";

export const metadata: Metadata = {
  title: "Admin Console Gateway | Doczeno",
  robots: { index: false, follow: false },
};

/**
 * Universal /admin root gateway.
 * Evaluates active administrative session with API client:
 * - Authenticated: forwards directly to role dashboard
 * - Unauthenticated: forwards to /admin/login
 * Zero login form flash.
 */
export default function AdminRootPage() {
  return <AdminGatewayClient />;
}
