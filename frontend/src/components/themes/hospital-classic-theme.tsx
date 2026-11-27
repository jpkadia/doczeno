"use client";

import * as React from "react";
import Link from "next/link";
import { EffectiveWebsiteData, TestimonialItem } from "@/types";
import { AppointmentDialog } from "./shared/appointment-dialog";
import { AppointmentStatusSection } from "./shared/appointment-status-section";
import { FaqAccordion } from "./shared/faq-accordion";
import { GalleryLightbox } from "./shared/gallery-lightbox";
import { TestimonialsSection } from "./shared/testimonials-section";
import { useWebsiteThemeMode } from "./shared/website-mode-context";
import { ThemeModeToggle } from "./shared/theme-mode-toggle";
import { MobileBottomNav } from "./shared/mobile-bottom-nav";
import { ScrollReveal } from "./shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  Clock,
  Calendar,
  Activity,
  Building2,
  Stethoscope,
  ChevronRight,
  MapPin,
  Search,
  Home,
  User,
  Star,
  ExternalLink,
  Award,
  HelpCircle,
  Heart,
  Brain,
  Baby,
  Eye,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { CustomSectionRenderer } from "./shared/custom-section-renderer";
import {
  SECTION_META,
  CustomSectionConfig,
  ReorderableSectionId,
  resolveNormalizedHiddenSections,
  resolveNormalizedSectionOrder,
} from "@/constants/website-sections";
import { resolveThemePalette } from "@/lib/theme-palettes";

function getSpecialtyMeta(specialtyName: string) {
  const s = specialtyName.toLowerCase();
  if (s.includes("cardio") || s.includes("heart")) {
    return {
      icon: Heart,
      description: "Advanced cardiac care, clinical evaluations, and preventive heart wellness.",
    };
  }
  if (s.includes("neuro") || s.includes("brain") || s.includes("nerve") || s.includes("spine")) {
    return {
      icon: Brain,
      description: "Comprehensive neurology consultations, nerve health, and specialized diagnostics.",
    };
  }
  if (s.includes("ortho") || s.includes("bone") || s.includes("joint")) {
    return {
      icon: Activity,
      description: "Bone and joint therapy, fracture care, arthritis relief, and rehabilitation.",
    };
  }
  if (s.includes("pedia") || s.includes("child") || s.includes("neonat")) {
    return {
      icon: Baby,
      description: "Dedicated child healthcare, immunizations, developmental care, and wellness.",
    };
  }
  if (s.includes("derma") || s.includes("skin") || s.includes("hair")) {
    return {
      icon: Sparkles,
      description: "Advanced dermatological treatments for healthy skin, hair, and cosmetic wellness.",
    };
  }
  if (s.includes("eye") || s.includes("ophthal")) {
    return {
      icon: Eye,
      description: "Precision vision testing, cataract screenings, and complete eye health care.",
    };
  }
  if (s.includes("gynec") || s.includes("gynaec") || s.includes("obs") || s.includes("women")) {
    return {
      icon: User,
      description: "Compassionate women's health, maternity care, and gynecological consultations.",
    };
  }
  if (s.includes("dent") || s.includes("oral") || s.includes("tooth")) {
    return {
      icon: Sparkles,
      description: "Comprehensive oral care, gentle dentistry, and restorative dental treatments.",
    };
  }
  if (s.includes("ent") || s.includes("ear") || s.includes("throat") || s.includes("nose")) {
    return {
      icon: Stethoscope,
      description: "Diagnostic care for ear, nose, throat conditions, sinus relief, and allergies.",
    };
  }
  if (s.includes("gastro") || s.includes("digest") || s.includes("liver")) {
    return {
      icon: Activity,
      description: "Digestive system diagnostics, liver health, endoscopy, and gut wellness.",
    };
  }
  if (s.includes("pulmo") || s.includes("chest") || s.includes("respir") || s.includes("lung")) {
    return {
      icon: Activity,
      description: "Targeted respiratory therapy, asthma control, and comprehensive lung health care.",
    };
  }
  if (s.includes("onc") || s.includes("cancer")) {
    return {
      icon: ShieldCheck,
      description: "Comprehensive oncology consultations, early detection screenings, and therapeutic care.",
    };
  }
  return {
    icon: Stethoscope,
    description: `Specialized clinical consultation, diagnostics, and patient-focused medical care in ${specialtyName}.`,
  };
}

interface HospitalClassicThemeProps {
  data: EffectiveWebsiteData;
}

