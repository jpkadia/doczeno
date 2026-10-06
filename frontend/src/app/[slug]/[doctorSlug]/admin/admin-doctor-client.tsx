"use client";

import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import {
  HospitalDoctorAdmin,
  HospitalDoctorData,
  DoctorAppointmentItem,
} from "@/components/admin/views/hospital-doctor-admin";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

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

  React.useEffect(() => {
    async function verifyAuth() {
      try {
        await apiClient.get("/auth/me");
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 401) {
          router.replace(`/${orgSlug}/${doctorSlug}/admin/login`);
        }
      }
    }
    verifyAuth();
  }, [orgSlug, doctorSlug, router]);

  const doctorData: HospitalDoctorData = {
    id: doctorSlug,
    slug: doctorSlug,
    doctorName: initialWebsite.doctorName || "Rajiv Shah",
    gender: initialWebsite.gender || "Male",
    degree: initialWebsite.degree || "MBBS, DM (Cardiology)",
    specialization: initialWebsite.specialization || "Interventional Cardiology",
    yearsOfExperience: initialWebsite.yearsOfExperience || 14,
    whatsApp: initialWebsite.whatsApp || "+91 9876543210",
    email: initialWebsite.email || `${doctorSlug}@${orgSlug}.com`,
    phone: initialWebsite.phone || "+91 9876543210",
    bio: initialWebsite.bio || "Senior consultant cardiologist providing advanced clinical care.",
    doctorPhoto: initialWebsite.doctorPhoto,
    consultationHours: initialWebsite.consultationHours || "10:00 AM - 01:00 PM, 05:00 PM - 07:00 PM",
    weeklyOff: initialWebsite.weeklyOff || "Sunday",
    appointmentRequired: initialWebsite.appointmentRequired ?? true,
    status: "ACTIVE",
    inheritedHospitalData: {
      organizationId: initialWebsite.hospitalSlug || orgSlug,
      organizationName: initialWebsite.organizationName || "Apollo Hospitals Ahmedabad",
      organizationSlug: orgSlug,
      organizationType: initialWebsite.organizationType || "HOSPITAL",
      address: initialWebsite.address || {
        street: "Plot 1A, GIDC Bhat",
        city: "Ahmedabad",
        state: "Gujarat",
        pincode: "382428",
        country: "India",
      },
      logo: initialWebsite.logo,
      galleryPhotos: initialWebsite.galleryPhotos || [],
      selectedTheme: initialWebsite.selectedTheme || "clinical-editorial",
      faviconUrl: initialWebsite.faviconUrl,
      browserTabTitle: initialWebsite.browserTabTitle || `${initialWebsite.organizationName} — Healthcare`,
      isLocked: true,
      lockMessage: "Managed by Hospital Admin",
    },
    publishStatus: "PUBLISHED",
  };

  const initialAppointments: DoctorAppointmentItem[] = [
    {
      id: "doc-appt-1",
      patientName: "Kavita Reddy",
      patientPhone: "+91 98765 33333",
      appointmentDate: "2026-10-14",
      timeSlot: "10:00 AM",
      status: "CONFIRMED",
      notes: "Echo & consultation",
    },
    {
      id: "doc-appt-2",
      patientName: "Rohan Varma",
      patientPhone: "+91 98765 44444",
      appointmentDate: "2026-10-15",
      timeSlot: "11:30 AM",
      status: "PENDING",
      notes: "Follow-up",
    },
  ];

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

  return (
    <HospitalDoctorAdmin
      initialData={doctorData}
      initialAppointments={initialAppointments}
      onSave={handleSave}
      onUpdateAppointmentStatus={handleUpdateAppt}
    />
  );
}
