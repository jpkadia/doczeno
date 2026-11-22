"use client";

import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import { OnlyDoctorAdmin, OnlyDoctorData, AppointmentItem } from "@/components/admin/views/only-doctor-admin";
import { HospitalAdmin, HospitalData, HospitalDoctorItem, HospitalAppointmentItem } from "@/components/admin/views/hospital-admin";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

import { InactivityGuard } from "@/components/admin/inactivity-guard";
import { SmartAdminLoadingSkeleton } from "@/components/admin/admin-skeleton";
import { toast } from "sonner";

interface AdminClientProps {
  initialWebsite: EffectiveWebsiteData;
  slug: string;
}

export function AdminClient({ initialWebsite, slug }: AdminClientProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  React.useEffect(() => {
    async function verifyAuth() {
      try {
        const res = await apiClient.get<{ success: boolean; data?: { authorized?: boolean } }>(
          `/auth/me?targetSlug=${encodeURIComponent(slug)}`
        );
        if (res.success && res.data?.authorized) {
          setIsAuthenticated(true);
        } else {
          if (typeof window !== "undefined") {
            window.location.replace(`/${slug}/admin/login?unauthorized=true`);
          } else {
            router.replace(`/${slug}/admin/login?unauthorized=true`);
          }
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 403) {
          toast.error("Unauthorized: You do not have permission to manage this portal.");
          if (typeof window !== "undefined") {
            window.location.replace(`/${slug}/admin/login?unauthorized=true`);
          } else {
            router.replace(`/${slug}/admin/login?unauthorized=true`);
          }
        } else {
          if (typeof window !== "undefined") {
            window.location.replace(`/${slug}/admin/login`);
          } else {
            router.replace(`/${slug}/admin/login`);
          }
        }
      } finally {
        setIsCheckingAuth(false);
      }
    }
    verifyAuth();
  }, [slug, router]);

  if (isCheckingAuth || !isAuthenticated) {
    return <SmartAdminLoadingSkeleton />;
  }

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      toast.success("Logged out successfully.");
    } catch {
      // Ignore
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace(`/${slug}/admin/login`);
      } else {
        router.replace(`/${slug}/admin/login`);
      }
    }
  };

  const isDoctor = initialWebsite.websiteType === "ONLY_DOCTOR";

  if (isDoctor) {
    return <OnlyDoctorAdminWrapper initialWebsite={initialWebsite} slug={slug} handleLogout={handleLogout} />;
  }

  return <HospitalAdminWrapper initialWebsite={initialWebsite} slug={slug} handleLogout={handleLogout} />;
}

