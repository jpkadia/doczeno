import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveHospitalDoctor } from "@/lib/website";
import { SlugAdminLoginClient } from "@/app/[slug]/admin/login/slug-login-client";

interface PageProps {
  params: Promise<{
    slug: string;
    doctorSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { doctorSlug } = await params;
  return {
    title: `Doctor Admin Login | ${doctorSlug} | Doczeno`,
    robots: { index: false, follow: false },
  };
}

export default async function HospitalDoctorAdminLoginPage({ params }: PageProps) {
  const { slug, doctorSlug } = await params;

  if (slug === "favicon.ico" || doctorSlug === "favicon.ico") {
    notFound();
  }

  const website = await getEffectiveHospitalDoctor(slug, doctorSlug);

  const displayName = website?.doctorName ? `Dr. ${website.doctorName}` : doctorSlug;
  const subtitle = `Affiliated Doctor &bull; ${website?.organizationName || slug}`;

  return (
    <SlugAdminLoginClient
      slug={doctorSlug}
      displayName={displayName}
      subtitle={subtitle}
      logoUrl={website?.doctorPhoto?.url || website?.logo?.url}
    />
  );
}
