/**
 * Predefined Medical Specializations
 * Comprehensive, verified medical specializations list (DO NOT GENERATE VIA GEMINI)
 */
export const MEDICAL_SPECIALIZATIONS = [
  "Anesthesiology",
  "Bariatric & Metabolic Surgery",
  "Cardiology",
  "Cardiothoracic Surgery",
  "Clinical Hematology",
  "Critical Care Medicine (ICU)",
  "Dentistry & Maxillofacial Surgery",
  "Dermatology & Venereology",
  "Emergency Medicine",
  "Endocrinology & Diabetology",
  "ENT (Otolaryngology)",
  "Family Medicine",
  "Gastroenterology & Hepatology",
  "General Medicine (Internal Medicine)",
  "General Surgery",
  "Geriatric Medicine",
  "Gynecology & Obstetrics",
  "Infectious Diseases",
  "Interventional Cardiology",
  "Interventional Radiology",
  "Medical Oncology",
  "Neonatology",
  "Nephrology",
  "Neurology",
  "Neurosurgery",
  "Nuclear Medicine",
  "Ophthalmology",
  "Orthopedics & Joint Replacement",
  "Pain Management & Palliative Care",
  "Pathology & Laboratory Medicine",
  "Pediatric Cardiology",
  "Pediatric Surgery",
  "Pediatrics & Neonatology",
  "Physical Medicine & Rehabilitation (Physiotherapy)",
  "Plastic & Reconstructive Surgery",
  "Psychiatry & Behavioral Sciences",
  "Pulmonology & Respiratory Medicine",
  "Radiation Oncology",
  "Radiology & Imaging",
  "Rheumatology & Clinical Immunology",
  "Spine Surgery",
  "Surgical Gastroenterology",
  "Surgical Oncology",
  "Urology & Andrology",
  "Vascular Surgery",
] as const;

export type MedicalSpecialization = (typeof MEDICAL_SPECIALIZATIONS)[number];

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
  "robots",
  "sitemap",
  "favicon",
  "public",
  "uploads",
  "media",
  "webhook",
  "system",
  "terms",
  "privacy",
  "support",
  "null",
  "undefined",
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
    id: "hospital-classic",
    name: "Hospital & Polyclinic Trust",
    tagline: "Medikit Healthcare Architecture & Multi-Department Excellence",
    layoutDescription:
      "Two-tier header, 3 floating hero cards, signature heartbeat section dividers, stats counter, emergency callout, and dual-column booking workstation.",
    desktopLayout: "Comprehensive polyclinic layout with top utility bar and 3 overlapping floating cards",
    mobileLayout: "Streamlined mobile layout with quick call buttons and collapsible sections",
  },
];
