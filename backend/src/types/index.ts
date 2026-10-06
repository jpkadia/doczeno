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

export interface AuthUserPayload {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  organizationId?: string | null;
  doctorProfileId?: string | null;
}

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

export interface DoctorDirectoryItem {
  id: string;
  doctorId?: string;
  doctorName: string;
  degree: string;
  specialization: string;
  yearsOfExperience: number;
  slug: string;
  doctorPhoto?: MediaAsset;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface EffectiveWebsiteData {
  websiteType: WebsiteType;
  slug: string;
  // Resolved organization/hospital info (inherited for hospital doctor)
  organizationName: string;
  organizationType?: "HOSPITAL" | "CLINIC";
  logo?: MediaAsset;
  galleryPhotos: MediaAsset[];
  address: AddressInfo;
  selectedTheme: string;
  faviconUrl?: string;
  browserTabTitle: string;
  phone?: string;
  whatsApp?: string;
  email?: string;
  about?: string;
  workingHours?: string;
  // Doctor info if doctor website
  doctorName?: string;
  gender?: string;
  degree?: string;
  specialization?: string;
  yearsOfExperience?: number;
  bio?: string;
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
  doctorPhoto?: MediaAsset;
  isHospitalChild: boolean;
  hospitalSlug?: string;
  // Hospital affiliated doctor directory & services
  doctorDirectory?: DoctorDirectoryItem[];
  departments?: string[];
  faqs?: FaqItem[];
  seoMetadata?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}
