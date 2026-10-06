import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveHospitalDoctor } from "@/lib/website";
import { ThemeRenderer } from "@/components/themes/theme-renderer";

interface HospitalDoctorPageProps {
  params: Promise<{
    slug: string;
    doctorSlug: string;
  }>;
}

export async function generateMetadata({ params }: HospitalDoctorPageProps): Promise<Metadata> {
  const { slug, doctorSlug } = await params;
  const data = await getEffectiveHospitalDoctor(slug, doctorSlug);

  if (!data) {
    return {
      title: "Doctor Profile Not Found | Doczeno",
      robots: { index: false, follow: false },
    };
  }

  // Hospital doctor inherits parent hospital's browser tab title and favicon
  const title =
    data.browserTabTitle ||
    `Dr. ${data.doctorName} — ${data.specialization} | ${data.organizationName}`;

  const description =
    data.seoMetadata?.description ||
    data.bio ||
    `Consult Dr. ${data.doctorName} (${data.degree}) specializing in ${data.specialization} at ${data.organizationName}.`;

  const ogImage = data.seoMetadata?.ogImage || data.doctorPhoto?.url || data.logo?.url;

  return {
    title,
    description,
    alternates: {
      canonical: `/${data.slug}`,
    },
    icons: {
      icon: data.faviconUrl || "/favicon.ico", // Inherited favicon from parent organization
      shortcut: data.faviconUrl || "/favicon.ico",
    },
    openGraph: {
      title,
      description,
      url: `/${data.slug}`,
      siteName: data.organizationName, // Inherited parent organization name
      images: ogImage ? [{ url: ogImage }] : [],
      type: "profile",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function HospitalDoctorPage({ params }: HospitalDoctorPageProps) {
  const { slug, doctorSlug } = await params;
  const data = await getEffectiveHospitalDoctor(slug, doctorSlug);

  if (!data) {
    notFound();
  }

  return <ThemeRenderer data={data} />;
}
