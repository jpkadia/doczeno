"use client";

import * as React from "react";
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

  return (
    <SuperadminAdmin
      initialStats={initialStats}
      initialOrganizations={initialOrganizations}
      initialDoctors={initialDoctors}
      initialWebsites={initialWebsites}
      initialUsers={initialUsers}
      initialAppointments={initialAppointments}
      initialAuditLogs={initialAuditLogs}
      onToggleOrgStatus={handleToggleOrgStatus}
      onSafeDeleteOrg={handleSafeDeleteOrg}
      onToggleDoctorStatus={handleToggleDoctorStatus}
      onToggleWebsitePublish={handleToggleWebsitePublish}
      onToggleUserStatus={handleToggleUserStatus}
      onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
    />
  );
}
