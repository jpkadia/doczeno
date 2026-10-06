import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveWebsite } from "@/lib/website";
import { ThemeRenderer } from "@/components/themes/theme-renderer";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Skip favicon/system routes
  if (slug === "favicon.ico" || slug === "robots.txt" || slug === "sitemap.xml") {
    return {};
  }

  const data = await getEffectiveWebsite(slug);
  if (!data) {
    return {
      title: "Page Not Found | Doczeno",
      robots: { index: false, follow: false },
    };
  }

  const title = data.browserTabTitle || `${data.organizationName} — Healthcare`;
  const description =
    data.seoMetadata?.description ||
    data.bio ||
    data.about ||
    `Consultation and clinical services at ${data.organizationName}.`;

  const ogImage = data.seoMetadata?.ogImage || data.logo?.url || data.doctorPhoto?.url;

  return {
    title,
    description,
    alternates: {
      canonical: `/${data.slug}`,
    },
    icons: {
      icon: data.faviconUrl || "/favicon.ico",
      shortcut: data.faviconUrl || "/favicon.ico",
    },
    openGraph: {
      title,
      description,
      url: `/${data.slug}`,
      siteName: data.organizationName,
      images: ogImage ? [{ url: ogImage }] : [],
      type: data.websiteType === "INDEPENDENT_DOCTOR" ? "profile" : "website",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PublicWebsitePage({ params }: PageProps) {
  const { slug } = await params;

  // Prevent routing conflicts
  if (slug === "favicon.ico" || slug === "robots.txt" || slug === "sitemap.xml") {
    notFound();
  }

  const data = await getEffectiveWebsite(slug);
  if (!data) {
    notFound();
  }

  return <ThemeRenderer data={data} />;
}
