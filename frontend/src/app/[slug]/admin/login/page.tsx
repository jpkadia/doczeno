import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveWebsite } from "@/lib/website";
import { SlugAdminLoginClient } from "./slug-login-client";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const website = await getEffectiveWebsite(slug);
  if (!website) {
    return {
      title: "Page Not Found | Doczeno",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `Admin Login | ${website.doctorName ? `Dr. ${website.doctorName}` : website.organizationName || slug} | Doczeno`,
    robots: { index: false, follow: false },
  };
}

export default async function SlugAdminLoginPage({ params }: PageProps) {
  const { slug } = await params;

  if (slug === "favicon.ico" || slug === "robots.txt") {
    notFound();
  }

  const website = await getEffectiveWebsite(slug);

  if (!website) {
    notFound();
  }

  const displayName = website.doctorName
    ? `Dr. ${website.doctorName}`
    : website.organizationName || slug;

  const subtitle = website.specialization
    ? `${website.specialization} &bull; ${website.organizationName || "Clinic"}`
    : website.organizationName || "Healthcare Administration";

  return (
    <SlugAdminLoginClient
      slug={slug}
      displayName={displayName}
      subtitle={subtitle}
      logoUrl={website.logo?.url || website.doctorPhoto?.url}
    />
  );
}
