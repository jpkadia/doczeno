/**
 * Doczeno Core Domain Types & Role Definitions
 */

export const UserRole = {
  SUPERADMIN: "SUPERADMIN",
  HOSPITAL_ADMIN: "HOSPITAL_ADMIN",
  HOSPITAL_DOCTOR: "HOSPITAL_DOCTOR",
  INDEPENDENT_DOCTOR: "INDEPENDENT_DOCTOR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const WebsiteType = {
  INDEPENDENT_DOCTOR: "INDEPENDENT_DOCTOR",
  HOSPITAL_CLINIC: "HOSPITAL_CLINIC",
  HOSPITAL_DOCTOR: "HOSPITAL_DOCTOR",
} as const;

export type WebsiteType = (typeof WebsiteType)[keyof typeof WebsiteType];

export interface AddressInfo {
  street?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface MediaAsset {
  url: string;
  publicId?: string;
  altText?: string;
  caption?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  mimeType?: string;
}

/**
 * Hospital / Clinic public details that are inherited by child hospital doctors
 */
export interface HospitalPublicInfo {
  organizationName: string;
  logo?: MediaAsset;
  galleryPhotos: MediaAsset[];
  address: AddressInfo;
  themeId: string;
  faviconUrl?: string;
  browserTabTitle: string;
}

/**
 * Resolved runtime data for a Doctor website (handles runtime inheritance from Hospital if applicable)
 */
export interface EffectiveDoctorWebsiteData {
  doctorName: string;
  slug: string;
  qualification: string;
  specialties: string[];
  bio?: string;
  photo?: MediaAsset;
  // Runtime inherited or doctor-owned fields:
  organizationName: string;
  logo?: MediaAsset;
  galleryPhotos: MediaAsset[];
  address: AddressInfo;
  themeId: string;
  faviconUrl?: string;
  browserTabTitle: string;
  isHospitalChild: boolean;
  hospitalSlug?: string;
}

export interface TenantSession {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  doctorProfileId?: string;
}
