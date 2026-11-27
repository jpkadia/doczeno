export interface OnboardingCategoriesState {
  portalEnabled: boolean;
  onlyDoctor: boolean;
  hospital: boolean;
  hospitalDoctor: boolean;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/**
 * Fetches live onboarding category availability from the backend without caching
 * so Superadmin toggles take effect immediately across all onboarding routes.
 */
export async function getOnboardingCategories(): Promise<OnboardingCategoriesState> {
  try {
    const res = await fetch(`${API_BASE_URL}/onboarding/platform-config`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { portalEnabled: true, onlyDoctor: true, hospital: true, hospitalDoctor: true };
    }
    const json = await res.json();
    const cats = json?.data?.onboardingCategories;
    return {
      portalEnabled: cats?.portalEnabled !== false,
      onlyDoctor: cats?.onlyDoctor !== false,
      hospital: cats?.hospital !== false,
      hospitalDoctor: cats?.hospitalDoctor !== false,
    };
  } catch {
    return { portalEnabled: true, onlyDoctor: true, hospital: true, hospitalDoctor: true };
  }
}
