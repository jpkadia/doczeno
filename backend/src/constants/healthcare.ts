/**
 * Predefined Medical Specializations
 * Comprehensive, verified medical specializations list (DO NOT GENERATE VIA GEMINI)
 */
export const MEDICAL_SPECIALIZATIONS = [
  "Anesthesiology",
  "Cardiology",
  "Cardiothoracic Surgery",
  "Clinical Hematology",
  "Dentistry & Maxillofacial Surgery",
  "Dermatology & Venereology",
  "Emergency Medicine",
  "Endocrinology & Diabetology",
  "ENT (Otolaryngology)",
  "Gastroenterology & Hepatology",
  "General Medicine (Internal Medicine)",
  "General Surgery",
  "Geriatric Medicine",
  "Gynecology & Obstetrics",
  "Infectious Diseases",
  "Interventional Radiology",
  "Medical Oncology",
  "Nephrology",
  "Neurology",
  "Neurosurgery",
  "Ophthalmology",
  "Orthopedics & Joint Replacement",
  "Pathology & Laboratory Medicine",
  "Pediatric Surgery",
  "Pediatrics & Neonatology",
  "Plastic & Reconstructive Surgery",
  "Psychiatry & Behavioral Sciences",
  "Pulmonology & Respiratory Medicine",
  "Radiation Oncology",
  "Radiology & Imaging",
  "Rheumatology & Clinical Immunology",
  "Surgical Oncology",
  "Urology & Andrology",
  "Vascular Surgery",
] as const;

export type MedicalSpecialization = (typeof MEDICAL_SPECIALIZATIONS)[number];

/**
 * Predefined States and Dependent Cities
 */
export const INDIA_STATES_AND_CITIES: Record<string, string[]> = {
  "Gujarat": [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Gandhinagar",
    "Bhavnagar",
    "Jamnagar",
    "Anand",
    "Junagadh",
    "Navsari",
  ],
  "Maharashtra": [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Nashik",
    "Aurangabad",
    "Thane",
    "Navi Mumbai",
    "Solapur",
    "Kolhapur",
  ],
  "Karnataka": [
    "Bengaluru",
    "Mysuru",
    "Mangaluru",
    "Hubballi-Dharwad",
    "Belagavi",
    "Kalaburagi",
    "Davangere",
    "Ballari",
  ],
  "Delhi (NCT)": [
    "New Delhi",
    "Central Delhi",
    "North Delhi",
    "South Delhi",
    "West Delhi",
    "East Delhi",
  ],
  "Tamil Nadu": [
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Tiruchirappalli",
    "Salem",
    "Tirunelveli",
    "Vellore",
  ],
  "Telangana": [
    "Hyderabad",
    "Warangal",
    "Nizamabad",
    "Karimnagar",
    "Khammam",
  ],
  "West Bengal": [
    "Kolkata",
    "Howrah",
    "Durgapur",
    "Asansol",
    "Siliguri",
  ],
  "Uttar Pradesh": [
    "Lucknow",
    "Kanpur",
    "Varanasi",
    "Agra",
    "Noida",
    "Prayagraj",
    "Meerut",
    "Ghaziabad",
  ],
  "Rajasthan": [
    "Jaipur",
    "Jodhpur",
    "Udaipur",
    "Kota",
    "Bikaner",
    "Ajmer",
  ],
  "Kerala": [
    "Thiruvananthapuram",
    "Kochi",
    "Kozhikode",
    "Thrissur",
    "Kollam",
  ],
};

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "login",
  "logout",
  "superadmin",
  "dashboard",
  "settings",
  "profile",
  "health",
  "static",
  "assets",
  "auth",
  "doctorwebsite",
  "doczeno",
  "register",
  "onboarding",
] as const;

export interface WebsiteThemePreview {
  id: string;
  name: string;
  tagline: string;
  layoutDescription: string;
  desktopLayout: string;
  mobileLayout: string;
}

export const PREBUILT_THEMES: WebsiteThemePreview[] = [
  {
    id: "clinical-editorial",
    name: "Editorial Clinical",
    tagline: "Distinguished Medical Biography & Practice Showcase",
    layoutDescription:
      "Split-screen hero with portrait spotlight, credential badges, chronological career timeline, and formal case study cards.",
    desktopLayout: "Two-column editorial header with full-height doctor portrait & sticky qualification column",
    mobileLayout: "Stacked hero with portrait card, collapsible qualifications accordion, and quick call button",
  },
  {
    id: "modern-minimal",
    name: "Modern Minimalist",
    tagline: "Streamlined Patient Journey & Fast Slot Booking",
    layoutDescription:
      "Spacious sans-serif aesthetic, horizontal marquee banner, grid of core clinical focus areas, and floating booking drawer.",
    desktopLayout: "Full-width hero banner with instant appointment bar, 3-column treatment cards",
    mobileLayout: "Single-column fluid flow with sticky bottom booking bar and touch-friendly slot carousel",
  },
  {
    id: "vital-compact",
    name: "Vital Care Compact",
    tagline: "High-Density Clinical Roster & Emergency Coordination",
    layoutDescription:
      "Urgent healthcare notice header, tabbed department switcher, cashless insurance badge wall, and live consultation hours widget.",
    desktopLayout: "Header emergency hotline, sidebar consultation table, tabbed services directory",
    mobileLayout: "Compact alert strip, collapsible department chips, and one-tap WhatsApp triage",
  },
];
