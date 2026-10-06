import { EffectiveWebsiteData } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/**
 * Server-side data fetching for single-slug routes (Independent Doctor or Hospital/Clinic)
 * Utilizes Next.js caching with 60-second revalidation for optimal performance.
 */
export async function getEffectiveWebsite(slug: string): Promise<EffectiveWebsiteData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/websites/effective/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return (json.data as EffectiveWebsiteData) || null;
  } catch {
    return null;
  }
}

/**
 * Server-side data fetching for dual-slug routes (Hospital Doctor: /:orgSlug/:doctorSlug)
 * Resolves child doctor data with runtime parent inheritance.
 */
export async function getEffectiveHospitalDoctor(
  orgSlug: string,
  doctorSlug: string
): Promise<EffectiveWebsiteData | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/websites/effective/${encodeURIComponent(orgSlug)}/${encodeURIComponent(doctorSlug)}`,
      {
        next: { revalidate: 60 },
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return (json.data as EffectiveWebsiteData) || null;
  } catch {
    return null;
  }
}
