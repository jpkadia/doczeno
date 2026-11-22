import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getEffectiveHospitalDoctor } from "@/lib/website";
import { ThemeRenderer } from "@/components/themes/theme-renderer";
import { AlertTriangle } from "lucide-react";

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

  const rawFavicon = data.faviconUrl?.trim();
  const hasCustomFavicon = Boolean(
    rawFavicon &&
    !rawFavicon.includes("doctor_photo") &&
    !rawFavicon.includes("clinic_photos")
  );

  const icons: Metadata["icons"] = hasCustomFavicon
    ? {
        icon: [
          { url: `/api/favicon?url=${encodeURIComponent(rawFavicon!)}` },
          { url: "/favicon.svg", type: "image/svg+xml" },
          { url: "/favicon.ico", sizes: "any" },
        ],
        shortcut: `/api/favicon?url=${encodeURIComponent(rawFavicon!)}`,
        apple: `/api/favicon?url=${encodeURIComponent(rawFavicon!)}`,
      }
    : {
        icon: [
          { url: "/favicon.svg", type: "image/svg+xml" },
          { url: "/icon-round.png", type: "image/png" },
          { url: "/favicon.ico", sizes: "any" },
        ],
        shortcut: "/favicon.svg",
        apple: "/icon-round.png",
      };

  return {
    title,
    description,
    alternates: {
      canonical: `/${data.slug}`,
    },
    icons,
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

  if (data.isDeactivated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-slate-800/90 border border-slate-700/80 shadow-2xl space-y-6">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Website Notice</h1>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              Your website is temporarily deactivated. Please contact admin.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-700/50">
            <p className="text-xs text-slate-400">
              Doczeno Platform Administration
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("doczeno_site_theme_mode")?.value;
  const initialThemeMode: "light" | "dark" = cookieTheme === "dark" ? "dark" : "light";

  return <ThemeRenderer data={data} initialThemeMode={initialThemeMode} />;
}
