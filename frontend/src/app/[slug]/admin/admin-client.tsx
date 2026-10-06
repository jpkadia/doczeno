"use client";

import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import { IndependentDoctorAdmin, IndependentDoctorData, AppointmentItem } from "@/components/admin/views/independent-doctor-admin";
import { HospitalAdmin, HospitalData, HospitalDoctorItem, HospitalAppointmentItem } from "@/components/admin/views/hospital-admin";
import { apiClient } from "@/lib/api-client";

interface AdminClientProps {
  initialWebsite: EffectiveWebsiteData;
  slug: string;
}

export function AdminClient({ initialWebsite, slug }: AdminClientProps) {
  void slug;
  // 1. Determine if this is an Independent Doctor or Hospital/Clinic
  const isDoctor = initialWebsite.websiteType === "INDEPENDENT_DOCTOR";

  if (isDoctor) {
    const doctorData: IndependentDoctorData = {
      id: initialWebsite.slug,
      slug: initialWebsite.slug,
      doctorName: initialWebsite.doctorName || "Doctor",
      gender: initialWebsite.gender || "Male",
      degree: initialWebsite.degree || "MBBS, MD",
      specialization: initialWebsite.specialization || "General Medicine",
      yearsOfExperience: initialWebsite.yearsOfExperience || 10,
      whatsApp: initialWebsite.whatsApp || "+91 9876543210",
      email: initialWebsite.email || "doctor@doczeno.com",
      phone: initialWebsite.phone || "+91 9876543210",
      bio: initialWebsite.bio || "",
      doctorPhoto: initialWebsite.doctorPhoto,
      clinicName: initialWebsite.organizationName,
      address: initialWebsite.address,
      clinicLogo: initialWebsite.logo,
      clinicPhotos: initialWebsite.galleryPhotos,
      consultationHours: initialWebsite.consultationHours || "09:00 AM - 01:00 PM, 05:00 PM - 08:00 PM",
      weeklyOff: initialWebsite.weeklyOff || "Sunday",
      appointmentRequired: initialWebsite.appointmentRequired ?? true,
      selectedTheme: initialWebsite.selectedTheme || "clinical-editorial",
      faviconUrl: initialWebsite.faviconUrl,
      browserTabTitle: initialWebsite.browserTabTitle,
      publishStatus: "PUBLISHED",
    };

    const initialAppointments: AppointmentItem[] = [
      {
        id: "appt-1",
        patientName: "Aarav Patel",
        patientPhone: "+91 98765 43210",
        appointmentDate: "2026-10-10",
        timeSlot: "10:30 AM",
        status: "CONFIRMED",
        notes: "Routine health checkup",
      },
      {
        id: "appt-2",
        patientName: "Priya Sharma",
        patientPhone: "+91 91234 56789",
        appointmentDate: "2026-10-11",
        timeSlot: "11:15 AM",
        status: "PENDING",
        notes: "Follow-up consultation",
      },
    ];

    const handleSave = async (updated: Partial<IndependentDoctorData>) => {
      try {
        await apiClient.patch(`/doctors/me`, updated);
      } catch (err) {
        console.warn("API update fallback:", err);
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
      <IndependentDoctorAdmin
        initialData={doctorData}
        initialAppointments={initialAppointments}
        onSave={handleSave}
        onUpdateAppointmentStatus={handleUpdateAppointment}
      />
    );
  }

  // 2. Otherwise Hospital / Clinic
  const hospitalData: HospitalData = {
    id: initialWebsite.slug,
    name: initialWebsite.organizationName,
    slug: initialWebsite.slug,
    type: initialWebsite.organizationType || "HOSPITAL",
    about: initialWebsite.about || "",
    phone: initialWebsite.phone || "+91 79 2660 5555",
    whatsApp: initialWebsite.whatsApp || "+91 9876543210",
    email: initialWebsite.email || "contact@hospital.com",
    address: initialWebsite.address,
    workingHours: initialWebsite.workingHours || "Open 24/7 (Emergency & OPD)",
    weeklyOff: initialWebsite.weeklyOff || "None (Open 7 Days)",
    appointmentRequired: initialWebsite.appointmentRequired ?? false,
    selectedTheme: initialWebsite.selectedTheme || "clinical-editorial",
    logo: initialWebsite.logo,
    galleryPhotos: initialWebsite.galleryPhotos,
    faviconUrl: initialWebsite.faviconUrl,
    browserTabTitle: initialWebsite.browserTabTitle,
    departments: initialWebsite.departments || ["Cardiology", "Neurology", "Orthopedics"],
  };

  const initialDoctors: HospitalDoctorItem[] = (initialWebsite.doctorDirectory || []).map((doc) => ({
    id: doc.id || doc.slug,
    doctorName: doc.doctorName,
    slug: doc.slug,
    gender: "Male",
    degree: doc.degree,
    specialization: doc.specialization,
    yearsOfExperience: doc.yearsOfExperience,
    email: `${doc.slug}@${initialWebsite.slug}.com`,
    status: "ACTIVE" as const,
    doctorPhoto: doc.doctorPhoto,
  }));

  const initialAppointments: HospitalAppointmentItem[] = [
    {
      id: "h-appt-1",
      patientName: "Meera Desai",
      patientPhone: "+91 98765 11111",
      appointmentDate: "2026-10-12",
      timeSlot: "09:30 AM",
      status: "CONFIRMED",
      doctorName: initialDoctors[0]?.doctorName,
    },
    {
      id: "h-appt-2",
      patientName: "Vikram Mehta",
      patientPhone: "+91 98765 22222",
      appointmentDate: "2026-10-12",
      timeSlot: "11:00 AM",
      status: "PENDING",
      doctorName: initialDoctors[0]?.doctorName,
    },
  ];

  const handleSaveHospital = async (updated: Partial<HospitalData>) => {
    try {
      await apiClient.patch(`/organizations/me`, updated);
    } catch (err) {
      console.warn("Hospital update fallback:", err);
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
    <HospitalAdmin
      initialHospital={hospitalData}
      initialDoctors={initialDoctors}
      initialAppointments={initialAppointments}
      onSaveHospital={handleSaveHospital}
      onAddDoctor={handleAddDoctor}
      onToggleDoctorStatus={handleToggleDoctorStatus}
      onUpdateDoctor={handleUpdateDoctor}
      onUpdateAppointmentStatus={handleUpdateAppt}
    />
  );
}
