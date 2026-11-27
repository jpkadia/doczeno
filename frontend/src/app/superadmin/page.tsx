import { Metadata } from "next";
import { SuperadminClient } from "./superadmin-client";
import { SuperadminStats } from "@/components/admin/views/superadmin-admin";

export const metadata: Metadata = {
  title: "Platform Superadmin Console | Doczeno",
  description: "Global multi-tenant healthcare authority control panel",
  robots: { index: false, follow: false },
};

export default async function SuperadminPage() {
  const initialStats: SuperadminStats = {
    totalOrganizations: 0,
    totalDoctors: 0,
    totalWebsites: 0,
    activeWebsitesCount: 0,
    deactiveWebsitesCount: 0,
    totalUsers: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    deletedDoctorsCount: 0,
  };

  return (
    <SuperadminClient
      initialStats={initialStats}
      initialOrganizations={[]}
      initialDoctors={[]}
      initialWebsites={[]}
      initialUsers={[]}
      initialAppointments={[]}
      initialAuditLogs={[]}
    />
  );
}
