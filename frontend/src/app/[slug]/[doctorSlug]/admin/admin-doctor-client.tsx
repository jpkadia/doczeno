"use client";

import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import {
  HospitalDoctorAdmin,
  HospitalDoctorData,
  DoctorAppointmentItem,
} from "@/components/admin/views/hospital-doctor-admin";
import { apiClient, clearClientAuthState } from "@/lib/api-client";
import { useRouter } from "next/navigation";

import { InactivityGuard } from "@/components/admin/inactivity-guard";
import { SmartAdminLoadingSkeleton } from "@/components/admin/admin-skeleton";
import { toast } from "sonner";

interface AdminDoctorClientProps {
  initialWebsite: EffectiveWebsiteData;
  orgSlug: string;
  doctorSlug: string;
}

export function AdminDoctorClient({
  initialWebsite,
  orgSlug,
  doctorSlug,
}: AdminDoctorClientProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [loginPath, setLoginPath] = React.useState(`/${orgSlug}/${doctorSlug}/admin/login`);

  React.useEffect(() => {
    const isCustomDomain =
      typeof window !== "undefined" &&
      (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/"));
    const targetLoginPath = isCustomDomain ? "/admin/login" : `/${orgSlug}/${doctorSlug}/admin/login`;
    setLoginPath(targetLoginPath);

    async function verifyAuth() {
      try {
        const res = await apiClient.get<{ success: boolean; data?: { authorized?: boolean } }>(
          `/auth/me?targetSlug=${encodeURIComponent(orgSlug)}&doctorSlug=${encodeURIComponent(doctorSlug)}`
        );
        if (res.success && res.data?.authorized) {
          setIsAuthenticated(true);
        } else {
          if (typeof window !== "undefined") {
            window.location.replace(`${targetLoginPath}?unauthorized=true`);
          } else {
            router.replace(`${targetLoginPath}?unauthorized=true`);
          }
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        const code = (err as { data?: { code?: string } })?.data?.code;
        if (status === 403) {
          toast.error("Unauthorized: You do not have permission to manage this doctor portal.");
          if (typeof window !== "undefined") {
            window.location.replace(`${targetLoginPath}?unauthorized=true`);
          } else {
            router.replace(`${targetLoginPath}?unauthorized=true`);
          }
        } else {
          const redirectDest =
            code === "SESSION_INACTIVITY_EXPIRED"
              ? `${targetLoginPath}?reason=inactivity`
              : targetLoginPath;
          if (typeof window !== "undefined") {
            window.location.replace(redirectDest);
          } else {
            router.replace(redirectDest);
          }
        }
      } finally {
        setIsCheckingAuth(false);
      }
    }
    verifyAuth();
  }, [orgSlug, doctorSlug, router]);

  const [appointments, setAppointments] = React.useState<DoctorAppointmentItem[]>([]);

  React.useEffect(() => {
    async function loadDoctorAppointments() {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { appointments?: any[] };
        }>("/appointments");
        if (res.success && res.data?.appointments) {
          setAppointments(
            res.data.appointments.map((a: any) => ({
              id: a._id || a.id,
              appointmentId: a.appointmentId || "",
              tokenNumber: typeof a.tokenNumber === "number" ? a.tokenNumber : undefined,
              source: a.source || "WEBSITE_FORM",
              patientName: a.patientName,
              patientPhone: a.patientPhone,
              patientAge: a.patientAge,
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
    if (isAuthenticated) {
      loadDoctorAppointments();
    }
  }, [isAuthenticated]);

  if (isCheckingAuth || !isAuthenticated) {
    return <SmartAdminLoadingSkeleton />;
  }

  const doctorData: HospitalDoctorData = {
    id: initialWebsite.doctorId || doctorSlug,
    slug: doctorSlug,
    doctorName: initialWebsite.doctorName || "Doctor",
    gender: initialWebsite.gender || "Male",
    degree: initialWebsite.degree || "",
    specialization: initialWebsite.specialization || "",
    yearsOfExperience: initialWebsite.yearsOfExperience || 0,
    whatsApp: initialWebsite.whatsApp || "",
    email: initialWebsite.email || `${doctorSlug}@${orgSlug}.com`,
    phone: initialWebsite.phone || "",
    bio: initialWebsite.bio || "",
    doctorPhoto: initialWebsite.doctorPhoto,
    consultationHours: initialWebsite.consultationHours || "10:00 AM - 01:00 PM, 05:00 PM - 07:00 PM",
    weeklyOff: initialWebsite.weeklyOff || "Sunday",
    appointmentRequired: initialWebsite.appointmentRequired ?? true,
    status: "ACTIVE",
    inheritedHospitalData: {
      organizationId: initialWebsite.hospitalSlug || orgSlug,
      organizationName: initialWebsite.organizationName || "Hospital",
      organizationSlug: orgSlug,
      organizationType: initialWebsite.organizationType || "HOSPITAL",
      address: initialWebsite.address,
      logo: initialWebsite.logo,
      galleryPhotos: initialWebsite.galleryPhotos || [],
      selectedTheme: initialWebsite.selectedTheme || "hospital-classic",
      faviconUrl: initialWebsite.faviconUrl,
      browserTabTitle: initialWebsite.browserTabTitle || `${initialWebsite.organizationName || "Hospital"} — Healthcare`,
      isLocked: true,
      lockMessage: "Managed by Hospital Admin",
    },
    publishStatus: "PUBLISHED",
    isWebsiteChatbotEnabled: initialWebsite.isWebsiteChatbotEnabled !== false,
    isAdminChatbotEnabled: initialWebsite.isAdminChatbotEnabled !== false,
  };

  const handleSave = async (updated: Partial<HospitalDoctorData>) => {
    try {
      await apiClient.patch(`/doctors/me`, updated);
    } catch (err) {
      console.warn("Doctor profile update fallback:", err);
    }
  };

  const handleUpdateAppt = async (apptId: string, status: string) => {
    try {
      await apiClient.patch(`/appointments/${apptId}/status`, { status });
    } catch (err) {
      console.warn("Appointment status update fallback:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      toast.success("Logged out successfully.");
    } catch {
      // Ignore
    } finally {
      clearClientAuthState();
      if (typeof window !== "undefined") {
        window.location.replace(loginPath);
      } else {
        router.replace(loginPath);
      }
    }
  };

  return (
    <InactivityGuard logoutRedirectUrl={loginPath}>
      <HospitalDoctorAdmin
        initialData={doctorData}
        initialAppointments={appointments}
        onSave={handleSave}
        onUpdateAppointmentStatus={handleUpdateAppt}
        onLogout={handleLogout}
      />
    </InactivityGuard>
  );
}
