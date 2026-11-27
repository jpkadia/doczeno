/**
 * Standardized Section Meta & Content Plan across all 4 themes.
 * Guarantees 100% identical section names, badges, subtitles, and labels.
 */
export const SECTION_META = {
  hero: {
    verifiedBadge: "Verified Healthcare Provider",
    bookBtn: "Book Appointment",
    whatsAppBtn: "Chat on WhatsApp",
    callBtn: "Call Clinic",
  },
  about: {
    badge: "Clinical Profile",
    title: "About Our Practice",
    subtitle: "Dedicated to delivering compassionate, evidence-based healthcare and patient-first clinical standards.",
    cardHoursTitle: "Consultation Hours",
    cardCredentialsTitle: "Qualifications & Specialty",
    cardFacilityTitle: "In-Clinic Facility",
  },
  treatments: {
    badge: "Specialized Care",
    title: "Clinical Treatments & Services",
    subtitle: "Comprehensive diagnostic evaluations, evidence-based treatment regimens, and dedicated patient care.",
    bookBtn: "Book Consultation",
  },
  doctors: {
    badge: "Medical Faculty",
    title: "Hospital Medical Faculty",
    subtitle: "Consult with our team of verified senior specialists across core medical departments.",
    viewProfileBtn: "View Profile",
  },
  gallery: {
    badge: "Facility Overview",
    title: "Clinical Facility & Infrastructure",
    subtitle: "Modern examination suites, hygienic patient amenities, and advanced medical infrastructure.",
  },
  reviews: {
    badge: "Patient Trust",
    title: "Patient Testimonials & Reviews",
    subtitle: "Authentic clinical reviews and recovery experiences shared by verified patients.",
  },
  timetable: {
    badge: "OPD Schedule",
    title: "Consultation Hours & Timetable",
    subtitle: "Review daily outpatient hours and planned consultation slots.",
  },
  queue: {
    badge: "Patient Portal",
    title: "Appointment Desk & Live Queue",
    subtitle: "Track real-time queue tokens, confirm appointment status, or manage bookings.",
  },
  faqs: {
    badge: "Helpful Answers",
    title: "Frequently Asked Questions",
    subtitle: "Answers to frequent queries regarding consultations, appointments, and clinic policies.",
  },
  contact: {
    badge: "Get in Touch",
    title: "Clinic Location & Contact",
    subtitle: "Direct communication channels and physical location details for in-person visits.",
    directionsBtn: "Open in Google Maps",
  },
  footer: {
    platformBrand: "Doczeno Healthcare Platform • Encrypted & Protected",
    quickLinksTitle: "Quick Navigation",
    contactTitle: "Contact Reception",
  },
};

export type ReorderableSectionId =
  | "services"
  | "doctors"
  | "facility"
  | "reviews"
  | "timings"
  | "faqs"
  | "custom";

export type CustomSectionLayout = "cards" | "narrative" | "highlights";

export interface CustomSectionCard {
  title: string;
  description: string;
}

export interface CustomSectionPoint {
  heading: string;
  detail: string;
}

export interface CustomSectionConfig {
  enabled: boolean;
  navLabel?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  layout: CustomSectionLayout;
  cards: CustomSectionCard[];
  paragraph: string;
  points: CustomSectionPoint[];
}

export const LOCKED_SECTION_IDS = ["home", "about", "footer"] as const;

export const DOCTOR_DEFAULT_SECTION_ORDER: readonly ReorderableSectionId[] = [
  "services",
  "facility",
  "reviews",
  "timings",
  "faqs",
  "custom",
];

export const HOSPITAL_DEFAULT_SECTION_ORDER: readonly ReorderableSectionId[] = [
  "services",
  "doctors",
  "facility",
  "reviews",
  "timings",
  "faqs",
];

export function resolveNormalizedSectionOrder(
  isHospital: boolean,
  rawOrder?: unknown
): ReorderableSectionId[] {
  const defaults = isHospital ? HOSPITAL_DEFAULT_SECTION_ORDER : DOCTOR_DEFAULT_SECTION_ORDER;
  const allowed = new Set<string>(defaults);
  const result: ReorderableSectionId[] = [];
  const seen = new Set<string>();

  if (Array.isArray(rawOrder)) {
    for (const entry of rawOrder) {
      const id = String(entry || "").trim();
      if (allowed.has(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id as ReorderableSectionId);
      }
    }
  }

  for (const id of defaults) {
    if (!seen.has(id)) {
      result.push(id);
    }
  }
  return result;
}

export function resolveNormalizedHiddenSections(
  isHospital: boolean,
  rawHidden?: unknown
): ReorderableSectionId[] {
  const defaults = isHospital ? HOSPITAL_DEFAULT_SECTION_ORDER : DOCTOR_DEFAULT_SECTION_ORDER;
  const allowed = new Set<string>(defaults);
  const result: ReorderableSectionId[] = [];
  const seen = new Set<string>();

  if (Array.isArray(rawHidden)) {
    for (const entry of rawHidden) {
      const id = String(entry || "").trim();
      if (allowed.has(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id as ReorderableSectionId);
      }
    }
  }
  return result;
}

export function createDefaultCustomSection(): CustomSectionConfig {
  return {
    enabled: true,
    navLabel: "Highlights",
    badge: "Patient Focus",
    title: "Why Patients Trust Our Care",
    subtitle: "Transparent treatment guidance, individualized attention, and dedicated follow-up care.",
    layout: "cards",
    cards: [
      {
        title: "Evidence-Based Treatment",
        description: "Accurate clinical evaluation paired with clear, modern medical protocols.",
      },
      {
        title: "Personalized Care Plans",
        description: "Every patient receives clear explanations and tailored recovery steps.",
      },
    ],
    paragraph:
      "Our clinical practice is built around listening carefully, explaining every step of diagnosis in plain language, and guiding patients toward safe, lasting recovery.",
    points: [
      {
        heading: "Thorough Clinical Evaluation",
        detail: "Dedicated consultation time to review symptoms, reports, and medical history.",
      },
      {
        heading: "Structured Follow-Up Guidance",
        detail: "Clear recovery milestones so you always know what to expect next.",
      },
    ],
  };
}
