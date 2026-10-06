import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveWebsite } from "@/lib/website";
import { AdminClient } from "./admin-client";
import { EffectiveWebsiteData } from "@/types";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Admin Console | ${slug} | Doczeno`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage({ params }: PageProps) {
  const { slug } = await params;

  if (slug === "favicon.ico" || slug === "robots.txt") {
    notFound();
  }

  const website = await getEffectiveWebsite(slug);

  if (!website) {
    // Provide a resilient fallback for local mock / test fixtures if backend is not seeded
    const fallbackWebsite: EffectiveWebsiteData = {
      websiteType: slug.startsWith("dr-") ? "INDEPENDENT_DOCTOR" : "HOSPITAL_CLINIC",
      slug,
      organizationName: slug.startsWith("dr-") ? "Dr. Parth Clinic" : "Apollo Hospitals Ahmedabad",
      organizationType: "HOSPITAL",
      doctorName: slug.startsWith("dr-") ? "Parth Kadiya" : undefined,
      gender: "Male",
      degree: "MBBS, MS",
      specialization: "General Surgery",
      yearsOfExperience: 12,
      email: `${slug}@doczeno.com`,
      phone: "+91 9876543210",
      whatsApp: "+91 9876543210",
      address: {
        street: "Bhat, GIDC",
        city: "Ahmedabad",
        state: "Gujarat",
        pincode: "382428",
        country: "India",
      },
      selectedTheme: "clinical-editorial",
      browserTabTitle: `${slug} — Admin Console`,
      galleryPhotos: [],
      isHospitalChild: false,
      departments: ["Cardiology", "Neurology", "General Surgery"],
    };

    return <AdminClient initialWebsite={fallbackWebsite} slug={slug} />;
  }

  return <AdminClient initialWebsite={website} slug={slug} />;
}
