import { Metadata } from "next";
import { SuperadminClient } from "./superadmin-client";
import {
  SuperadminStats,
  SuperadminOrgItem,
  SuperadminDoctorItem,
  SuperadminWebsiteItem,
  SuperadminUserItem,
  SuperadminAppointmentItem,
  AuditLogItem,
} from "@/components/admin/views/superadmin-admin";

export const metadata: Metadata = {
  title: "Platform Superadmin Console | Doczeno",
  description: "Global multi-tenant healthcare authority control panel",
  robots: { index: false, follow: false },
};

export default function SuperadminPage() {
  const initialStats: SuperadminStats = {
    totalOrganizations: 24,
    totalDoctors: 86,
    totalWebsites: 110,
    totalUsers: 118,
    totalAppointments: 482,
    pendingAppointments: 14,
  };

  const initialOrganizations: SuperadminOrgItem[] = [
    {
      id: "org-1",
      name: "Apollo Hospitals Ahmedabad",
      slug: "apollo",
      type: "HOSPITAL",
      status: "ACTIVE",
      address: { city: "Ahmedabad", state: "Gujarat" },
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "org-2",
      name: "Fortis Escorts Heart Institute",
      slug: "fortis",
      type: "HOSPITAL",
      status: "ACTIVE",
      address: { city: "New Delhi", state: "Delhi" },
      createdAt: "2026-09-10T12:00:00Z",
    },
    {
      id: "org-3",
      name: "Carewell Multi-Specialty Clinic",
      slug: "carewell-clinic",
      type: "CLINIC",
      status: "ACTIVE",
      address: { city: "Mumbai", state: "Maharashtra" },
      createdAt: "2026-09-15T09:30:00Z",
    },
  ];

  const initialDoctors: SuperadminDoctorItem[] = [
    {
      id: "doc-1",
      doctorName: "Parth Kadiya",
      slug: "dr-parth-kadiya",
      specialization: "General Surgery",
      yearsOfExperience: 12,
      status: "ACTIVE",
      organizationId: null,
      createdAt: "2026-09-02T11:00:00Z",
    },
    {
      id: "doc-2",
      doctorName: "Rajiv Shah",
      slug: "dr-rajiv-shah",
      specialization: "Interventional Cardiology",
      yearsOfExperience: 14,
      status: "ACTIVE",
      organizationId: { id: "org-1", name: "Apollo Hospitals Ahmedabad", slug: "apollo" },
      createdAt: "2026-09-05T14:00:00Z",
    },
    {
      id: "doc-3",
      doctorName: "Sunita Rao",
      slug: "dr-sunita-rao",
      specialization: "Pediatrics",
      yearsOfExperience: 8,
      status: "ACTIVE",
      organizationId: { id: "org-2", name: "Fortis Escorts Heart Institute", slug: "fortis" },
      createdAt: "2026-09-12T16:00:00Z",
    },
  ];

  const initialWebsites: SuperadminWebsiteItem[] = [
    {
      id: "site-1",
      slug: "dr-parth-kadiya",
      websiteType: "INDEPENDENT_DOCTOR",
      publishStatus: "PUBLISHED",
      selectedTheme: "clinical-editorial",
      organizationId: null,
      doctorId: { doctorName: "Parth Kadiya", slug: "dr-parth-kadiya" },
    },
    {
      id: "site-2",
      slug: "apollo",
      websiteType: "HOSPITAL",
      publishStatus: "PUBLISHED",
      selectedTheme: "modern-minimal",
      organizationId: { name: "Apollo Hospitals Ahmedabad", slug: "apollo" },
      doctorId: null,
    },
    {
      id: "site-3",
      slug: "apollo/dr-rajiv-shah",
      websiteType: "HOSPITAL_DOCTOR",
      publishStatus: "PUBLISHED",
      selectedTheme: "modern-minimal",
      organizationId: { name: "Apollo Hospitals Ahmedabad", slug: "apollo" },
      doctorId: { doctorName: "Rajiv Shah", slug: "dr-rajiv-shah" },
    },
  ];

  const initialUsers: SuperadminUserItem[] = [
    {
      id: "usr-1",
      name: "Global Platform Superadmin",
      email: "superadmin@doczeno.com",
      role: "SUPERADMIN",
      isActive: true,
      createdAt: "2026-08-01T00:00:00Z",
    },
    {
      id: "usr-2",
      name: "Apollo Hospital Admin",
      email: "admin@apollo.com",
      role: "HOSPITAL_ADMIN",
      isActive: true,
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "usr-3",
      name: "Dr. Parth Kadiya",
      email: "dr.parth@doczeno.com",
      role: "INDEPENDENT_DOCTOR",
      isActive: true,
      createdAt: "2026-09-02T11:00:00Z",
    },
    {
      id: "usr-4",
      name: "Dr. Rajiv Shah",
      email: "dr.rajiv@apollo.com",
      role: "HOSPITAL_DOCTOR",
      isActive: true,
      createdAt: "2026-09-05T14:00:00Z",
    },
  ];

  const initialAppointments: SuperadminAppointmentItem[] = [
    {
      id: "apt-101",
      patientName: "Aarav Patel",
      patientPhone: "+91 98765 43210",
      appointmentDate: "2026-10-10",
      timeSlot: "10:30 AM",
      status: "CONFIRMED",
      doctorId: { doctorName: "Parth Kadiya", specialization: "General Surgery" },
      organizationId: null,
    },
    {
      id: "apt-102",
      patientName: "Meera Desai",
      patientPhone: "+91 98765 11111",
      appointmentDate: "2026-10-12",
      timeSlot: "09:30 AM",
      status: "PENDING",
      doctorId: { doctorName: "Rajiv Shah", specialization: "Interventional Cardiology" },
      organizationId: { name: "Apollo Hospitals Ahmedabad" },
    },
  ];

  const initialAuditLogs: AuditLogItem[] = [
    {
      id: "aud-1",
      action: "ORGANIZATION_STATUS_CHANGED",
      userEmail: "superadmin@doczeno.com",
      userRole: "SUPERADMIN",
      entityType: "Organization",
      timestamp: new Date().toISOString(),
      details: { organization: "Apollo Hospitals Ahmedabad", status: "ACTIVE" },
    },
    {
      id: "aud-2",
      action: "DOCTOR_REGISTERED",
      userEmail: "admin@apollo.com",
      userRole: "HOSPITAL_ADMIN",
      entityType: "Doctor",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: { doctorName: "Rajiv Shah" },
    },
  ];

  return (
    <SuperadminClient
      initialStats={initialStats}
      initialOrganizations={initialOrganizations}
      initialDoctors={initialDoctors}
      initialWebsites={initialWebsites}
      initialUsers={initialUsers}
      initialAppointments={initialAppointments}
      initialAuditLogs={initialAuditLogs}
    />
  );
}