export function HospitalClassicTheme({ data }: HospitalClassicThemeProps) {
  const { isDark } = useWebsiteThemeMode();
  const theme = resolveThemePalette(data.selectedTheme);

  // Set theme properties on document root so custom scrollbar, portals, and body reflect the active theme
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--theme-primary", theme.primary);
      document.documentElement.style.setProperty("--theme-primary-hover", theme.primaryHover);
      document.documentElement.style.setProperty("--theme-primary-light", theme.primaryLight);
      document.documentElement.style.setProperty("--scrollbar-thumb", isDark ? theme.primaryLight : theme.primary);
      document.documentElement.style.setProperty("--scrollbar-thumb-hover", isDark ? theme.primary : theme.primaryHover);
    }
  }, [theme, isDark]);

  // Task 4: Auto-hide header on scroll-down, auto-show reliably on scroll-stop (400ms pause) or scroll-up
  const [isHeaderVisible, setIsHeaderVisible] = React.useState(true);
  const lastScrollYRef = React.useRef(0);
  const scrollStopTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [liveServingToken, setLiveServingToken] = React.useState<number>(0);

  React.useEffect(() => {
    if (data.websiteType === "HOSPITAL_CLINIC" || !data.doctorId) return;
    let cancelled = false;
    const fetchLiveQueue = () => {
      apiClient
        .get<{ success: boolean; data?: { currentServingToken?: number } }>(
          "/appointments/public-live-queue",
          { params: { doctorId: data.doctorId } }
        )
        .then((res) => {
          if (!cancelled && res?.success && typeof res.data?.currentServingToken === "number") {
            setLiveServingToken(res.data.currentServingToken);
          }
        })
        .catch(() => {});
    };
    fetchLiveQueue();
    const timer = setInterval(fetchLiveQueue, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [data.websiteType, data.doctorId]);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollYRef.current;

      // Always clear any pending scroll-stop timer
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }

      // Always show header at top of the page
      if (currentScrollY <= 40) {
        setIsHeaderVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (diff > 5) {
        // User is scrolling DOWN -> smoothly slide up and hide
        setIsHeaderVisible(false);
      } else if (diff < -5) {
        // User is scrolling UP -> header MUST be visible immediately
        setIsHeaderVisible(true);
      }

      // Whenever scrolling stops (400ms pause), ALWAYS reliably bring header back smoothly
      scrollStopTimerRef.current = setTimeout(() => {
        setIsHeaderVisible(true);
      }, 400);

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
    };
  }, []);

  const c = data.websiteContent || {};
  const isDoctor = data.websiteType !== "HOSPITAL_CLINIC";
  const addressStr = `${data.address.street ? `${data.address.street}, ` : ""}${data.address.city}, ${data.address.state} - ${data.address.pincode}`;
  const clinicDisplayName = (data as any).clinicName || data.organizationName || "";
  const locationDisplayText = [
    clinicDisplayName,
    data.address.street,
    data.address.city,
    data.address.state,
  ].filter(Boolean).join(", ");
  const googleMapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [clinicDisplayName, data.address.street, data.address.city, data.address.state, data.address.pincode].filter(Boolean).join(", ")
  )}`;

  // Parse consultation / working hours
  let scheduleSlots: Array<{
    day: string;
    isClosed?: boolean;
    slots: Array<{ startTime: string; endTime: string }>;
  }> = [];
  if (data.consultationHours || data.workingHours) {
    try {
      scheduleSlots = JSON.parse(data.consultationHours || data.workingHours || "[]");
    } catch {
      scheduleSlots = [];
    }
  }

  // Dynamic treatments with patient-friendly medical descriptions based on doctor specialization
  const treatmentsList: Array<{ title: string; description: string }> = React.useMemo(() => {
    const c = data.websiteContent || {};
    if (c.services && Array.isArray(c.services) && c.services.length > 0) {
      return c.services.map((s: any) => ({
        title: s.title || s.name || "",
        description: s.description || "Comprehensive clinical assessment and personalized medical treatment.",
      }));
    }
    if (data.services && data.services.length > 0) {
      return data.services.map((s) => ({
        title: s.title,
        description: s.description || "Comprehensive clinical assessment and personalized medical treatment.",
      }));
    }
    if (data.departmentsDetailed && data.departmentsDetailed.length > 0) {
      return data.departmentsDetailed.map((d) => ({
        title: d.name,
        description: d.description || `Specialized clinical care, consultations, and medical treatments in ${d.name}.`,
      }));
    }
    if (data.departments && data.departments.length > 0) {
      return data.departments.map((d) => ({
        title: d,
        description: `Dedicated department care and specialized treatments in ${d}.`,
      }));
    }

    const spec = (data.specialization || "").toLowerCase();

    if (spec.includes("cardio") || spec.includes("heart")) {
      return [
        { title: "Cardiac Health Consultation", description: "Comprehensive evaluation of blood pressure, chest symptoms, and overall heart wellness." },
        { title: "ECG & Diagnostic Screening", description: "Targeted heart screening and ECG evaluation for early detection of cardiac conditions." },
        { title: "Hypertension & Cholesterol Care", description: "Personalized medical care to keep blood pressure and cholesterol levels steady and safe." },
        { title: "Preventive Heart & Post-Care", description: "Ongoing heart health monitoring, lifestyle advice, and post-procedure recovery support." },
      ];
    }

    if (spec.includes("derma") || spec.includes("skin")) {
      return [
        { title: "Acne & Skin Condition Therapy", description: "Personalized treatment plans to clear stubborn acne, breakouts, and sensitive skin concerns." },
        { title: "Allergy, Eczema & Psoriasis Care", description: "Soothing medical therapy and clinical care for chronic skin rashes and inflammation." },
        { title: "Hair Fall & Scalp Health", description: "Clinical diagnosis and proven therapies for hair thinning, dandruff, and scalp health." },
        { title: "Skin Health Screening", description: "Thorough dermatological checks for pigmentation, allergies, infections, and daily skin protection." },
      ];
    }

    if (spec.includes("ortho") || spec.includes("bone") || spec.includes("joint")) {
      return [
        { title: "Joint & Knee Pain Relief", description: "Focused clinical care for knee, hip, and shoulder stiffness to restore easy daily movement." },
        { title: "Spine & Back Care Management", description: "Targeted medical assessment and postural care for chronic backache, neck pain, and sciatica." },
        { title: "Fracture & Sports Injury Care", description: "Prompt assessment, casting, and guided recovery for bone fractures, sprains, and muscle injuries." },
        { title: "Bone Density & Preventive Health", description: "Screenings and therapies to strengthen bones and prevent age-related bone weakness." },
      ];
    }

    if (spec.includes("pedia") || spec.includes("child")) {
      return [
        { title: "Child Growth & Wellness Checks", description: "Routine health reviews tracking your child's physical growth, milestones, and daily nutrition." },
        { title: "Vaccination & Immunization", description: "Timely childhood immunizations following standard pediatric safety guidelines." },
        { title: "Fever, Cough & Infection Treatment", description: "Gentle medical care for seasonal flu, coughs, colds, and common pediatric infections." },
        { title: "Newborn Care & Nutrition", description: "Practical advice on infant feeding, sleep routines, digestion, and baby wellness." },
      ];
    }

    if (spec.includes("gynec") || spec.includes("gynaec") || spec.includes("obs") || spec.includes("women")) {
      return [
        { title: "Women's Wellness & Routine Care", description: "Compassionate clinical consultations, preventive health screenings, and routine wellness." },
        { title: "Prenatal & Pregnancy Guidance", description: "Regular clinical checkups monitoring mother and baby health throughout pregnancy." },
        { title: "PCOS & Hormonal Health", description: "Effective medical management for menstrual irregularity, hormonal balance, and lifestyle care." },
        { title: "Menopause & Bone Health", description: "Supportive medical therapy for comfortable lifestyle transitions and strong bone health." },
      ];
    }

    if (spec.includes("dent") || spec.includes("oral") || spec.includes("tooth") || spec.includes("teeth")) {
      return [
        { title: "Dental Checkup & Cleaning", description: "Gentle plaque removal, teeth cleaning, and thorough dental checkups for healthy gums and teeth." },
        { title: "Painless Root Canal & Fillings", description: "Modern restorative treatments to relieve toothaches and preserve your natural teeth." },
        { title: "Tooth Replacement & Crowns", description: "Natural-looking crowns and tooth restorations to restore chewing comfort and a confident smile." },
        { title: "Preventive Oral Health Care", description: "Cavity protection, enamel strengthening, and sensitivity relief for the whole family." },
      ];
    }

    if (spec.includes("neuro") || spec.includes("brain") || spec.includes("nerve")) {
      return [
        { title: "Headache & Migraine Management", description: "Structured treatment regimens to reduce the frequency and severity of chronic headaches." },
        { title: "Nerve Health & Neuropathy Care", description: "Diagnosis and supportive therapy for tingling, numbness, and peripheral nerve health." },
        { title: "Seizure & Epilepsy Care", description: "Continuous clinical monitoring and personalized medication regimens for seizure control." },
        { title: "Movement & Balance Consultation", description: "Comprehensive evaluation and therapy for tremors, balance issues, and coordination." },
      ];
    }

    if (spec.includes("ent") || spec.includes("ear") || spec.includes("throat") || spec.includes("nose")) {
      return [
        { title: "Ear Care & Hearing Assessment", description: "Gentle treatment for ear pain, wax buildup, infections, and hearing evaluations." },
        { title: "Sinus & Allergy Treatments", description: "Effective medical therapies to clear chronic sinus congestion and nasal allergies." },
        { title: "Throat & Tonsil Care", description: "Diagnosis and care for chronic sore throat, hoarseness, swallowing pain, and tonsil issues." },
        { title: "Vertigo & Dizziness Management", description: "Clinical protocols to diagnose inner-ear causes of dizziness and restore daily balance." },
      ];
    }

    if (spec.includes("eye") || spec.includes("ophthal")) {
      return [
        { title: "Comprehensive Vision Testing", description: "Precise eye examinations to check eyesight clarity and prescribe comfortable vision correction." },
        { title: "Cataract & Glaucoma Screenings", description: "Diagnostic eye pressure checks and lens evaluations to safeguard long-term vision." },
        { title: "Dry Eye & Eye Allergy Care", description: "Soothing therapies and lubricating eye drops to relieve irritation, redness, and strain." },
        { title: "Digital Strain & Preventive Care", description: "Practical guidance on protecting your eyes from fatigue, strain, and screen exposure." },
      ];
    }

    if (spec.includes("gastro") || spec.includes("liver") || spec.includes("digest")) {
      return [
        { title: "Digestive Health & Acidity Relief", description: "Effective management of acid reflux, heartburn, indigestion, and stomach discomfort." },
        { title: "Gut Health & IBS Management", description: "Personalized dietary and medical protocols to restore smooth, comfortable digestion." },
        { title: "Liver Health & Fatty Liver Care", description: "Clinical evaluations for liver enzymes, jaundice, and metabolic liver wellness." },
        { title: "Stomach Infection & Ulcer Care", description: "Targeted therapy to heal stomach ulcers, eradicate infections, and prevent recurrence." },
      ];
    }

    if (spec.includes("pulmo") || spec.includes("chest") || spec.includes("lung") || spec.includes("breath")) {
      return [
        { title: "Asthma & Allergy Control", description: "Custom inhaler plans and allergy avoidance guidance for easy, uninterrupted breathing." },
        { title: "Chronic Cough & Bronchitis Care", description: "Clinical investigations to identify the root cause of lingering coughs and chest congestion." },
        { title: "Lung Health & Breathing Checks", description: "Diagnostic assessments to measure airway strength and monitor respiratory health." },
        { title: "Chest Infection Recovery", description: "Comprehensive medical care for pneumonia, bronchitis, and post-viral recovery." },
      ];
    }

    // Default for General Physician or other medical disciplines
    const specTitle = data.specialization ? `${data.specialization} Consultation` : "Clinical Health Consultation";
    return [
      { title: specTitle, description: `Comprehensive evaluation and diagnosis tailored to ${data.specialization ? data.specialization.toLowerCase() : "general medical"} symptoms.` },
      { title: "Diagnostic Review & Test Guidance", description: "Careful analysis of blood tests, investigations, and reports to pinpoint exact health issues." },
      { title: "Targeted Medical Treatment", description: "Evidence-based prescriptions and clear recovery plans designed for swift, lasting healing." },
      { title: "Follow-up & Preventive Care", description: "Dedicated post-consultation health reviews to monitor your recovery and maintain wellness." },
    ];
  }, [data.services, data.departmentsDetailed, data.departments, data.specialization]);

  // Hospital Specializations: Purely from the hospital's selected specialties (NOT AI generated)
  const hospitalSpecialtiesList: Array<{
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = React.useMemo(() => {
    const rawList =
      Array.isArray(data.specialties) && data.specialties.length > 0
        ? data.specialties
        : Array.isArray(data.departments) && data.departments.length > 0
        ? data.departments
        : [];

    if (rawList.length === 0) {
      return [
        { title: "General Medicine", ...getSpecialtyMeta("General Medicine") },
        { title: "Cardiology", ...getSpecialtyMeta("Cardiology") },
        { title: "Orthopedics", ...getSpecialtyMeta("Orthopedics") },
        { title: "Pediatrics", ...getSpecialtyMeta("Pediatrics") },
      ];
    }

    const aiServicesMap = new Map<string, string>();
    const aiSvcs = Array.isArray(c.services) ? c.services : Array.isArray(data.services) ? data.services : [];
    for (const s of aiSvcs) {
      const key = String((s as any)?.title || (s as any)?.name || "").trim().toLowerCase();
      const desc = String((s as any)?.description || "").trim();
      if (key && desc) {
        aiServicesMap.set(key, desc);
      }
    }

    return rawList.map((specName) => {
      const meta = getSpecialtyMeta(specName);
      const customDesc = aiServicesMap.get(String(specName).trim().toLowerCase());
      return {
        title: specName,
        ...meta,
        description: customDesc || meta.description,
      };
    });
  }, [data.specialties, data.departments, c.services, data.services]);

  const effectiveTestimonials: TestimonialItem[] = React.useMemo(() => {
    if (data.testimonials && data.testimonials.length > 0) {
      return data.testimonials;
    }
    if (isDoctor) {
      return [
        {
          id: "t1",
          patientName: "Rajesh Sharma",
          rating: 5,
          comment: `Dr. ${data.doctorName || "Doctor"} listened very patiently, diagnosed accurately, and prescribed only necessary medicines. Highly satisfied with the treatment!`,
          tag: "Verified Consultation",
        },
        {
          id: "t2",
          patientName: "Pooja Patel",
          rating: 5,
          comment: "Very clean clinic environment with zero hassle in booking. The doctor explained the condition in simple words and gave clear health advice.",
          tag: "OPD Patient",
        },
        {
          id: "t3",
          patientName: "Amit Verma",
          rating: 5,
          comment: "Excellent medical experience. Friendly behavior and minimal wait time with the online appointment system. Truly professional care.",
          tag: "Follow-up Visit",
        },
      ];
    }
    return [];
  }, [data.testimonials, isDoctor, data.doctorName]);

  const faqsList: Array<{ question: string; answer: string }> = React.useMemo(() => {
    if (c.faqs && Array.isArray(c.faqs) && c.faqs.length > 0) {
      return c.faqs.map((f: any) => ({
        question: f.question || "",
        answer: f.answer || "",
      }));
    }
    return data.faqs && data.faqs.length > 0 ? data.faqs : [];
  }, [c.faqs, data.faqs]);

  const cleanDoctorName = (name?: string) => {
    if (!name) return "Doctor";
    const trimmed = name.trim();
    if (/^dr\.?\s+/i.test(trimmed)) return trimmed;
    return `Dr. ${trimmed}`;
  };

  const displayName = isDoctor ? cleanDoctorName(data.doctorName) : data.organizationName;
  const subtitle = isDoctor
    ? `${data.degree ? `${data.degree} • ` : ""}${data.specialization || "Clinical Specialist"}`
    : `${data.organizationType === "CLINIC" ? "Specialty Medical Clinic" : "Multi-Specialty Hospital"}`;

  // Dynamic Section Ordering, Visibility & Strictly Alternating Backgrounds
  // Hero (#home) = Always Gradient | About (#about) = Always Simple
  // Subsequent visible middle sections strictly alternate: Gradient -> Simple -> Gradient -> Simple...
  const sectionOrder = React.useMemo(
    () => resolveNormalizedSectionOrder(!isDoctor, c.sectionOrder),
    [isDoctor, c.sectionOrder]
  );

  const hiddenSections = React.useMemo(
    () => resolveNormalizedHiddenSections(!isDoctor, c.hiddenSections),
    [isDoctor, c.hiddenSections]
  );

  const hiddenSet = React.useMemo(() => new Set<string>(hiddenSections), [hiddenSections]);

  const customSection: CustomSectionConfig | null = React.useMemo(() => {
    if (isDoctor && c.customSection && typeof c.customSection === "object" && c.customSection.enabled) {
      return c.customSection as CustomSectionConfig;
    }
    return null;
  }, [isDoctor, c.customSection]);

  const hasServicesSection = !hiddenSet.has("services");
  const hasDoctorsSection =
    !hiddenSet.has("doctors") && !isDoctor && Boolean(data.doctorDirectory && data.doctorDirectory.length > 0);
  const hasFacilitiesSection =
    !hiddenSet.has("facility") && Boolean(data.galleryPhotos && data.galleryPhotos.length > 0);
  const hasReviewsSection = !hiddenSet.has("reviews") && effectiveTestimonials.length > 0;
  const hasTimingsSection = !hiddenSet.has("timings");
  const hasFaqsSection = !hiddenSet.has("faqs") && faqsList.length > 0;
  const hasCustomSection = !hiddenSet.has("custom") && Boolean(customSection && customSection.title?.trim());

  const visibleMiddleSections = React.useMemo(() => {
    const eligibility: Record<ReorderableSectionId, boolean> = {
      services: hasServicesSection,
      doctors: hasDoctorsSection,
      facility: hasFacilitiesSection,
      reviews: hasReviewsSection,
      timings: hasTimingsSection,
      faqs: hasFaqsSection,
      custom: hasCustomSection,
    };
    const filtered = sectionOrder.filter((id) => eligibility[id]);
    return filtered.map((id, idx) => ({
      id,
      isGradient: idx % 2 === 0,
    }));
  }, [
    sectionOrder,
    hasServicesSection,
    hasDoctorsSection,
    hasFacilitiesSection,
    hasReviewsSection,
    hasTimingsSection,
    hasFaqsSection,
    hasCustomSection,
  ]);

  // Active Navigation Tracking & ScrollSpy (Detects currently visible section on screen in live order)
  const [activeNavId, setActiveNavId] = React.useState<string>("home");
  const isClickScrollingRef = React.useRef(false);
  const clickScrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const navItems = React.useMemo(() => {
    const middleNavMap: Partial<Record<ReorderableSectionId, { id: string; label: string; icon: React.ComponentType<{ className?: string }> }>> = {
      services: {
        id: isDoctor ? "treatments" : "specializations",
        label: isDoctor ? "Treatments" : "Specializations",
        icon: Activity,
      },
      facility: !hiddenSet.has("facility")
        ? { id: "facility", label: "Facility", icon: Building2 }
        : undefined,
      reviews: hasReviewsSection
        ? { id: "reviews", label: "Reviews", icon: Star }
        : undefined,
      timings: hasTimingsSection
        ? { id: "timings", label: "Timings", icon: Clock }
        : undefined,
      custom: hasCustomSection
        ? {
            id: "custom-section",
            label: customSection?.navLabel?.trim() || "Highlights",
            icon: Sparkles,
          }
        : undefined,
    };

    const orderedMiddleNav = sectionOrder
      .map((id) => {
        if (id === "services" && !hasServicesSection) return undefined;
        return middleNavMap[id];
      })
      .filter((item): item is { id: string; label: string; icon: React.ComponentType<{ className?: string }> } => Boolean(item));

    return [
      { id: "home", label: "Home", icon: Home },
      { id: "about", label: "About", icon: User },
      ...orderedMiddleNav,
      { id: "contact", label: "Contact", icon: Phone },
    ];
  }, [
    isDoctor,
    sectionOrder,
    hiddenSet,
    hasServicesSection,
    hasReviewsSection,
    hasTimingsSection,
    hasCustomSection,
    customSection?.navLabel,
  ]);

  const navIds = React.useMemo(() => navItems.map((item) => item.id), [navItems]);

  React.useEffect(() => {
    const handleScrollSpy = () => {
      // Don't override if user just clicked a nav link
      if (isClickScrollingRef.current) return;

      const currentScrollY = window.scrollY;

      // 1. Top of page: ALWAYS Hero / Home
      if (currentScrollY <= 80) {
        setActiveNavId("home");
        return;
      }

      // 2. Bottom of page: ALWAYS Contact / Footer
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      if (windowHeight + currentScrollY >= fullHeight - 80) {
        setActiveNavId("contact");
        return;
      }

      // 3. Middle sections: Viewport measurement using getBoundingClientRect
      // A section is active when its top has reached or passed the reading focus line (140px)
      const targetThreshold = 140;
      let matchedId = "home";

      for (let i = navIds.length - 1; i >= 0; i--) {
        const id = navIds[i];
        if (!id) continue;
        const el = document.getElementById(id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.top <= targetThreshold) {
          matchedId = id;
          break;
        }
      }

      setActiveNavId(matchedId);
    };

    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    // Run immediately on mount to accurately detect the starting active section
    handleScrollSpy();

    return () => {
      window.removeEventListener("scroll", handleScrollSpy);
      if (clickScrollTimeoutRef.current) {
        clearTimeout(clickScrollTimeoutRef.current);
      }
    };
  }, [navIds]);

  const getAlternatingSectionProps = (isGradient: boolean) => {
    if (isGradient) {
      return {
        className: "py-20 border-y px-4 sm:px-6 lg:px-8 transition-colors scroll-mt-16",
        style: {
          borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
          background: isDark
            ? `radial-gradient(circle at 85% 30%, ${theme.softBgDark} 0%, transparent 60%),
               radial-gradient(circle at 15% 70%, ${theme.softBgDark} 0%, transparent 55%),
               linear-gradient(135deg, ${theme.heroMeshDarkFrom} 0%, ${theme.sectionAltBgDark} 50%, ${theme.pageBgDark} 100%)`
            : `radial-gradient(circle at 85% 30%, ${theme.softBgLight} 0%, transparent 60%),
               radial-gradient(circle at 15% 70%, ${theme.softBgLight} 0%, transparent 55%),
               linear-gradient(135deg, ${theme.sectionAltBgLight} 0%, ${theme.noticeBgLight} 50%, ${theme.pageBgLight} 100%)`,
        },
      };
    }
    return {
      className: "py-20 px-4 sm:px-6 lg:px-8 transition-colors scroll-mt-16",
      style: {
        backgroundColor: isDark ? theme.pageBgDark : theme.pageBgLight,
      },
    };
  };

  const aboutSectionProps = getAlternatingSectionProps(false);
  const heroSecondaryTarget = hasServicesSection
    ? (isDoctor ? "#treatments" : "#specializations")
    : hasTimingsSection
    ? "#timings"
    : "#about";

  return (
    <div
      data-testid="theme-hospital-classic"
      className={cn(
        "min-h-screen font-sans selection:bg-[var(--theme-primary)] selection:text-white transition-colors duration-200 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] min-[1033px]:pb-0",
        isDark ? "text-slate-100" : "text-slate-800"
      )}
      style={{
        backgroundColor: isDark ? theme.pageBgDark : theme.pageBgLight,
        "--theme-primary": theme.primary,
        "--theme-primary-hover": theme.primaryHover,
        "--theme-primary-light": theme.primaryLight,
        "--theme-ring": theme.ringHex,
        "--theme-page-bg": isDark ? theme.pageBgDark : theme.pageBgLight,
        "--theme-section-alt-bg": isDark ? theme.sectionAltBgDark : theme.sectionAltBgLight,
        "--theme-card-bg": isDark ? theme.cardBgDark : theme.cardBgLight,
        "--theme-card-border": isDark ? theme.cardBorderDark : theme.cardBorderLight,
        "--theme-inner-card-bg": isDark ? theme.innerCardBgDark : theme.innerCardBgLight,
        "--theme-header-bg": isDark ? theme.headerBgDark : theme.headerBgLight,
        "--theme-footer-bg": isDark ? theme.footerBgDark : theme.footerBgLight,
        "--theme-soft-bg-light": theme.softBgLight,
        "--theme-soft-border-light": theme.softBorderLight,
        "--theme-soft-text-light": theme.softTextLight,
        "--theme-soft-bg-dark": theme.softBgDark,
        "--theme-soft-border-dark": theme.softBorderDark,
        "--theme-soft-text-dark": theme.softTextDark,
        "--theme-notice-bg-light": theme.noticeBgLight,
        "--theme-notice-border-light": theme.noticeBorderLight,
        "--theme-notice-bg-dark": theme.noticeBgDark,
        "--theme-notice-border-dark": theme.noticeBorderDark,
        "--theme-hero-from": theme.heroGradientFrom,
        "--theme-hero-to": theme.heroGradientTo,
      } as React.CSSProperties}
    >
      {/* Hospital Parent Notice (if child doctor) */}
      {data.isHospitalChild && data.hospitalSlug && (
        <div
          className={cn(
            "border-b py-2.5 px-4 text-xs text-center font-medium transition-colors"
          )}
          style={{
            backgroundColor: isDark ? theme.noticeBgDark : theme.noticeBgLight,
            borderColor: isDark ? theme.noticeBorderDark : theme.noticeBorderLight,
            color: isDark ? theme.noticeTextDark : theme.noticeTextLight,
          }}
        >
          <span>
            Affiliated Department Specialist at{" "}
            <Link href={`/${data.hospitalSlug}`} className={cn("underline font-bold", isDark ? "hover:text-white" : "hover:text-slate-900")}>
              {data.organizationName}
            </Link>
            . Surgeries, critical admissions, and diagnostic imaging conducted at hospital main campus.
          </span>
        </div>
      )}

      {/* Sticky Main Navigation with Task 2 (Curved bottom corners) & Task 4 (Auto-hide on scroll-down, 500ms stop/scroll-up show) */}
      <header
        className={cn(
          "sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ease-in-out shadow-sm rounded-b-2xl sm:rounded-b-3xl",
          isHeaderVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        )}
        style={{
          backgroundColor: isDark ? theme.headerBgDark : theme.headerBgLight,
          borderColor: isDark ? theme.cardBorderDark : "rgba(226, 232, 240, 0.8)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Healthcare Entity Identity */}
          <div className="flex items-center gap-3 group">
            {data.logo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo.url}
                alt={displayName}
                className="h-11 w-11 rounded-lg object-cover"
              />
            ) : (
              <div className="h-11 w-11 rounded-xl bg-[var(--theme-primary)] text-white flex items-center justify-center font-bold text-lg shadow-md">
                {isDoctor ? <Stethoscope className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
              </div>
            )}
            <div className="hidden sm:block">
              <span
                className={cn(
                  "text-xl font-bold transition-colors block tracking-tight",
                  isDark ? "text-white" : "text-slate-900"
                )}
              >
                {displayName}
              </span>
              <span className={cn("text-xs font-medium block", isDark ? "text-slate-400" : "text-slate-500")}>
                {subtitle}
              </span>
            </div>
          </div>

          {/* Desktop Nav with Real-time Active Section Indicator & Clean Bottom Accent Line */}
          <nav
            aria-label="Main Navigation"
            className="hidden lg:flex items-center gap-1.5 xl:gap-3 text-xs xl:text-sm"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => {
                    setActiveNavId(item.id);
                    isClickScrollingRef.current = true;
                    if (clickScrollTimeoutRef.current) {
                      clearTimeout(clickScrollTimeoutRef.current);
                    }
                    clickScrollTimeoutRef.current = setTimeout(() => {
                      isClickScrollingRef.current = false;
                    }, 800);
                  }}
                  className={cn(
                    "group relative flex items-center gap-1.5 py-2 px-2 xl:px-2.5 transition-colors duration-200 whitespace-nowrap",
                    isActive
                      ? isDark
                        ? "text-[var(--theme-primary-light)] font-bold"
                        : "text-[var(--theme-primary)] font-bold"
                      : isDark
                      ? "text-slate-300 font-medium hover:text-white"
                      : "text-slate-600 font-medium hover:text-[var(--theme-primary)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 xl:h-4 xl:w-4 shrink-0 transition-colors duration-200",
                      isActive
                        ? isDark
                          ? "text-[var(--theme-primary-light)]"
                          : "text-[var(--theme-primary)]"
                        : isDark
                        ? "text-slate-400 group-hover:text-white"
                        : "text-slate-400 group-hover:text-[var(--theme-primary)]"
                    )}
                  />
                  <span className="relative inline-flex items-center">
                    {item.label}

                    {/* Clean bottom line: mathematically & optically centered under text label */}
                    <span
                      className={cn(
                        "absolute -bottom-1.5 left-0 right-0 h-[2.5px] rounded-full transition-all duration-200 origin-center pointer-events-none",
                        isActive
                          ? "opacity-100 scale-x-100"
                          : "opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-75"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.primaryLight : theme.primary,
                      }}
                    />
                  </span>
                </a>
              );
            })}
          </nav>

          {/* Primary CTA & Mode Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeModeToggle variant="header" />
            <AppointmentDialog
              doctorId={data.doctorId}
              organizationId={data.organizationId}
              doctorName={data.doctorName}
              organizationName={data.organizationName}
              phone={data.phone}
              whatsApp={data.whatsApp}
              consultationHours={data.consultationHours || data.workingHours}
              weeklyOff={data.weeklyOff}
              selectedTheme={data.selectedTheme}
              doctorDirectory={data.doctorDirectory}
              websiteType={data.websiteType}
            >
              <Button className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white font-bold px-5 sm:px-6 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all">
                <Calendar className="mr-2 h-4 w-4" />
                Book Appointment
              </Button>
            </AppointmentDialog>
          </div>
        </div>
      </header>

      {/* 2. Hero Section with Daylight / Midnight Mesh Gradient */}
      <section
        id="home"
        className={cn(
          "relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b overflow-hidden transition-colors duration-200"
        )}
        style={{
          borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
          background: isDark
            ? `
              radial-gradient(circle at 85% 35%, ${theme.softBgDark} 0%, transparent 55%),
              radial-gradient(circle at 15% 85%, ${theme.softBgDark} 0%, transparent 50%),
              linear-gradient(135deg, ${theme.heroMeshDarkFrom} 0%, ${theme.noticeBgDark} 50%, ${theme.pageBgDark} 100%)
            `
            : `
              radial-gradient(circle at 85% 30%, ${theme.softBgLight} 0%, transparent 60%),
              radial-gradient(circle at 15% 75%, ${theme.softBgLight} 0%, transparent 55%),
              linear-gradient(135deg, ${theme.sectionAltBgLight} 0%, ${theme.noticeBgLight} 45%, ${theme.pageBgLight} 100%)
            `,
        }}
      >
        <span id="hero" className="sr-only" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Text with ScrollReveal */}
          <ScrollReveal className="lg:col-span-7 space-y-6 text-left" delay={50} duration={650}>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-bold px-3 py-1 border shadow-2xs transition-colors duration-200",
                  isDark
                    ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                    : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
                )}
              >
                {(typeof c.heroBadge === "string" && c.heroBadge) || "Trusted Healthcare"}
              </Badge>

              {isDoctor && liveServingToken > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-bold px-3 py-1 border shadow-2xs inline-flex items-center gap-1.5",
                    isDark
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>OPD Live: Serving Token #{liveServingToken}</span>
                </Badge>
              )}
            </div>

            <h1
              className={cn(
                "text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]",
                isDark ? "text-white" : "text-slate-900"
              )}
            >
              {(typeof c.tagline === "string" && c.tagline) || data.tagline || (isDoctor ? "Personalized Medical Care You Can Trust" : "Advanced Healthcare Services You Can Trust")}
            </h1>

            <div className={cn("text-base sm:text-lg leading-relaxed max-w-2xl", isDark ? "text-slate-300" : "text-slate-600")}>
              {(typeof c.shortIntro === "string" && c.shortIntro) ||
                (typeof c.hospitalIntro === "string" && c.hospitalIntro) ||
                (typeof c.professionalIntro === "string" && c.professionalIntro) ||
                data.shortIntro || data.about || data.bio || (isDoctor ? `Dedicated to providing compassionate patient care, accurate diagnosis, and personalized treatments in ${data.specialization || "clinical practice"}.` : "Providing compassionate medical care, advanced diagnostic facilities, and experienced specialist doctors.")}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#timings"
                className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white font-bold px-8 py-3.5 rounded-full shadow-lg text-sm sm:text-base inline-flex items-center gap-2 hover:shadow-xl transition-all"
              >
                <Search className="h-4 w-4" />
                <span>{(typeof c.heroCtaPrimary === "string" && c.heroCtaPrimary) || "Track Appointment"}</span>
              </a>
              {hasServicesSection && (
                <a
                  href={heroSecondaryTarget}
                  className={cn(
                    "inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm sm:text-base border shadow-md transition-all duration-200 group",
                    "hover:bg-[var(--theme-primary)] hover:border-[var(--theme-primary)] hover:text-white hover:shadow-lg"
                  )}
                  style={{
                    backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
                    borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                    color: isDark ? theme.primaryLight : theme.primary,
                  }}
                >
                  <span>
                    {(typeof c.heroCtaSecondary === "string" && c.heroCtaSecondary) ||
                      (isDoctor ? "Explore Services" : "Explore Specializations")}
                  </span>
                  <ChevronRight className="h-4 w-4 transition-colors group-hover:text-white" />
                </a>
              )}
            </div>
          </ScrollReveal>

          {/* Right Hero Visual Card with ScrollReveal */}
          <ScrollReveal className="lg:col-span-5 flex justify-center" delay={150} duration={700}>
            <div className="relative group mx-auto">
              {/* Outer frame with rotating 50% theme border animation (1:1 square for Doctor, 3:4 vertical for Hospital Building) */}
              <div
                className={cn(
                  "relative p-[3.5px] rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-300 flex items-center justify-center",
                  isDoctor
                    ? "w-72 sm:w-80 md:w-88 aspect-square"
                    : "w-64 sm:w-72 md:w-80 aspect-[3/4]"
                )}
              >
                {/* Base subtle border track */}
                <div
                  className="absolute inset-0 rounded-3xl sm:rounded-[2rem] pointer-events-none"
                  style={{
                    border: `2px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}`,
                  }}
                />

                {/* 50% Rotating Theme Line / Beam (Spanning 180° / exactly 50% of perimeter) */}
                <div
                  className="absolute -inset-[100%] animate-border-beam pointer-events-none"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, transparent 180deg, ${theme.primary}30 185deg, ${theme.primary} 260deg, ${theme.primaryLight || theme.primary} 345deg, transparent 360deg)`,
                  }}
                />

                {/* Inner Card Surface */}
                <div
                  className="relative z-10 w-full h-full p-2.5 sm:p-3 rounded-[calc(1.5rem-2px)] sm:rounded-[calc(2rem-3px)] transition-colors flex items-center justify-center"
                  style={{
                    backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                  }}
                >
                  {/* Photo inside Container with suitable border radius */}
                  <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner">
                    {isDoctor ? (
                      data.doctorPhoto?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={data.doctorPhoto.url}
                          alt={displayName}
                          className="w-full h-full object-cover object-top rounded-2xl transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="w-full h-full rounded-2xl text-white flex flex-col items-center justify-center p-6 text-center"
                          style={{ background: `linear-gradient(135deg, ${theme.heroGradientFrom}, ${theme.heroGradientTo})` }}
                        >
                          <Stethoscope className="h-16 w-16 mb-4" />
                          <span className="text-xl font-bold">{displayName}</span>
                          <span className="text-xs text-white/90 mt-1">{subtitle}</span>
                        </div>
                      )
                    ) : (
                      data.buildingPhoto?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={data.buildingPhoto.url}
                          alt={`${displayName} Building`}
                          className="w-full h-full object-cover object-center rounded-2xl transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : data.galleryPhotos && data.galleryPhotos.length > 0 && data.galleryPhotos[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={data.galleryPhotos[0].url}
                          alt={displayName}
                          className="w-full h-full object-cover object-center rounded-2xl transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : data.logo?.url ? (
                        <div
                          className="w-full h-full rounded-2xl flex items-center justify-center p-6"
                          style={{
                            backgroundColor: isDark ? theme.innerCardBgDark : "#f8fafc",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={data.logo.url}
                            alt={displayName}
                            className="max-h-48 max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-full h-full rounded-2xl text-white flex flex-col items-center justify-center p-6 text-center"
                          style={{ background: `linear-gradient(135deg, ${theme.heroGradientFrom}, ${theme.heroGradientTo})` }}
                        >
                          <Building2 className="h-16 w-16 mb-4" />
                          <span className="text-xl font-bold">{displayName}</span>
                          <span className="text-xs text-white/90 mt-1">{subtitle}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Entity Name Badge below Photo / Logo (Task 2: More prominent, larger typography) */}
              <div
                className={cn(
                  "absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 px-6 py-3 rounded-full shadow-2xl border flex items-center gap-2.5 whitespace-nowrap text-base sm:text-lg font-black transition-colors tracking-tight",
                  isDark ? "text-white" : "text-slate-900"
                )}
                style={{
                  backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                  borderColor: isDark ? theme.cardBorderDark : "#e2e8f0",
                }}
              >
                {isDoctor ? (
                  <Stethoscope className="h-5 w-5 text-[var(--theme-primary)] shrink-0" />
                ) : (
                  <Building2 className="h-5 w-5 text-[var(--theme-primary)] shrink-0" />
                )}
                <span className="tracking-tight">{displayName}</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 3. Clinical Profile Section */}
      <section
        id="about"
        className={cn(aboutSectionProps.className)}
        style={aboutSectionProps.style}
      >
        <ScrollReveal className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" duration={650}>
          <div className="lg:col-span-7 space-y-6">
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-3 py-1 mb-2 border shadow-2xs transition-colors duration-200",
                isDark
                  ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                  : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
              )}
            >
              {(typeof c.aboutBadge === "string" && c.aboutBadge) || "About Practice"}
            </Badge>
            <h2 className={cn("text-3xl sm:text-4xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {(typeof c.aboutTitle === "string" && c.aboutTitle) || SECTION_META.about.title}
            </h2>
            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
              {(typeof c.about === "string" && c.about) || data.about || data.bio || SECTION_META.about.subtitle}
            </p>

            <div className="pt-2">
              <AppointmentDialog
                doctorId={data.doctorId}
                organizationId={data.organizationId}
                doctorName={data.doctorName}
                organizationName={data.organizationName}
                phone={data.phone}
                whatsApp={data.whatsApp}
                consultationHours={data.consultationHours || data.workingHours}
                weeklyOff={data.weeklyOff}
                selectedTheme={data.selectedTheme}
                doctorDirectory={data.doctorDirectory}
                websiteType={data.websiteType}
              >
                <Button className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white font-bold px-7 py-3 rounded-full">
                  {(typeof c.aboutCtaButton === "string" && c.aboutCtaButton) || "Book Your Visit Today"}
                </Button>
              </AppointmentDialog>
            </div>
          </div>

          <div id={(!hasFacilitiesSection && !hiddenSet.has("facility")) ? "facility" : undefined} className="lg:col-span-5 scroll-mt-24">
            <span id="facilities" className="sr-only" />
            <span id="clinic" className="sr-only" />
            <div
              className={cn(
                "p-6 rounded-3xl border shadow-xl space-y-4"
              )}
              style={{
                backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
              }}
            >
              <h4 className={cn("text-base font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                <Building2 className="h-5 w-5 text-[var(--theme-primary)]" />
                <span>{(typeof c.aboutFacilityCardTitle === "string" && c.aboutFacilityCardTitle) || (isDoctor ? "Clinic Information" : "Hospital Information")}</span>
              </h4>
              <p className={cn("text-xs leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>{addressStr}</p>
              {data.phone && (
                <p className={cn("text-xs flex items-center gap-2", isDark ? "text-slate-300" : "text-slate-600")}>
                  <Phone className="h-4 w-4 text-[var(--theme-primary)]" />
                  <span>{data.phone}</span>
                </p>
              )}
              {isDoctor && (data.newCaseFee !== undefined || data.oldCaseFee !== undefined) && (
                <div className="space-y-2 pt-1">
                  {data.newCaseFee !== undefined && data.newCaseFee !== null && (
                    <div
                      className={cn(
                        "p-3 rounded-xl border text-xs flex justify-between items-center",
                        isDark ? "text-slate-200" : "text-slate-700"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.innerCardBgDark : theme.softBgLight,
                        borderColor: isDark ? theme.cardBorderDark : theme.softBorderLight,
                      }}
                    >
                      <span className="font-semibold">New Consultation Fee</span>
                      <span className="font-bold text-[var(--theme-primary)] text-sm">₹{data.newCaseFee}</span>
                    </div>
                  )}
                  {data.oldCaseFee !== undefined && data.oldCaseFee !== null && (
                    <div
                      className={cn(
                        "p-3 rounded-xl border text-xs flex justify-between items-center",
                        isDark ? "text-slate-200" : "text-slate-700"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.innerCardBgDark : theme.softBgLight,
                        borderColor: isDark ? theme.cardBorderDark : theme.softBorderLight,
                      }}
                    >
                      <span className="font-semibold">Old Case / Follow-up Fee</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">₹{data.oldCaseFee}</span>
                    </div>
                  )}
                </div>
              )}
              {!isDoctor && (
                <div className="space-y-2 pt-1">
                  <div
                    className={cn(
                      "p-3 rounded-xl border text-xs flex justify-between items-center",
                      isDark ? "text-slate-200" : "text-slate-700"
                    )}
                    style={{
                      backgroundColor: isDark ? theme.innerCardBgDark : theme.softBgLight,
                      borderColor: isDark ? theme.cardBorderDark : theme.softBorderLight,
                    }}
                  >
                    <span className="font-semibold">OPD &amp; Emergency</span>
                    <span className="font-bold text-[var(--theme-primary)] text-sm">Open 24/7</span>
                  </div>
                  <div
                    className={cn(
                      "p-3 rounded-xl border text-xs flex justify-between items-center",
                      isDark ? "text-slate-200" : "text-slate-700"
                    )}
                    style={{
                      backgroundColor: isDark ? theme.innerCardBgDark : theme.softBgLight,
                      borderColor: isDark ? theme.cardBorderDark : theme.softBorderLight,
                    }}
                  >
                    <span className="font-semibold">Specialist Care</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">All Departments</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Dynamic Reorderable & Toggleable Middle Sections (Strictly Alternating Gradient / Simple Backgrounds) */}
      {visibleMiddleSections.map(({ id, isGradient }) => {
        const sectionProps = getAlternatingSectionProps(isGradient);
        switch (id) {
          case "services":
            return (
              <section
                key="services"
                id={isDoctor ? "treatments" : "specializations"}
                className={cn(sectionProps.className)}
                style={sectionProps.style}
              >
        <div className="max-w-7xl mx-auto">
          <span id="expertise" className="sr-only" />
          <span id="treatments" className="sr-only" />
          <span id="specializations" className="sr-only" />
          <span id="services" className="sr-only" />
          <span id="specialties" className="sr-only" />
          <ScrollReveal className="text-center max-w-3xl mx-auto mb-14" duration={600}>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-3 py-1 mb-3 border shadow-2xs transition-colors duration-200",
                isDark
                  ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                  : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
              )}
            >
              {isDoctor
                ? ((typeof c.servicesBadge === "string" && c.servicesBadge) || SECTION_META.treatments.badge)
                : ((typeof c.servicesBadge === "string" && c.servicesBadge) || "Medical Departments")}
            </Badge>
            <h2 className={cn("text-3xl sm:text-4xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {isDoctor
                ? ((typeof c.servicesTitle === "string" && c.servicesTitle) || "Treatments")
                : ((typeof c.servicesTitle === "string" && c.servicesTitle) || "Specializations")}
            </h2>
            <div className="flex items-center justify-center gap-3 my-4">
              <span className="w-16 h-[2px] bg-[var(--theme-primary)]/40" />
              <Activity className="h-6 w-6 text-[var(--theme-primary)]" />
              <span className="w-16 h-[2px] bg-[var(--theme-primary)]/40" />
            </div>
            <p className={cn("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
              {isDoctor
                ? ((typeof c.servicesSubtitle === "string" && c.servicesSubtitle) ||
                    (data.specialization
                      ? `Patient-focused clinical care in ${data.specialization}.`
                      : "Comprehensive clinical care and medical treatments."))
                : ((typeof c.servicesSubtitle === "string" && c.servicesSubtitle) ||
                    `Comprehensive multi-specialty clinical departments and specialized care at ${displayName}.`)}
            </p>
          </ScrollReveal>

          {/* Treatment Cards (Doctor) OR Specialization Cards (Hospital - from selected specialties) */}
          <div className="flex flex-wrap justify-center gap-5 sm:gap-6">
            {(() => {
              const items = isDoctor ? treatmentsList : hospitalSpecialtiesList;
              const count = items.length;
              const colClass =
                count === 1
                  ? "w-full max-w-md flex"
                  : count === 2
                  ? "w-full sm:w-[calc(50%-12px)] max-w-md flex"
                  : count === 3
                  ? "w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm flex"
                  : "w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] max-w-sm flex";

              return items.map((item, idx) => {
                return (
                  <ScrollReveal
                    key={idx}
                    delay={idx * 60}
                    duration={550}
                    className={colClass}
                  >
                    <div
                      className={cn(
                        "w-full p-5 sm:p-6 rounded-2xl border transition-all duration-300 ease-out flex flex-col justify-start group cursor-default",
                        "hover:-translate-y-1.5 hover:shadow-xl",
                        isDark
                          ? "text-slate-100 hover:border-[var(--theme-primary)] hover:shadow-[var(--theme-primary)]/15"
                          : "text-slate-800 hover:border-[var(--theme-primary)] hover:shadow-[var(--theme-primary)]/12"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                        borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                      }}
                    >
                      <h3 className={cn("text-base sm:text-lg font-bold leading-snug transition-colors duration-200 group-hover:text-[var(--theme-primary)]", isDark ? "text-white" : "text-slate-900")}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className={cn("text-xs sm:text-sm mt-2 leading-relaxed break-words transition-colors duration-200", isDark ? "text-slate-300 group-hover:text-slate-200" : "text-slate-600 group-hover:text-slate-700")}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  </ScrollReveal>
                );
              });
            })()}
          </div>
        </div>
      </section>
            );

          case "doctors":
            return (!isDoctor && data.doctorDirectory && data.doctorDirectory.length > 0) ? (
              <section
                key="doctors"
                id="doctors"
                className={cn(sectionProps.className)}
                style={sectionProps.style}
              >
                <div className="max-w-7xl mx-auto">
                  <ScrollReveal className="text-center max-w-2xl mx-auto mb-14" duration={600}>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border text-xs font-bold px-3 py-1 mb-3 transition-colors duration-200",
                        isDark
                          ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                          : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
                      )}
                    >
                      {(typeof c.doctorsBadge === "string" && c.doctorsBadge) || "Medical Faculty"}
                    </Badge>
                    <h2 className={cn("text-3xl sm:text-4xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                      {(typeof c.doctorsTitle === "string" && c.doctorsTitle) || "Specialist Doctors"}
                    </h2>
                    <div className="flex items-center justify-center gap-3 my-4">
                      <span className="w-16 h-[2px]" style={{ backgroundColor: theme.primary, opacity: 0.35 }} />
                      <Activity className="h-6 w-6 text-[var(--theme-primary)]" />
                      <span className="w-16 h-[2px]" style={{ backgroundColor: theme.primary, opacity: 0.35 }} />
                    </div>
                    <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-400" : "text-slate-600")}>
                      {(typeof c.doctorsSubtitle === "string" && c.doctorsSubtitle) ||
                        `Consult directly with affiliated department specialists and experienced clinical practitioners at ${displayName}.`}
                    </p>
                  </ScrollReveal>

            <div className="flex flex-wrap justify-center gap-8">
              {data.doctorDirectory.map((doc, idx) => {
                const cleanName = doc.doctorName.trim().replace(/^dr\.?\s+/i, "");
                const docCount = data.doctorDirectory?.length || 0;
                const docColClass =
                  docCount === 1
                    ? "w-full max-w-md flex"
                    : docCount === 2
                    ? "w-full sm:w-[calc(50%-16px)] max-w-md flex"
                    : "w-full sm:w-[calc(50%-16px)] lg:w-[calc(33.333%-22px)] max-w-sm flex";
                return (
                  <ScrollReveal key={doc.id} delay={idx * 80} duration={600} className={docColClass}>
                    <div
                      className={cn(
                        "w-full group rounded-3xl border shadow-sm hover:shadow-2xl hover:shadow-[var(--theme-primary)]/12 hover:border-[var(--theme-primary)]/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden",
                        isDark ? "text-slate-100" : "text-slate-900"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                        borderColor: isDark ? theme.cardBorderDark : "rgba(226, 232, 240, 0.9)",
                      }}
                    >
                    <div className="p-6 sm:p-7 space-y-5">
                      {/* Doctor Profile Top Row */}
                      <div className="flex items-start gap-4 sm:gap-5">
                        <div className="relative shrink-0">
                          {doc.doctorPhoto?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={doc.doctorPhoto.url}
                              alt={`Dr. ${cleanName}`}
                              className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover shadow-sm ring-2 ring-[var(--theme-primary)]/20"
                            />
                          ) : (
                            <div
                              className={cn(
                                "h-20 w-20 sm:h-24 sm:w-24 rounded-2xl flex flex-col items-center justify-center text-[var(--theme-primary)] font-bold shadow-inner ring-2 ring-[var(--theme-primary)]/20"
                              )}
                              style={{
                                backgroundColor: isDark ? theme.innerCardBgDark : "#f1f5f9",
                              }}
                            >
                              <Stethoscope className="h-8 w-8 mb-1" />
                              <span className="text-[10px] tracking-wider uppercase opacity-80">Doctor</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className={cn("text-lg sm:text-xl font-black tracking-tight leading-snug truncate", isDark ? "text-white" : "text-slate-900")}>
                            Dr. {cleanName}
                          </h3>

                          <div>
                            <span
                              className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border truncate max-w-full"
                              style={{
                                backgroundColor: isDark ? theme.softBgDark : theme.softBgLight,
                                color: isDark ? theme.softTextDark : theme.softTextLight,
                                borderColor: isDark ? theme.softBorderDark : theme.softBorderLight,
                              }}
                            >
                              {doc.specialization}
                            </span>
                          </div>

                          {doc.degree && (
                            <p className={cn("text-xs font-medium truncate pt-0.5", isDark ? "text-slate-400" : "text-slate-600")}>
                              {doc.degree}
                            </p>
                          )}

                          {doc.yearsOfExperience !== undefined && doc.yearsOfExperience > 0 && (
                            <p className={cn("text-[11px] font-medium flex items-center gap-1", isDark ? "text-slate-400" : "text-slate-500")}>
                              <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span>{doc.yearsOfExperience} Years Experience</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dual Action Buttons */}
                    <div
                      className={cn(
                        "px-6 py-4 border-t flex flex-wrap items-center gap-2.5 justify-between transition-colors"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.innerCardBgDark : "rgba(248, 250, 252, 0.7)",
                        borderColor: isDark ? theme.cardBorderDark : "#f1f5f9",
                      }}
                    >
                      <Link
                        href={`/${data.slug}/${doc.slug}`}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-200 group shadow-xs",
                          "hover:bg-[var(--theme-primary)] hover:border-[var(--theme-primary)] hover:text-white"
                        )}
                        style={{
                          backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                          borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                          color: isDark ? theme.primaryLight : theme.primary,
                        }}
                      >
                        <span>Visit Website</span>
                        <ExternalLink className="h-3.5 w-3.5 transition-colors group-hover:text-white" />
                      </Link>

                      <AppointmentDialog
                        doctorId={doc.id}
                        organizationId={data.organizationId}
                        doctorName={doc.doctorName}
                        organizationName={data.organizationName}
                        phone={data.phone}
                        whatsApp={data.whatsApp}
                        consultationHours={data.consultationHours || data.workingHours}
                        weeklyOff={data.weeklyOff}
                        selectedTheme={data.selectedTheme}
                      >
                        <Button
                          size="sm"
                          className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs font-bold rounded-full px-4 py-2 shadow-xs transition-all"
                        >
                          Book Visit
                        </Button>
                      </AppointmentDialog>
                    </div>
                  </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>
            ) : null;

          case "facility":
            return (data.galleryPhotos && data.galleryPhotos.length > 0) ? (
              <section
                key="facility"
                id="facility"
                className={cn(sectionProps.className)}
                style={sectionProps.style}
              >
                <ScrollReveal className="max-w-7xl mx-auto" duration={650}>
                  <span id="facilities" className="sr-only" />
                  <span id="clinic" className="sr-only" />
                  <span id="gallery" className="sr-only" />
                  <div className="text-center max-w-2xl mx-auto mb-10">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border text-xs font-bold px-3 py-1 mb-3 transition-colors duration-200",
                        isDark
                          ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                          : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
                      )}
                    >
                      {(typeof c.facilitiesBadge === "string" && c.facilitiesBadge) || "Facility Overview"}
                    </Badge>
                    <h2 className={cn("text-3xl sm:text-4xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                      {(typeof c.facilitiesTitle === "string" && c.facilitiesTitle) || "Facility & Gallery"}
                    </h2>
                    <div className="flex items-center justify-center gap-3 my-3">
                      <span className="w-12 h-[2px] bg-[var(--theme-primary)]/40" />
                      <Activity className="h-5 w-5 text-[var(--theme-primary)]" />
                      <span className="w-12 h-[2px] bg-[var(--theme-primary)]/40" />
                    </div>
                    <p className={cn("text-xs sm:text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                      {(typeof c.facilitiesSubtitle === "string" && c.facilitiesSubtitle) || (typeof c.clinicDescription === "string" && c.clinicDescription) || (isDoctor ? "Sanitized consultation chambers and comfortable patient waiting area." : "Sanitized OPD chambers, treatment rooms, and diagnostic suites.")}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "p-4 rounded-3xl border shadow-sm"
                    )}
                    style={{
                      backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                      borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                    }}
                  >
                    <GalleryLightbox photos={data.galleryPhotos} />
                  </div>
                </ScrollReveal>
              </section>
            ) : null;

          case "reviews":
            return effectiveTestimonials.length > 0 ? (
              <ScrollReveal key="reviews" duration={650}>
                <TestimonialsSection
                  testimonials={effectiveTestimonials}
                  isDoctor={isDoctor}
                  practiceName={displayName}
                  specialization={data.specialization}
                  isGradient={isGradient}
                  selectedTheme={data.selectedTheme}
                  badgeText={typeof c.reviewsBadge === "string" ? c.reviewsBadge : undefined}
                  title={typeof c.reviewsTitle === "string" ? c.reviewsTitle : undefined}
                  subtitle={typeof c.reviewsSubtitle === "string" ? c.reviewsSubtitle : undefined}
                />
              </ScrollReveal>
            ) : null;

          case "timings":
            return (
              <section
                key="timings"
                id="timings"
                className={cn(sectionProps.className)}
                style={sectionProps.style}
              >
        <div className="max-w-7xl mx-auto">
          <span id="schedule" className="sr-only" />
          <span id="availability" className="sr-only" />
          <span id="timetable" className="sr-only" />

          <ScrollReveal className="text-center max-w-2xl mx-auto mb-12" duration={600}>
            <Badge
              variant="outline"
              className={cn(
                "border text-xs font-bold px-3 py-1 mb-3 transition-colors duration-200",
                isDark
                  ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                  : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
              )}
            >
              {(typeof c.scheduleBadge === "string" && c.scheduleBadge) || "Timings"}
            </Badge>
            <h2 className={cn("text-3xl sm:text-4xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {(typeof c.scheduleTitle === "string" && c.scheduleTitle) || "Timings & Schedule"}
            </h2>
            <div className="flex items-center justify-center gap-3 my-3">
              <span className="w-12 h-[2px] bg-[var(--theme-primary)]/40" />
              <Clock className="h-5 w-5 text-[var(--theme-primary)]" />
              <span className="w-12 h-[2px] bg-[var(--theme-primary)]/40" />
            </div>
          </ScrollReveal>

          <div id="appointment-status" className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-6xl mx-auto">
            {/* Box 1: Timings & Working Hours */}
            <ScrollReveal delay={50} duration={650} className="h-full flex flex-col">
              <div
                className={cn(
                  "p-7 sm:p-8 rounded-3xl border shadow-xl flex flex-col justify-between transition-colors h-full"
                )}
                style={{
                  backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                  borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                }}
              >
              <div className="space-y-5">
                <h3 className={cn("text-xl font-bold flex items-center gap-2.5", isDark ? "text-white" : "text-slate-900")}>
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                    style={{
                      backgroundColor: isDark ? theme.innerCardBgDark : theme.sectionAltBgLight,
                      color: isDark ? theme.primaryLight : theme.primary,
                    }}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <span>{(typeof c.scheduleBoxTitle === "string" && c.scheduleBoxTitle) || "Timings & Working Hours"}</span>
                </h3>

                {scheduleSlots.length > 0 ? (
                  <div className="space-y-1.5 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
                    {scheduleSlots.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-2 items-center">
                        <span className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-800")}>{item.day}</span>
                        <span className={cn("font-medium", isDark ? "text-slate-400" : "text-slate-600")}>
                          {item.isClosed
                            ? "Closed"
                            : item.slots && item.slots.length > 0
                            ? item.slots.map((s) => `${s.startTime} - ${s.endTime}`).join(", ")
                            : "Regular Hours"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn("text-xs", isDark ? "text-slate-300" : "text-slate-600")}>
                    {(typeof c.scheduleNotice === "string" && c.scheduleNotice) || "Standard working hours from Monday to Saturday."}
                  </p>
                )}

                {data.weeklyOff && (
                  <div className="pt-1">
                    <span
                      className={cn(
                        "inline-block text-xs font-bold px-3 py-1 rounded-full border shadow-2xs",
                        isDark
                          ? "bg-[var(--theme-primary)]/15 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                          : "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
                      )}
                    >
                      Weekly Off: {data.weeklyOff}
                    </span>
                  </div>
                )}
              </div>

              <div className={cn("pt-5 mt-6 border-t", isDark ? "border-slate-800" : "border-slate-100")}>
                <span className={cn("text-xs block mb-1.5 font-semibold", isDark ? "text-slate-400" : "text-slate-500")}>Clinic Location:</span>
                <a
                  href={googleMapSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-2 text-xs group"
                  title="Open location in Google Maps"
                >
                  <MapPin className="h-4 w-4 text-[var(--theme-primary)] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className={cn("leading-relaxed group-hover:text-[var(--theme-primary)] group-hover:underline transition-colors font-medium", isDark ? "text-slate-300" : "text-slate-700")}>
                    {locationDisplayText || addressStr}
                  </span>
                </a>
              </div>
            </div>
            </ScrollReveal>

            {/* Box 2: Track Appointment (Equal height & width) */}
            <ScrollReveal delay={150} duration={650} className="h-full flex flex-col">
              <div
                className={cn(
                  "p-7 sm:p-8 rounded-3xl border shadow-xl flex flex-col justify-between transition-colors h-full"
                )}
                style={{
                  backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                  borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                }}
              >
                <div className="space-y-5">
                  <h3 className={cn("text-xl font-bold flex items-center gap-2.5", isDark ? "text-white" : "text-slate-900")}>
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: isDark ? theme.innerCardBgDark : theme.sectionAltBgLight,
                        color: isDark ? theme.primaryLight : theme.primary,
                      }}
                    >
                      <Search className="h-5 w-5" />
                    </div>
                    <span>Track Appointment</span>
                  </h3>

                  <AppointmentStatusSection
                    slug={data.slug}
                    doctorSlug={data.isHospitalChild ? data.slug : undefined}
                    selectedTheme={data.selectedTheme}
                    themeVariant="compact"
                    embedded={true}
                  />
                </div>

                <div className={cn("pt-5 mt-6 border-t flex items-center justify-between gap-3", isDark ? "border-slate-800" : "border-slate-100")}>
                  <span className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                    Need a consultation?
                  </span>
                  <AppointmentDialog
                    doctorId={data.doctorId}
                    organizationId={data.organizationId}
                    doctorName={data.doctorName}
                    organizationName={data.organizationName}
                    phone={data.phone}
                    whatsApp={data.whatsApp}
                    consultationHours={data.consultationHours || data.workingHours}
                    weeklyOff={data.weeklyOff}
                    selectedTheme={data.selectedTheme}
                    doctorDirectory={data.doctorDirectory}
                    websiteType={data.websiteType}
                  >
                    <Button className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md">
                      Book Slot
                    </Button>
                  </AppointmentDialog>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
            );

          case "faqs":
            return faqsList.length > 0 ? (
              <section
                key="faqs"
                id="faqs"
                className={cn(sectionProps.className)}
                style={sectionProps.style}
              >
                <ScrollReveal className="max-w-4xl mx-auto" duration={650}>
                  <div
                    className={cn(
                      "p-6 sm:p-10 md:p-12 rounded-3xl border shadow-xl transition-all duration-200"
                    )}
                    style={{
                      backgroundColor: isDark
                        ? theme.cardBgDark
                        : (isGradient ? "#ffffff" : theme.sectionAltBgLight),
                      borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                    }}
                  >
                    <div className="text-center space-y-2.5 mb-8 sm:mb-10">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-bold px-3 py-1 mb-1 border shadow-2xs transition-colors duration-200",
                          isDark
                            ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                            : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
                        )}
                      >
                        {(typeof c.faqsBadge === "string" && c.faqsBadge) || "Patient FAQs"}
                      </Badge>
                      <h2 className={cn("text-2xl sm:text-3xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                        {(typeof c.faqsTitle === "string" && c.faqsTitle) || "Frequently Asked Questions"}
                      </h2>
                      <div className="flex items-center justify-center gap-3 my-2.5">
                        <span className="w-10 h-[2px] bg-[var(--theme-primary)]/40" />
                        <HelpCircle className="h-4 w-4 text-[var(--theme-primary)]" />
                        <span className="w-10 h-[2px] bg-[var(--theme-primary)]/40" />
                      </div>
                      <p className={cn("text-xs sm:text-sm max-w-xl mx-auto", isDark ? "text-slate-400" : "text-slate-600")}>
                        {(typeof c.faqsSubtitle === "string" && c.faqsSubtitle) || "Essential clinical information for your upcoming visit."}
                      </p>
                    </div>

                    <div className="pt-1">
                      <FaqAccordion faqs={faqsList} />
                    </div>
                  </div>
                </ScrollReveal>
              </section>
            ) : null;

          case "custom":
            return customSection ? (
              <CustomSectionRenderer
                key="custom"
                config={customSection}
                sectionClassName={sectionProps.className}
                sectionStyle={sectionProps.style}
                theme={theme}
              />
            ) : null;

          default:
            return null;
        }
      })}

      {/* 9. Minimal Healthcare Footer with Task 2 (Top 2 corners curved) */}
      <footer
        id="contact"
        className={cn(
          "py-16 px-4 sm:px-6 lg:px-8 border-t transition-colors rounded-t-3xl sm:rounded-t-[36px] shadow-lg",
          isDark ? "text-slate-400" : "text-slate-300"
        )}
        style={{
          backgroundColor: isDark ? theme.footerBgDark : theme.footerBgLight,
          borderColor: isDark ? theme.cardBorderDark : "rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 text-xs">
          {/* Col 1: Navigation Links (Task 1: Single-word nav labels) */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-white">Quick Links</h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <a href="#home" className="flex items-center gap-2 hover:text-white transition-colors group">
                  <Home className="h-3.5 w-3.5 text-[var(--theme-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Home</span>
                </a>
              </li>
              <li>
                <a href="#about" className="flex items-center gap-2 hover:text-white transition-colors group">
                  <User className="h-3.5 w-3.5 text-[var(--theme-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                  <span>About</span>
                </a>
              </li>
              {navItems
                .filter((item) => item.id !== "home" && item.id !== "about" && item.id !== "contact")
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="flex items-center gap-2 hover:text-white transition-colors group">
                        <Icon className="h-3.5 w-3.5 text-[var(--theme-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                        <span>{item.label}</span>
                      </a>
                    </li>
                  );
                })}
              {hasDoctorsSection && (
                <li>
                  <a href="#doctors" className="flex items-center gap-2 hover:text-white transition-colors group">
                    <Stethoscope className="h-3.5 w-3.5 text-[var(--theme-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Doctors</span>
                  </a>
                </li>
              )}
              <li>
                <a href="#contact" className="flex items-center gap-2 hover:text-white transition-colors group">
                  <Phone className="h-3.5 w-3.5 text-[var(--theme-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Contact</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: Hours Summary */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-white">
              {(typeof c.footerHoursTitle === "string" && c.footerHoursTitle) || "Consultation Hours"}
            </h4>
            <p className="text-slate-400">
              {(typeof c.footerHoursNotice === "string" && c.footerHoursNotice) || "Standard schedule from Monday to Saturday."}
            </p>
            {data.weeklyOff && (
              <p className={cn("font-bold", isDark ? "text-[var(--theme-primary-light)]" : "text-[var(--theme-primary)]")}>Weekly Off: {data.weeklyOff}</p>
            )}
            <p className="text-slate-400">
              {(typeof c.footerHoursWalkinNotice === "string" && c.footerHoursWalkinNotice) || "Walk-ins and appointments are welcome during practice hours."}
            </p>
          </div>

          {/* Col 3: Contact & Directions */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-white">Contact</h4>
            {data.phone && (
              <p className="text-slate-300 font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-[var(--theme-primary)]" />
                <a href={`tel:${data.phone}`} className="hover:underline">{data.phone}</a>
              </p>
            )}
            {data.whatsApp && (
              <p className="text-slate-300 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-[var(--theme-primary)] shrink-0 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                <a
                  href={`https://wa.me/${data.whatsApp.replace(/[^0-9]/g, "").length === 10 ? "91" + data.whatsApp.replace(/[^0-9]/g, "") : data.whatsApp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {data.whatsApp}
                </a>
              </p>
            )}
            {data.email && (
              <p className="text-slate-300 flex items-center gap-2">
                <Mail className="h-4 w-4 text-[var(--theme-primary)]" />
                <a href={`mailto:${data.email}`} className="hover:underline">{data.email}</a>
              </p>
            )}
            {locationDisplayText && (
              <a
                href={googleMapSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-300 hover:text-white flex items-start gap-2 pt-1 transition-colors group"
                title="Search clinic location on Google Maps"
              >
                <MapPin className="h-4 w-4 text-[var(--theme-primary)] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span className="leading-relaxed hover:underline">{locationDisplayText}</span>
              </a>
            )}
          </div>
        </div>

        {/* Footer Bottom Bar (Task 14: Horizontally centered and stacked) */}
        <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-slate-800/80 flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-1.5">
          <p>{(typeof c.footerCopyright === "string" && c.footerCopyright) || `© ${new Date().getFullYear()} ${displayName}. All healthcare rights reserved.`}</p>
          <p className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
            <span>Powered by</span>
            <span className="font-bold text-[var(--theme-primary)]">Doczeno Healthcare</span>
          </p>
        </div>
      </footer>

      {/* Mobile & Tablet Fixed Bottom Navigation Bar (WhatsApp / Material 3 style) */}
      <MobileBottomNav
        websiteType={data.websiteType}
        selectedTheme={data.selectedTheme}
        themePalette={theme}
        hiddenSections={hiddenSections}
      />
    </div>
  );
}
