import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveWebsite } from "@/lib/website";
import { AdminClient } from "./admin-client";

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
    notFound();
  }

  return <AdminClient initialWebsite={website} slug={slug} />;
}