function OnlyDoctorAdminWrapper({
  initialWebsite,
  slug,
  handleLogout,
}: {
  initialWebsite: EffectiveWebsiteData;
  slug: string;
  handleLogout: () => Promise<void>;
}) {
  const [appointments, setAppointments] = React.useState<AppointmentItem[]>([]);

  React.useEffect(() => {
    async function loadAppointments() {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { appointments?: any[] };
        }>("/appointments");
        if (res.success && res.data?.appointments) {
          setAppointments(
            res.data.appointments.map((a: any) => ({
              id: a._id || a.id,
              patientName: a.patientName,
              patientPhone: a.patientPhone,
              appointmentDate: a.appointmentDate ? (new Date(a.appointmentDate).toISOString().split("T")[0] || "") : "",
              timeSlot: a.timeSlot || a.preferredTimeSlot || "Morning",
              status: a.status,
              notes: a.notes,
            }))
          );
        }
      } catch {
        // Fallback to empty
      }
    }
    loadAppointments();
  }, []);

  const doctorData: OnlyDoctorData = {
    id: initialWebsite.doctorId || initialWebsite.slug,
    slug: initialWebsite.slug,
    doctorName: initialWebsite.doctorName || "Doctor",
    gender: initialWebsite.gender || "Male",
    degree: initialWebsite.degree || "",
    specialization: initialWebsite.specialization || "",
    yearsOfExperience: initialWebsite.yearsOfExperience || 0,
    whatsApp: initialWebsite.whatsApp || "",
    email: initialWebsite.email || "",
    phone: initialWebsite.phone || "",
    bio: initialWebsite.bio || "",
    doctorPhoto: initialWebsite.doctorPhoto,
    clinicName: initialWebsite.organizationName,
    address: initialWebsite.address,
    clinicLogo: initialWebsite.logo,
    clinicPhotos: initialWebsite.galleryPhotos,
    consultationHours: initialWebsite.consultationHours || "09:00 AM - 01:00 PM, 05:00 PM - 08:00 PM",
    weeklyOff: initialWebsite.weeklyOff || "Sunday",
    appointmentRequired: initialWebsite.appointmentRequired ?? true,
    selectedTheme: initialWebsite.selectedTheme || "hospital-classic",
    faviconUrl: initialWebsite.faviconUrl,
    browserTabTitle: initialWebsite.browserTabTitle,
    publishStatus: "PUBLISHED",
  };

  const handleSave = async (updated: Partial<OnlyDoctorData>) => {
    try {
      const res = await apiClient.patch<{ success: boolean; message?: string }>(`/doctors/me`, updated);
      if (res.success) {
        toast.success(res.message || "Settings updated successfully.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update settings";
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateAppointment = async (apptId: string, status: string) => {
    try {
      await apiClient.patch(`/appointments/${apptId}/status`, { status });
    } catch (err) {
      console.warn("Appointment status update fallback:", err);
    }
  };

  return (
    <InactivityGuard logoutRedirectUrl={`/${slug}/admin/login`}>
      <OnlyDoctorAdmin
        initialData={doctorData}
        initialAppointments={appointments}
        onSave={handleSave}
        onUpdateAppointmentStatus={handleUpdateAppointment}
        onLogout={handleLogout}
      />
    </InactivityGuard>
  );
}

function HospitalAdminWrapper({
  initialWebsite,
  slug,
  handleLogout,
}: {
  initialWebsite: EffectiveWebsiteData;
  slug: string;
  handleLogout: () => Promise<void>;
}) {
  const [appointments, setAppointments] = React.useState<HospitalAppointmentItem[]>([]);

  React.useEffect(() => {
    async function loadHospitalAppointments() {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { appointments?: any[] };
        }>("/appointments");
        if (res.success && res.data?.appointments) {
          setAppointments(
            res.data.appointments.map((a: any) => ({
              id: a._id || a.id,
              patientName: a.patientName,
              patientPhone: a.patientPhone,
              appointmentDate: a.appointmentDate ? (new Date(a.appointmentDate).toISOString().split("T")[0] || "") : "",
              timeSlot: a.timeSlot || a.preferredTimeSlot || "Morning",
              status: a.status,
              doctorName: a.doctorId?.doctorName || "",
            }))
          );
        }
      } catch {
        // Fallback to empty
      }
    }
    loadHospitalAppointments();
  }, []);

  const hospitalData: HospitalData = {
    id: initialWebsite.slug,
    name: initialWebsite.organizationName,
    slug: initialWebsite.slug,
    type: initialWebsite.organizationType || "HOSPITAL",
    about: initialWebsite.about || "",
    phone: initialWebsite.phone || "",
    whatsApp: initialWebsite.whatsApp || "",
    email: initialWebsite.email || "",
    address: initialWebsite.address,
    workingHours: initialWebsite.workingHours || "Open 24/7 (Emergency & OPD)",
    weeklyOff: initialWebsite.weeklyOff || "None (Open 7 Days)",
    appointmentRequired: initialWebsite.appointmentRequired ?? false,
    selectedTheme: initialWebsite.selectedTheme || "hospital-classic",
    logo: initialWebsite.logo,
    galleryPhotos: initialWebsite.galleryPhotos,
    faviconUrl: initialWebsite.faviconUrl,
    browserTabTitle: initialWebsite.browserTabTitle,
    departments: initialWebsite.departments || [],
  };

  const initialDoctors: HospitalDoctorItem[] = (initialWebsite.doctorDirectory || []).map((doc) => ({
    id: doc.id || doc.slug,
    doctorName: doc.doctorName,
    slug: doc.slug,
    gender: (doc as any).gender || "Male",
    degree: doc.degree,
    specialization: doc.specialization,
    yearsOfExperience: doc.yearsOfExperience,
    email: `${doc.slug}@${initialWebsite.slug}.com`,
    status: "ACTIVE" as const,
    doctorPhoto: doc.doctorPhoto,
  }));

  const handleSaveHospital = async (updated: Partial<HospitalData>) => {
    try {
      const res = await apiClient.patch<{ success: boolean; message?: string }>(`/organizations/me`, updated);
      if (res.success) {
        toast.success(res.message || "Hospital settings and theme updated successfully.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update hospital settings";
      toast.error(msg);
      throw err;
    }
  };

  const handleAddDoctor = async (doctorData: Partial<HospitalDoctorItem>) => {
    try {
      await apiClient.post(`/doctors`, doctorData);
    } catch (err) {
      console.warn("Doctor creation fallback:", err);
    }
  };

  const handleToggleDoctorStatus = async (doctorId: string, status: "ACTIVE" | "INACTIVE") => {
    try {
      await apiClient.patch(`/doctors/${doctorId}/status`, { status });
    } catch (err) {
      console.warn("Doctor status toggle fallback:", err);
    }
  };

  const handleUpdateDoctor = async (doctorId: string, updated: Partial<HospitalDoctorItem>) => {
    try {
      await apiClient.patch(`/doctors/${doctorId}`, updated);
    } catch (err) {
      console.warn("Doctor update fallback:", err);
    }
  };

  const handleUpdateAppt = async (apptId: string, status: string) => {
    try {
      await apiClient.patch(`/appointments/${apptId}/status`, { status });
    } catch (err) {
      console.warn("Appointment status update fallback:", err);
    }
  };

  return (
    <InactivityGuard logoutRedirectUrl={`/${slug}/admin/login`}>
      <HospitalAdmin
        initialHospital={hospitalData}
        initialDoctors={initialDoctors}
        initialAppointments={appointments}
        onSaveHospital={handleSaveHospital}
        onAddDoctor={handleAddDoctor}
        onToggleDoctorStatus={handleToggleDoctorStatus}
        onUpdateDoctor={handleUpdateDoctor}
        onUpdateAppointmentStatus={handleUpdateAppt}
        onLogout={handleLogout}
      />
    </InactivityGuard>
  );
}
