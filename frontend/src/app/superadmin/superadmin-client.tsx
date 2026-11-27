"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SuperadminAdmin,
  SuperadminStats,
  SuperadminOrgItem,
  SuperadminDoctorItem,
  SuperadminWebsiteItem,
  SuperadminUserItem,
  SuperadminAppointmentItem,
  AuditLogItem,
} from "@/components/admin/views/superadmin-admin";
import { apiClient } from "@/lib/api-client";
import { InactivityGuard } from "@/components/admin/inactivity-guard";
import { SmartAdminLoadingSkeleton } from "@/components/admin/admin-skeleton";
import { toast } from "sonner";

interface SuperadminClientProps {
  initialStats: SuperadminStats;
  initialOrganizations: SuperadminOrgItem[];
  initialDoctors: SuperadminDoctorItem[];
  initialWebsites: SuperadminWebsiteItem[];
  initialUsers: SuperadminUserItem[];
  initialAppointments: SuperadminAppointmentItem[];
  initialAuditLogs: AuditLogItem[];
}

export function SuperadminClient({
  initialStats,
  initialOrganizations,
  initialDoctors,
  initialWebsites,
  initialUsers,
  initialAppointments,
  initialAuditLogs,
}: SuperadminClientProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  const [stats, setStats] = React.useState<SuperadminStats>(initialStats);
  const [organizations, setOrganizations] = React.useState<SuperadminOrgItem[]>(initialOrganizations);
  const [doctors, setDoctors] = React.useState<SuperadminDoctorItem[]>(initialDoctors);
  const [websites, setWebsites] = React.useState<SuperadminWebsiteItem[]>(initialWebsites);
  const [users, setUsers] = React.useState<SuperadminUserItem[]>(
    initialUsers.filter((u) => u.role !== "SUPERADMIN")
  );
  const [appointments, setAppointments] = React.useState<SuperadminAppointmentItem[]>(initialAppointments);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogItem[]>(initialAuditLogs);

  React.useEffect(() => {
    async function verifySuperadmin() {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { user?: { role?: string; email?: string } };
        }>("/auth/me?requiredRole=SUPERADMIN");

        if (res.success && res.data?.user?.role === "SUPERADMIN") {
          setIsAuthenticated(true);
        } else {
          if (typeof window !== "undefined") {
            window.location.replace("/superadmin/login");
          } else {
            router.replace("/superadmin/login");
          }
        }
      } catch (err: unknown) {
        const code = (err as { data?: { code?: string } })?.data?.code;
        const redirectDest =
          code === "SESSION_INACTIVITY_EXPIRED"
            ? "/superadmin/login?reason=inactivity"
            : "/superadmin/login";
        if (typeof window !== "undefined") {
          window.location.replace(redirectDest);
        } else {
          router.replace(redirectDest);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    }

    verifySuperadmin();

    const handleFocus = async () => {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { user?: { role?: string } };
        }>("/auth/me?requiredRole=SUPERADMIN");
        if (!res.success || res.data?.user?.role !== "SUPERADMIN") {
          if (typeof window !== "undefined") {
            window.location.replace("/superadmin/login");
          }
        }
      } catch {
        if (typeof window !== "undefined") {
          window.location.replace("/superadmin/login");
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [router]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    async function loadData() {
      try {
        const [statsRes, orgsRes, docsRes, sitesRes, usersRes, apptsRes, auditRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data?: SuperadminStats }>("/superadmin/stats"),
          apiClient.get<{ success: boolean; data?: { organizations?: any[] } }>("/superadmin/organizations"),
          apiClient.get<{ success: boolean; data?: { doctors?: any[] } }>("/superadmin/doctors"),
          apiClient.get<{ success: boolean; data?: { websites?: any[] } }>("/superadmin/websites"),
          apiClient.get<{ success: boolean; data?: { users?: any[] } }>("/superadmin/users"),
          apiClient.get<{ success: boolean; data?: { appointments?: any[] } }>("/appointments"),
          apiClient.get<{ success: boolean; data?: { logs?: any[] } }>("/audit"),
        ]);

        const hasAuthFailure = [statsRes, orgsRes, docsRes, sitesRes, usersRes, apptsRes, auditRes].some(
          (r) =>
            r.status === "rejected" &&
            (r.reason?.status === 401 || r.reason?.status === 403)
        );

        if (hasAuthFailure) {
          if (typeof window !== "undefined") {
            window.location.replace("/superadmin/login");
          }
          return;
        }

        if (statsRes.status === "fulfilled" && statsRes.value?.success && statsRes.value.data) {
          setStats(statsRes.value.data);
        }
        if (orgsRes.status === "fulfilled" && orgsRes.value?.success && orgsRes.value.data?.organizations) {
          setOrganizations(
            orgsRes.value.data.organizations.map((o: any) => ({
              id: o._id || o.id,
              name: o.name,
              slug: o.slug,
              type: o.type,
              status: o.status,
              address: { city: o.address?.city || "", state: o.address?.state || "" },
              isWebsiteChatbotEnabled: o.isWebsiteChatbotEnabled !== false,
              isAdminChatbotEnabled: o.isAdminChatbotEnabled !== false,
              isChatbotBookingEnabled: o.isChatbotBookingEnabled !== false,
              isAiRegenerateEnabled: Boolean(o.isAiRegenerateEnabled),
              isVisibleInDoctorOnboarding: o.isVisibleInDoctorOnboarding !== false,
              createdAt: o.createdAt || new Date().toISOString(),
            }))
          );
        }
        if (docsRes.status === "fulfilled" && docsRes.value?.success && docsRes.value.data?.doctors) {
          setDoctors(
            docsRes.value.data.doctors.map((d: any) => ({
              id: d._id || d.id,
              doctorName: d.doctorName,
              slug: d.slug,
              specialization: d.specialization,
              yearsOfExperience: d.yearsOfExperience || 0,
              status: d.status,
              deactivatedByRole: d.deactivatedByRole || null,
              organizationId: d.organizationId ? { id: d.organizationId._id || d.organizationId.id, name: d.organizationId.name, slug: d.organizationId.slug } : null,
              isWebsiteChatbotEnabled: d.isWebsiteChatbotEnabled !== false,
              isAdminChatbotEnabled: d.isAdminChatbotEnabled !== false,
              isChatbotBookingEnabled: d.isChatbotBookingEnabled !== false,
              isAiRegenerateEnabled: Boolean(d.isAiRegenerateEnabled),
              createdAt: d.createdAt || new Date().toISOString(),
            }))
          );
        }
        if (sitesRes.status === "fulfilled" && sitesRes.value?.success && sitesRes.value.data?.websites) {
          setWebsites(
            sitesRes.value.data.websites.map((w: any) => ({
              id: w._id || w.id,
              slug: w.slug,
              websiteType: w.websiteType,
              publishStatus: w.publishStatus,
              selectedTheme: w.selectedTheme || "hospital-classic",
              organizationId: w.organizationId ? { name: w.organizationId.name, slug: w.organizationId.slug } : null,
              doctorId: w.doctorId ? { doctorName: w.doctorId.doctorName, slug: w.doctorId.slug } : null,
            }))
          );
        }
        if (usersRes.status === "fulfilled" && usersRes.value?.success && usersRes.value.data?.users) {
          setUsers(
            usersRes.value.data.users
              .filter((u: any) => u.role !== "SUPERADMIN")
              .map((u: any) => ({
                id: u._id || u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                isActive: u.isActive ?? true,
                createdAt: u.createdAt || new Date().toISOString(),
              }))
          );
        }
        if (apptsRes.status === "fulfilled" && apptsRes.value?.success && apptsRes.value.data?.appointments) {
          setAppointments(
            apptsRes.value.data.appointments.map((a: any) => ({
              id: a._id || a.id,
              patientName: a.patientName,
              patientPhone: a.patientPhone,
              appointmentDate: a.appointmentDate ? (new Date(a.appointmentDate).toISOString().split("T")[0] || "") : "",
              timeSlot: a.timeSlot || a.preferredTimeSlot || "Morning",
              status: a.status,
              doctorId: a.doctorId ? { doctorName: a.doctorId.doctorName, specialization: a.doctorId.specialization } : null,
              organizationId: a.organizationId ? { name: a.organizationId.name } : null,
            }))
          );
        }
        if (auditRes.status === "fulfilled" && auditRes.value?.success && auditRes.value.data?.logs) {
          setAuditLogs(
            auditRes.value.data.logs.map((l: any) => ({
              id: l._id || l.id,
              action: l.action,
              userEmail: l.userEmail || "",
              userRole: l.userRole || "",
              entityType: l.entityType || "",
              timestamp: l.timestamp || new Date().toISOString(),
              details: l.details,
            }))
          );
        }
      } catch {
        // Keep initial state
      }
    }
    loadData();
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      toast.success("Superadmin logged out successfully.");
    } catch {
      // Ignore
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/superadmin/login");
      } else {
        router.replace("/superadmin/login");
      }
    }
  };

  const handleToggleOrgStatus = async (orgId: string, newStatus: string) => {
    await apiClient.patch(`/superadmin/organizations/${orgId}/status`, { status: newStatus });
  };

  const handleSafeDeleteOrg = async (orgId: string) => {
    const res = await apiClient.delete<{ success: boolean; message?: string }>(
      `/superadmin/organizations/${orgId}`
    );
    return res;
  };

  const handleToggleDoctorStatus = async (doctorId: string, newStatus: string) => {
    await apiClient.patch(`/superadmin/doctors/${doctorId}/status`, { status: newStatus });
  };

  const handleToggleWebsitePublish = async (websiteId: string, newStatus: string) => {
    await apiClient.patch(`/superadmin/websites/${websiteId}/publish-status`, {
      publishStatus: newStatus,
    });
  };

  const handleToggleUserStatus = async (userId: string, newStatus: string) => {
    await apiClient.patch(`/superadmin/users/${userId}/status`, { status: newStatus });
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    await apiClient.patch(`/appointments/${appointmentId}/status`, { status: newStatus });
  };

  if (isCheckingAuth || !isAuthenticated) {
    return <SmartAdminLoadingSkeleton />;
  }

  return (
    <InactivityGuard timeoutMs={15 * 60 * 1000} logoutRedirectUrl="/superadmin/login">
      <div className="relative min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1">
          <SuperadminAdmin
            initialStats={stats}
            initialOrganizations={organizations}
            initialDoctors={doctors}
            initialWebsites={websites}
            initialUsers={users}
            initialAppointments={appointments}
            initialAuditLogs={auditLogs}
            onToggleOrgStatus={handleToggleOrgStatus}
            onSafeDeleteOrg={handleSafeDeleteOrg}
            onToggleDoctorStatus={handleToggleDoctorStatus}
            onToggleWebsitePublish={handleToggleWebsitePublish}
            onToggleUserStatus={handleToggleUserStatus}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </InactivityGuard>
  );
}
