import { EffectiveWebsiteData } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/**
 * Server-side data fetching for single-slug routes (Only Doctor or Hospital/Clinic)
 * Utilizes Next.js caching with 60-second revalidation for optimal performance.
 */
export async function getEffectiveWebsite(slug: string): Promise<EffectiveWebsiteData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/websites/effective/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return (json.data as EffectiveWebsiteData) || null;
  } catch (err) {
    console.error("getEffectiveWebsite error for slug:", slug, err);
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
        cache: "no-store",
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
  } catch (err) {
    console.error("getEffectiveHospitalDoctor error:", orgSlug, doctorSlug, err);
    return null;
  }
}
