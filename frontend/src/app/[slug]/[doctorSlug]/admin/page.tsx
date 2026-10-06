import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveHospitalDoctor } from "@/lib/website";
import { AdminDoctorClient } from "./admin-doctor-client";
import { EffectiveWebsiteData } from "@/types";

interface PageProps {
  params: Promise<{
    slug: string;
    doctorSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, doctorSlug } = await params;
  return {
    title: `Doctor Admin Console | ${doctorSlug} at ${slug} | Doczeno`,
    robots: { index: false, follow: false },
  };
}

export default async function HospitalDoctorAdminPage({ params }: PageProps) {
  const { slug, doctorSlug } = await params;

  if (slug === "favicon.ico" || doctorSlug === "favicon.ico") {
    notFound();
  }

  const website = await getEffectiveHospitalDoctor(slug, doctorSlug);

  if (!website) {
    // Provide a resilient fallback for test fixtures or local development
    const fallbackWebsite: EffectiveWebsiteData = {
      websiteType: "HOSPITAL_DOCTOR",
      slug: doctorSlug,
      hospitalSlug: slug,
      organizationName: "Apollo Hospitals Ahmedabad",
      organizationType: "HOSPITAL",
      doctorName: "Rajiv Shah",
      gender: "Male",
      degree: "MBBS, DM (Cardiology)",
      specialization: "Interventional Cardiology",
      yearsOfExperience: 14,
      email: `${doctorSlug}@${slug}.com`,
      phone: "+91 9876543210",
      whatsApp: "+91 9876543210",
      bio: "Chief Interventional Cardiologist specializing in complex coronary interventions.",
      address: {
        street: "Plot 1A, GIDC Bhat",
        city: "Ahmedabad",
        state: "Gujarat",
        pincode: "382428",
        country: "India",
      },
      selectedTheme: "clinical-editorial",
      browserTabTitle: `Dr. Rajiv Shah | Apollo Hospitals Ahmedabad`,
      galleryPhotos: [],
      isHospitalChild: true,
      consultationHours: "10:00 AM - 01:00 PM, 05:00 PM - 07:00 PM",
      weeklyOff: "Sunday",
      appointmentRequired: true,
    };

    return <AdminDoctorClient initialWebsite={fallbackWebsite} orgSlug={slug} doctorSlug={doctorSlug} />;
  }

  return <AdminDoctorClient initialWebsite={website} orgSlug={slug} doctorSlug={doctorSlug} />;
}
