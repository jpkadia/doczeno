import { Metadata } from "next";
import { AdminGatewayClient } from "@/app/admin/admin-gateway-client";

export const metadata: Metadata = {
  title: "Login | Doczeno",
  robots: { index: false, follow: false },
};

/**
 * Universal login entrypoint.
 * Renders unified AdminGatewayClient: validates active session directly with API.
 * - If authenticated: smoothly forwards to role dashboard (/superadmin or /${slug}/admin)
 * - If not authenticated: smoothly forwards to /admin/login
 * Never flashes login form.
 */
export default function LoginPage() {
  return <AdminGatewayClient />;
}
