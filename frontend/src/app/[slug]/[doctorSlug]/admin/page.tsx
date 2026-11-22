import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getEffectiveHospitalDoctor } from "@/lib/website";
import { AdminDoctorClient } from "./admin-doctor-client";

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

  // Pre-check authentication on server: unauthenticated users redirect immediately to login
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("doczeno_session")?.value;
  if (!sessionCookie) {
    redirect(`/${slug}/${doctorSlug}/admin/login`);
  }

  const website = await getEffectiveHospitalDoctor(slug, doctorSlug);

  if (!website) {
    notFound();
  }

  return <AdminDoctorClient initialWebsite={website} orgSlug={slug} doctorSlug={doctorSlug} />;
}
