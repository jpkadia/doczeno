import { Metadata } from "next";
import { SuperadminLoginClient } from "./superadmin-login-client";

export const metadata: Metadata = {
  title: "Superadmin Login | Doczeno Platform Authority",
  description: "Secure administrative gateway for platform management",
  robots: { index: false, follow: false },
};

export default function SuperadminLoginPage() {
  return <SuperadminLoginClient />;
}
