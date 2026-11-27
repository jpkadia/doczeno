export const UserRole = {
  SUPERADMIN: "SUPERADMIN",
  HOSPITAL_ADMIN: "HOSPITAL_ADMIN",
  HOSPITAL_DOCTOR: "HOSPITAL_DOCTOR",
  ONLY_DOCTOR: "ONLY_DOCTOR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const WebsiteType = {
  ONLY_DOCTOR: "ONLY_DOCTOR",
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
  sessionId?: string;
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

export interface ServiceItem {
  title: string;
  description: string;
}

export interface DepartmentDetailedItem {
  name: string;
  description: string;
}

export interface TestimonialItem {
  id?: string;
  patientName: string;
  rating: number;
  comment: string;
  tag?: string;
  isVerified?: boolean;
  createdAt?: string;
}

export interface EffectiveWebsiteData {
  websiteType: WebsiteType;
  slug: string;
  // Resolved organization/hospital info (inherited for hospital doctor)
  organizationName: string;
  organizationType?: "HOSPITAL" | "CLINIC";
  logo?: MediaAsset;
  buildingPhoto?: MediaAsset;
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
  tagline?: string;
  shortIntro?: string;
  clinicDescription?: string;
  services?: ServiceItem[];
  departmentsDetailed?: DepartmentDetailedItem[];
  // Doctor info if doctor website
  doctorId?: string;
  organizationId?: string;
  doctorName?: string;
  gender?: string;
  degree?: string;
  specialization?: string;
  yearsOfExperience?: number;
  newCaseFee?: number;
  oldCaseFee?: number;
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
  specialties?: string[];
  faqs?: FaqItem[];
  testimonials?: TestimonialItem[];
  seoMetadata?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  websiteContent?: Record<string, any>;
  isDeactivated?: boolean;
  deactivationMessage?: string;
  isPendingApproval?: boolean;
  approvalMessage?: string;
  isTempPreview?: boolean;
  isWebsiteChatbotEnabled?: boolean;
  isAdminChatbotEnabled?: boolean;
  customDomain?: string;
  customDomainStatus?: "NONE" | "PENDING" | "VERIFIED" | "FAILED";
  customDomainRedirect?: boolean;
}
