"use client";

import * as React from "react";
import {
  Globe,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Check,
  Sparkles,
  Lock,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MessageSquareQuote,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MediaAsset } from "@/types";
import { GalleryUploader } from "@/components/forms/gallery-uploader";
import { TestimonialsManagementView } from "./views/testimonials-management-view";
import { DoctorCustomSectionEditor } from "./doctor-custom-section-editor";
import {
  CustomSectionConfig,
  ReorderableSectionId,
  resolveNormalizedHiddenSections,
  resolveNormalizedSectionOrder,
} from "@/constants/website-sections";

export interface ServiceItem {
  title: string;
  description: string;
}

export interface DepartmentItem {
  name: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface AIContentPayload {
  // Layout & Section Control
  sectionOrder?: ReorderableSectionId[];
  hiddenSections?: ReorderableSectionId[];
  customSection?: CustomSectionConfig;

  // 1. Hero Banner
  heroBadge?: string;
  tagline?: string;
  shortIntro?: string;
  hospitalIntro?: string;
  professionalIntro?: string;
  heroCtaPrimary?: string;
  heroCtaSecondary?: string;

  // 2. About & Profile
  aboutBadge?: string;
  aboutTitle?: string;
  about?: string;
  aboutCtaButton?: string;
  aboutFacilityCardTitle?: string;

  // 3. Clinical Services & Expertise
  servicesBadge?: string;
  servicesTitle?: string;
  servicesSubtitle?: string;
  expertiseSummary?: string;
  services?: ServiceItem[];
  departments?: DepartmentItem[];

  // 3B. Hospital Doctors Directory Section
  doctorsBadge?: string;
  doctorsTitle?: string;
  doctorsSubtitle?: string;

  // 4. Clinic / Facilities & Gallery
  facilitiesBadge?: string;
  facilitiesTitle?: string;
  facilitiesSubtitle?: string;
  clinicDescription?: string;

  // 4B. Testimonials Section
  reviewsBadge?: string;
  reviewsTitle?: string;
  reviewsSubtitle?: string;

  // 5. Consultation Schedule & Availability
  scheduleBadge?: string;
  scheduleTitle?: string;
  scheduleSubtitle?: string;
  scheduleBoxTitle?: string;
  scheduleNotice?: string;

  // 6. Patient FAQs
  faqsBadge?: string;
  faqsTitle?: string;
  faqsSubtitle?: string;
  faqs?: FAQItem[];

  // 7. Footer & Contact
  footerAbout?: string;
  footerHoursTitle?: string;
  footerHoursNotice?: string;
  footerHoursWalkinNotice?: string;
  footerCopyright?: string;

  // 8. SEO Metadata
  seoTitle?: string;
  seoDescription?: string;

  [key: string]: unknown;
}

export function populateDefaults(
  raw: AIContentPayload,
  target: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR",
  hospitalSpecialties?: string[]
): AIContentPayload {
  const isHospital = target === "HOSPITAL";
  const isDoctor = !isHospital;
  const defaultServices: ServiceItem[] = [
    { title: "Acne & Pimples", description: "Personalized clinical care for persistent acne, breakouts, marks, and sensitive skin." },
    { title: "Hair Fall & Dandruff", description: "Targeted diagnosis and medical therapies for scalp health, dandruff control, and hair thinning." },
    { title: "Skin Allergies & Rashes", description: "Immediate soothing relief and clinical care for chronic itching, hives, and allergic flare-ups." },
    { title: "Infections & Eczema", description: "Proven medical treatments for fungal infections, eczema, psoriasis, and daily skin protection." },
  ];

  const defaultFaqs: FAQItem[] = [
    { question: "How can I book an appointment?", answer: "You can book an appointment online through this website or contact the clinic reception directly." },
    { question: "What should I bring for my first consultation?", answer: "Please bring your previous medical records, prescriptions, test reports, and any government ID." },
    { question: "Are emergency or walk-in consultations available?", answer: "Walk-in consultations are accommodated depending on availability, but booking in advance is strongly recommended." },
  ];

  let services: ServiceItem[];
  if (!isDoctor && Array.isArray(hospitalSpecialties) && hospitalSpecialties.length > 0) {
    const existingMap = new Map<string, string>();
    if (Array.isArray(raw.services)) {
      for (const s of raw.services) {
        const key = String(s?.title || "").trim().toLowerCase();
        if (key && s?.description) existingMap.set(key, s.description);
      }
    }
    services = hospitalSpecialties.map((spec) => ({
      title: spec,
      description:
        existingMap.get(spec.toLowerCase()) ||
        `Specialized clinical diagnosis, outpatient consultations, and medical care in ${spec}.`,
    }));
  } else if (!isDoctor) {
    services = Array.isArray(raw.services) ? raw.services : [];
  } else {
    services =
      Array.isArray(raw.services) && raw.services.length >= 4
        ? raw.services
        : Array.isArray(raw.services) && raw.services.length > 0
        ? [...raw.services, ...defaultServices.slice(raw.services.length, 4)]
        : defaultServices;
  }

  const faqs =
    Array.isArray(raw.faqs) && raw.faqs.length >= 3
      ? raw.faqs
      : defaultFaqs;

  return {
    ...raw,
    sectionOrder: resolveNormalizedSectionOrder(isHospital, raw.sectionOrder),
    hiddenSections: resolveNormalizedHiddenSections(isHospital, raw.hiddenSections),
    heroBadge: (typeof raw.heroBadge === "string" && raw.heroBadge) || (isDoctor ? "Trusted Healthcare" : "Multi-Specialty Healthcare"),
    tagline: (typeof raw.tagline === "string" && raw.tagline) || (isDoctor ? "Dedicated Clinical Excellence & Personalized Patient Care" : "Advanced Healthcare Services You Can Trust"),
    shortIntro: (typeof raw.shortIntro === "string" && raw.shortIntro) || (target === "ONLY_DOCTOR" ? "Experienced specialist providing comprehensive diagnostic evaluations and tailored clinical treatments." : undefined),
    professionalIntro: (typeof raw.professionalIntro === "string" && raw.professionalIntro) || (target === "HOSPITAL_DOCTOR" ? "Senior Consultant providing advanced clinical evaluations and tailored medical treatments." : undefined),
    hospitalIntro: (typeof raw.hospitalIntro === "string" && raw.hospitalIntro) || (target === "HOSPITAL" ? "Comprehensive healthcare institution delivering round-the-clock emergency care, advanced diagnostics, and specialist medicine." : undefined),
    heroCtaPrimary: (typeof raw.heroCtaPrimary === "string" && raw.heroCtaPrimary) || "Track Appointment",
    heroCtaSecondary: (typeof raw.heroCtaSecondary === "string" && raw.heroCtaSecondary) || (isDoctor ? "Explore Services" : "Explore Specializations"),
    aboutBadge: (typeof raw.aboutBadge === "string" && raw.aboutBadge) || "About Practice",
    aboutTitle: (typeof raw.aboutTitle === "string" && raw.aboutTitle) || (isDoctor ? "About Our Practice" : "About Our Hospital & Medical Mission"),
    about: (typeof raw.about === "string" && raw.about) || (isDoctor ? "Experienced specialist committed to compassionate, evidence-based healthcare." : "Premier healthcare institution dedicated to medical excellence and compassionate patient care."),
    aboutFacilityCardTitle: (typeof raw.aboutFacilityCardTitle === "string" && raw.aboutFacilityCardTitle) || (isDoctor ? "Clinic Information" : "Hospital Information"),
    aboutCtaButton: (typeof raw.aboutCtaButton === "string" && raw.aboutCtaButton) || "Book Your Visit Today",
    servicesBadge: (typeof raw.servicesBadge === "string" && raw.servicesBadge) || (isDoctor ? "Specialized Care" : "Medical Departments"),
    servicesTitle: (typeof raw.servicesTitle === "string" && raw.servicesTitle) || (isDoctor ? "Treatments" : "Specializations"),
    servicesSubtitle: (typeof raw.servicesSubtitle === "string" && raw.servicesSubtitle) || (isDoctor ? "Patient-focused clinical care and personalized medical treatments." : "Comprehensive multi-specialty clinical departments and specialized care."),
    doctorsBadge: (typeof raw.doctorsBadge === "string" && raw.doctorsBadge) || "Medical Faculty",
    doctorsTitle: (typeof raw.doctorsTitle === "string" && raw.doctorsTitle) || "Specialist Doctors",
    doctorsSubtitle: (typeof raw.doctorsSubtitle === "string" && raw.doctorsSubtitle) || "Consult directly with affiliated department specialists and experienced clinical practitioners.",
    facilitiesBadge: (typeof raw.facilitiesBadge === "string" && raw.facilitiesBadge) || "Facility Overview",
    facilitiesTitle: (typeof raw.facilitiesTitle === "string" && raw.facilitiesTitle) || "Facility & Gallery",
    facilitiesSubtitle: (typeof raw.facilitiesSubtitle === "string" && raw.facilitiesSubtitle) || (isDoctor ? "Sanitized consultation chambers and comfortable patient waiting area." : "Sanitized OPD chambers, treatment rooms, and diagnostic suites."),
    reviewsBadge: (typeof raw.reviewsBadge === "string" && raw.reviewsBadge) || "Patient Reviews",
    reviewsTitle: (typeof raw.reviewsTitle === "string" && raw.reviewsTitle) || "What Our Patients Say",
    reviewsSubtitle: typeof raw.reviewsSubtitle === "string" ? raw.reviewsSubtitle : "",
    scheduleBadge: (typeof raw.scheduleBadge === "string" && raw.scheduleBadge) || "Timings",
    scheduleTitle: (typeof raw.scheduleTitle === "string" && raw.scheduleTitle) || "Timings & Schedule",
    scheduleSubtitle: (typeof raw.scheduleSubtitle === "string" && raw.scheduleSubtitle) || "Review weekly consultation hours and track appointment status.",
    scheduleBoxTitle: (typeof raw.scheduleBoxTitle === "string" && raw.scheduleBoxTitle) || "Timings & Working Hours",
    scheduleNotice: (typeof raw.scheduleNotice === "string" && raw.scheduleNotice) || "Standard working hours from Monday to Saturday.",
    faqsBadge: (typeof raw.faqsBadge === "string" && raw.faqsBadge) || "Patient FAQs",
    faqsTitle: (typeof raw.faqsTitle === "string" && raw.faqsTitle) || "Frequently Asked Questions",
    faqsSubtitle: (typeof raw.faqsSubtitle === "string" && raw.faqsSubtitle) || "Essential clinical information for your upcoming visit.",
    footerAbout: (typeof raw.footerAbout === "string" && raw.footerAbout) || "Committed to providing clinical excellence, advanced diagnostics, and compassionate patient care.",
    footerHoursTitle: (typeof raw.footerHoursTitle === "string" && raw.footerHoursTitle) || "Consultation Hours",
    footerHoursNotice: (typeof raw.footerHoursNotice === "string" && raw.footerHoursNotice) || "Standard schedule from Monday to Saturday.",
    footerHoursWalkinNotice: (typeof raw.footerHoursWalkinNotice === "string" && raw.footerHoursWalkinNotice) || "Walk-ins and appointments are welcome during practice hours.",
    footerCopyright: (typeof raw.footerCopyright === "string" && raw.footerCopyright) || `© ${new Date().getFullYear()} Healthcare Practice. All healthcare rights reserved.`,
    services,
    faqs,
  };
}

export interface AIContentRecord {
  targetType: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  targetId: string;
  status: "NOT_GENERATED" | "GENERATING" | "DRAFT" | "APPROVED" | "PUBLISHED" | "FAILED";
  version: number;
  draftContent: AIContentPayload | null;
  approvedContent: AIContentPayload | null;
  publishedContent: AIContentPayload | null;
  lastError?: string | null;
  updatedAt?: string;
}

interface AIContentPanelProps {
  targetType: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  targetId: string;
  onPublished?: () => void;
  practiceName?: string;
  galleryPhotos?: MediaAsset[];
  onGalleryChange?: (assets: MediaAsset[]) => void;
  isGalleryInherited?: boolean;
  inheritedHospitalName?: string;
  doctorIdForReviews?: string;
  hasDoctorsSection?: boolean;
}

interface SectionMetaInfo {
  id: ReorderableSectionId;
  shortLabel: string;
  cardTitle: string;
  cardDesc: string;
  anchor: string;
}

export function AIContentPanel({
  targetType,
  targetId,
  onPublished,
  practiceName,
  galleryPhotos = [],
  onGalleryChange,
  isGalleryInherited = false,
  inheritedHospitalName,
  doctorIdForReviews,
  hasDoctorsSection = true,
}: AIContentPanelProps) {
  const isHospitalTarget = targetType === "HOSPITAL";
  const [content, setContent] = React.useState<AIContentPayload>({});
  const [initialContent, setInitialContent] = React.useState<AIContentPayload>({});
  const [version, setVersion] = React.useState<number>(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [aiRegenEnabled, setAiRegenEnabled] = React.useState(false);
  const [regenRemainingToday, setRegenRemainingToday] = React.useState<number>(5);
  const [regenDailyLimit, setRegenDailyLimit] = React.useState<number>(5);
  const [regeneratingSection, setRegeneratingSection] = React.useState<string | null>(null);
  const [hospitalSpecialties, setHospitalSpecialties] = React.useState<string[]>([]);
  const [collapsedMap, setCollapsedMap] = React.useState<Record<string, boolean>>({});
  const sectionRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch record on mount
  const fetchRecord = React.useCallback(async () => {
    if (!targetId) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get<{
        success: boolean;
        data: AIContentRecord;
        hospitalSpecialties?: string[];
        aiRegenerateConfig?: {
          enabled?: boolean;
          remainingToday?: number;
          dailyLimit?: number;
        };
      }>(`/ai/content/${targetType}/${targetId}`);

      if (Array.isArray(res?.hospitalSpecialties)) {
        setHospitalSpecialties(res.hospitalSpecialties);
      }
      if (res?.data) {
        const rawData =
          res.data.publishedContent ||
          res.data.approvedContent ||
          res.data.draftContent ||
          {};
        const liveData = populateDefaults(
          rawData,
          targetType,
          Array.isArray(res?.hospitalSpecialties) ? res.hospitalSpecialties : undefined
        );
        setContent(liveData);
        setInitialContent(liveData);
        setVersion(res.data.version || 1);
        setIsDirty(false);
      }
      if (res?.aiRegenerateConfig) {
        setAiRegenEnabled(Boolean(res.aiRegenerateConfig.enabled));
        setRegenRemainingToday(res.aiRegenerateConfig.remainingToday ?? 5);
        setRegenDailyLimit(res.aiRegenerateConfig.dailyLimit ?? 5);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to load live website content.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetId]);

  React.useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const sectionOrder = React.useMemo(
    () => resolveNormalizedSectionOrder(isHospitalTarget, content.sectionOrder),
    [isHospitalTarget, content.sectionOrder]
  );

  const hiddenSections = React.useMemo(
    () => resolveNormalizedHiddenSections(isHospitalTarget, content.hiddenSections),
    [isHospitalTarget, content.hiddenSections]
  );

  const hiddenSet = React.useMemo(() => new Set<string>(hiddenSections), [hiddenSections]);

  const updateField = (key: string, value: unknown) => {
    setContent((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const toggleSectionVisibility = (id: ReorderableSectionId, visible: boolean) => {
    setContent((prev) => {
      const currentHidden = resolveNormalizedHiddenSections(isHospitalTarget, prev.hiddenSections);
      const nextHidden = visible
        ? currentHidden.filter((x) => x !== id)
        : Array.from(new Set([...currentHidden, id]));
      return {
        ...prev,
        hiddenSections: nextHidden,
      };
    });
    setCollapsedMap((prev) => ({ ...prev, [id]: !visible }));
    setIsDirty(true);
  };

  const moveMiddleSection = (id: ReorderableSectionId, direction: "up" | "down") => {
    setContent((prev) => {
      const currentOrder = resolveNormalizedSectionOrder(isHospitalTarget, prev.sectionOrder);
      const idx = currentOrder.indexOf(id);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= currentOrder.length) return prev;

      const nextOrder = [...currentOrder];
      const movedItem = nextOrder[idx]!;
      nextOrder[idx] = nextOrder[swapIdx]!;
      nextOrder[swapIdx] = movedItem;
      return {
        ...prev,
        sectionOrder: nextOrder,
      };
    });
    setIsDirty(true);
  };

  const scrollToSectionCard = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: false }));
    setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  const toggleCollapse = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Compute exact alternating Gradient / Simple background parity on live website
  const liveBgParityMap = React.useMemo(() => {
    const map: Record<string, "GRADIENT" | "SIMPLE" | "SKIPPED"> = {};
    let visibleIdx = 0;

    for (const id of sectionOrder) {
      const isToggledOff = hiddenSet.has(id);
      const isRenderedDataMissing =
        (id === "doctors" && !hasDoctorsSection) ||
        (id === "facility" && galleryPhotos.length === 0) ||
        (id === "custom" && !content.customSection?.enabled);

      if (isToggledOff || isRenderedDataMissing) {
        map[id] = "SKIPPED";
      } else {
        // Home = Gradient, About = Simple, so 1st visible middle section (visibleIdx === 0) = GRADIENT
        map[id] = visibleIdx % 2 === 0 ? "GRADIENT" : "SIMPLE";
        visibleIdx += 1;
      }
    }
    return map;
  }, [sectionOrder, hiddenSet, hasDoctorsSection, galleryPhotos.length, content.customSection?.enabled]);

  // Regenerate a single AI-generated section
  const handleRegenerateSection = async (section: string, label: string) => {
    if (!aiRegenEnabled) return;
    if (regenRemainingToday <= 0) {
      toast.error(`Daily AI regeneration limit (${regenDailyLimit}/day) reached. Please try again tomorrow.`);
      return;
    }
    setRegeneratingSection(section);
    try {
      const res = await apiClient.post<{
        success: boolean;
        regeneratedValue?: unknown;
        remainingToday?: number;
        dailyLimit?: number;
      }>("/ai/content/regenerate", {
        targetType,
        targetId,
        section,
      });

      if (res.regeneratedValue !== undefined) {
        setContent((prev) => ({ ...prev, [section]: res.regeneratedValue }));
        setIsDirty(true);
      }
      if (typeof res.remainingToday === "number") {
        setRegenRemainingToday(res.remainingToday);
      }
      if (typeof res.dailyLimit === "number") {
        setRegenDailyLimit(res.dailyLimit);
      }
      toast.success(`${label} regenerated with AI! Review and click "Save Changes to Live Website".`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to regenerate content with AI";
      toast.error(msg);
    } finally {
      setRegeneratingSection(null);
    }
  };

  const renderRegenButton = (section: string, label: string) => {
    if (!aiRegenEnabled) return null;
    const isThisLoading = regeneratingSection === section;
    const isBusy = regeneratingSection !== null;
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isBusy || regenRemainingToday <= 0}
        onClick={() => handleRegenerateSection(section, label)}
        className="h-7 px-2.5 text-[11px] font-semibold border-violet-200 text-violet-700 bg-violet-50/70 hover:bg-violet-100 hover:text-violet-800 gap-1.5"
        title={
          regenRemainingToday <= 0
            ? `Daily limit (${regenDailyLimit}/day) reached`
            : `Regenerate ${label} with AI (${regenRemainingToday}/${regenDailyLimit} left today)`
        }
      >
        {isThisLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        <span>{isThisLoading ? "Regenerating..." : "Regenerate with AI"}</span>
      </Button>
    );
  };

  // Service helpers: Hospital is strictly locked to selected Specialties; Doctor allows Min 4, Max 12
  const handleAddService = () => {
    if (isHospitalTarget) {
      toast.error("Hospital specialty cards are synced with the Specialties section and cannot be added here.");
      return;
    }
    const current = Array.isArray(content.services) ? [...content.services] : [];
    if (current.length >= 12) {
      toast.error("Maximum 12 treatment cards allowed.");
      return;
    }
    current.push({ title: "", description: "" });
    updateField("services", current);
  };

  const handleUpdateService = (index: number, field: "title" | "description", val: string) => {
    if (isHospitalTarget && field === "title") {
      return;
    }
    const current = Array.isArray(content.services) ? [...content.services] : [];
    if (!current[index]) return;
    current[index] = { ...current[index], [field]: val };
    updateField("services", current);
  };

  const handleDeleteService = (index: number) => {
    if (isHospitalTarget) {
      toast.error("Hospital specialty cards cannot be deleted here. Remove them from the Specialties tab instead.");
      return;
    }
    const current = Array.isArray(content.services) ? [...content.services] : [];
    if (current.length <= 4) {
      toast.error("Minimum 4 treatment cards required. You cannot delete below 4.");
      return;
    }
    current.splice(index, 1);
    updateField("services", current);
  };

  // FAQ helpers (Min 3, Max 5)
  const handleAddFaq = () => {
    const current = Array.isArray(content.faqs) ? [...content.faqs] : [];
    if (current.length >= 5) {
      toast.error("Maximum 5 FAQs allowed.");
      return;
    }
    current.push({ question: "", answer: "" });
    updateField("faqs", current);
  };

  const handleUpdateFaq = (index: number, field: "question" | "answer", val: string) => {
    const current = Array.isArray(content.faqs) ? [...content.faqs] : [];
    if (!current[index]) return;
    current[index] = { ...current[index], [field]: val };
    updateField("faqs", current);
  };

  const handleDeleteFaq = (index: number) => {
    const current = Array.isArray(content.faqs) ? [...content.faqs] : [];
    if (current.length <= 3) {
      toast.error("Minimum 3 FAQs required. You cannot delete below 3 questions.");
      return;
    }
    current.splice(index, 1);
    updateField("faqs", current);
  };

  // Discard changes
  const handleDiscard = () => {
    setContent(initialContent);
    setIsDirty(false);
    toast.info("Unsaved modifications reverted to currently live content.");
  };

  // Client pre-check + save changes to live website
  const handleSave = async () => {
    const custom = content.customSection;
    if (!isHospitalTarget && custom?.enabled) {
      if (!custom.title || custom.title.trim().length < 3) {
        toast.error("Custom Section title must be at least 3 characters.");
        scrollToSectionCard("custom");
        return;
      }
      if (custom.layout === "cards") {
        const cards = custom.cards || [];
        if (cards.length < 2 || cards.some((c) => c.title.trim().length < 2 || c.description.trim().length < 8)) {
          toast.error("Please fill all Custom Section cards cleanly (title min 2 chars, description min 8 chars).");
          scrollToSectionCard("custom");
          return;
        }
      } else if (custom.layout === "narrative") {
        if ((custom.paragraph || "").trim().length < 20) {
          toast.error("Custom Section paragraph must be at least 20 characters.");
          scrollToSectionCard("custom");
          return;
        }
      } else if (custom.layout === "highlights") {
        const pts = custom.points || [];
        if (pts.length < 2 || pts.some((p) => p.heading.trim().length < 2 || p.detail.trim().length < 8)) {
          toast.error("Please fill all Custom Section highlight points cleanly (heading min 2 chars, detail min 8 chars).");
          scrollToSectionCard("custom");
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payloadToSave: AIContentPayload = {
        ...content,
        sectionOrder,
        hiddenSections,
      };
      const res = await apiClient.post<{
        success: boolean;
        message: string;
        data: AIContentRecord;
      }>("/ai/content/update-live", {
        targetType,
        targetId,
        content: payloadToSave,
      });

      if (res?.data) {
        const liveData = populateDefaults(
          res.data.publishedContent || payloadToSave,
          targetType,
          hospitalSpecialties.length > 0 ? hospitalSpecialties : undefined
        );
        setContent(liveData);
        setInitialContent(liveData);
        setVersion(res.data.version || version + 1);
        setIsDirty(false);
        toast.success("Live website content, section visibility & ordering updated!");
        onPublished?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to update live website content.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#1a76d1] mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading Live Website Content...
        </p>
      </div>
    );
  }

  const introKey =
    targetType === "HOSPITAL"
      ? "hospitalIntro"
      : targetType === "HOSPITAL_DOCTOR"
      ? "professionalIntro"
      : "shortIntro";

  const introLabel =
    targetType === "HOSPITAL"
      ? "Hospital Introductory Highlight"
      : targetType === "HOSPITAL_DOCTOR"
      ? "Professional Clinical Introduction"
      : "Brief Practice Overview";

  const services = Array.isArray(content.services) ? content.services : [];
  const faqs = Array.isArray(content.faqs) ? content.faqs : [];
  const hospitalExpectedCount =
    hospitalSpecialties.length > 0 ? hospitalSpecialties.length : services.length;

  const seoTitle = typeof content.seoTitle === "string" ? content.seoTitle : "";
  const seoDescription = typeof content.seoDescription === "string" ? content.seoDescription : "";

  const sectionMetaMap: Record<ReorderableSectionId, SectionMetaInfo> = {
    services: {
      id: "services",
      shortLabel: isHospitalTarget ? "Specializations" : "Treatments",
      cardTitle: isHospitalTarget
        ? "Specializations & Clinical Services"
        : "Clinical Treatments & Services",
      cardDesc: isHospitalTarget
        ? "Locked 1-to-1 to your Hospital Specialties tab. Edit descriptions freely."
        : "Card grid displaying your specialized treatments (Min 4, Max 12).",
      anchor: isHospitalTarget ? "#specializations" : "#treatments",
    },
    doctors: {
      id: "doctors",
      shortLabel: "Doctors",
      cardTitle: "Specialist Doctors Directory",
      cardDesc: "Showcase affiliated specialist doctors on your hospital main website.",
      anchor: "#doctors",
    },
    facility: {
      id: "facility",
      shortLabel: "Clinic Gallery",
      cardTitle: isHospitalTarget
        ? "Hospital Facility & Photo Gallery"
        : "Clinic Facility & Photo Gallery",
      cardDesc: "Manage section heading, subtitle, and upload clinic gallery photos together.",
      anchor: "#facility",
    },
    reviews: {
      id: "reviews",
      shortLabel: "Testimonials",
      cardTitle: "Patient Testimonials & Reviews",
      cardDesc: "Customize review slider headings and manage patient reviews (Min 3, Max 9).",
      anchor: "#reviews",
    },
    timings: {
      id: "timings",
      shortLabel: "Timings",
      cardTitle: "Timings & Appointment Tracking",
      cardDesc: "Headings, schedule card title, and working hours notice beside Track Appointment.",
      anchor: "#timings",
    },
    faqs: {
      id: "faqs",
      shortLabel: "Patient FAQs",
      cardTitle: "Frequently Asked Questions",
      cardDesc: "Accordion questions and answers providing visit clarity (Min 3, Max 5).",
      anchor: "#faqs",
    },
    custom: {
      id: "custom",
      shortLabel: content.customSection?.navLabel?.trim() || "Custom Section",
      cardTitle: "Custom Doctor Section (Text / Cards)",
      cardDesc: "Optional text-only custom section with Cards, Paragraph, or Key Points layout.",
      anchor: "#custom-section",
    },
  };

  const renderMiddleSectionBody = (sectionId: ReorderableSectionId) => {
    switch (sectionId) {
      case "services":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-slate-500">
                Section Copy &amp; Cards Grid
              </span>
              <div className="flex items-center gap-2">
                {renderRegenButton("services", isHospitalTarget ? "Specialty Cards" : "Treatment Cards")}
                {isHospitalTarget ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] h-7 px-2.5 gap-1.5 border-blue-200 bg-blue-50/70 text-[#1560aa] font-semibold"
                  >
                    <Lock className="w-3 h-3" />
                    Synced with Specialties ({hospitalExpectedCount})
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddService}
                    disabled={services.length >= 12}
                    className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Card ({services.length}/12)
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Small Badge Text
                </Label>
                <Input
                  value={typeof content.servicesBadge === "string" ? content.servicesBadge : ""}
                  onChange={(e) => updateField("servicesBadge", e.target.value)}
                  placeholder="e.g. Specialized Care"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Title
                </Label>
                <Input
                  value={typeof content.servicesTitle === "string" ? content.servicesTitle : ""}
                  onChange={(e) => updateField("servicesTitle", e.target.value)}
                  placeholder="e.g. Treatments or Specializations"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Subtitle / Description
              </Label>
              <Input
                value={typeof content.servicesSubtitle === "string" ? content.servicesSubtitle : ""}
                onChange={(e) => updateField("servicesSubtitle", e.target.value)}
                placeholder="Patient-focused clinical care and personalized medical treatments."
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isHospitalTarget
                    ? `Specialty Cards (${services.length}/${hospitalExpectedCount})`
                    : `Treatment Cards (${services.length}/12) — Min 4, Max 12`}
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {isHospitalTarget
                    ? "Manage specialty list from the Specialties sidebar tab"
                    : "Concise descriptions fit cleanly in 4-column desktop cards"}
                </span>
              </div>

              {services.length === 0 ? (
                <div className="p-6 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                  No custom services defined. Intelligent specialization defaults will be displayed.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {services.map((svc: ServiceItem, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {isHospitalTarget ? `Specialty #${idx + 1}` : `Treatment Card #${idx + 1}`}
                        </span>
                        {isHospitalTarget ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteService(idx)}
                            disabled={services.length <= 4}
                            className={cn(
                              "h-6 w-6 p-0",
                              services.length <= 4
                                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                : "text-slate-400 hover:text-destructive hover:bg-destructive/10"
                            )}
                            title={services.length <= 4 ? "Minimum 4 treatment cards required" : "Remove service"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Input
                          maxLength={isHospitalTarget ? 100 : 45}
                          disabled={isHospitalTarget}
                          value={svc.title || ""}
                          onChange={(e) => handleUpdateService(idx, "title", e.target.value)}
                          placeholder="Condition / Service Title"
                          className={cn(
                            "text-xs font-semibold h-8 bg-white dark:bg-slate-900",
                            isHospitalTarget && "opacity-80 bg-slate-100/80 dark:bg-slate-800 cursor-not-allowed"
                          )}
                        />
                        <div className="text-right text-[10px] text-muted-foreground">
                          {(svc.title || "").length}/{isHospitalTarget ? 100 : 45} chars
                        </div>
                      </div>

                      <div className="space-y-1">
                        <textarea
                          maxLength={120}
                          rows={2}
                          value={svc.description || ""}
                          onChange={(e) => handleUpdateService(idx, "description", e.target.value)}
                          placeholder="Patient guidance (max 120 chars)..."
                          className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
                        />
                        <div className="text-right text-[10px] text-muted-foreground">
                          {(svc.description || "").length}/120 chars
                        </div>
                      </div>
                    </div>
                  ))}

                  {!isHospitalTarget && services.length < 12 && (
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="min-h-[145px] rounded-xl border-2 border-dashed border-slate-200 hover:border-[#1a76d1] hover:bg-blue-50/40 transition-all flex flex-col items-center justify-center gap-1.5 p-4 text-center cursor-pointer"
                    >
                      <Plus className="h-5 w-5 text-[#1a76d1]" />
                      <span className="text-xs font-semibold text-slate-700">Add Treatment Card</span>
                      <span className="text-[10px] text-slate-400">{12 - services.length} slots left</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case "doctors":
        return (
          <div className="space-y-4">
            {!hasDoctorsSection && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                Note: This section will appear automatically on the hospital website once at least one active affiliated doctor is approved.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Small Badge
                </Label>
                <Input
                  maxLength={40}
                  value={typeof content.doctorsBadge === "string" ? content.doctorsBadge : ""}
                  onChange={(e) => updateField("doctorsBadge", e.target.value)}
                  placeholder="e.g. Medical Faculty"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Title
                </Label>
                <Input
                  maxLength={80}
                  value={typeof content.doctorsTitle === "string" ? content.doctorsTitle : ""}
                  onChange={(e) => updateField("doctorsTitle", e.target.value)}
                  placeholder="e.g. Specialist Doctors"
                  className="text-xs h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Subtitle / Description
              </Label>
              <Input
                maxLength={200}
                value={typeof content.doctorsSubtitle === "string" ? content.doctorsSubtitle : ""}
                onChange={(e) => updateField("doctorsSubtitle", e.target.value)}
                placeholder="Consult directly with affiliated department specialists..."
                className="text-xs h-9"
              />
            </div>
          </div>
        );

      case "facility":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Small Badge
                </Label>
                <Input
                  maxLength={40}
                  value={typeof content.facilitiesBadge === "string" ? content.facilitiesBadge : ""}
                  onChange={(e) => updateField("facilitiesBadge", e.target.value)}
                  placeholder="e.g. Facility Overview"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Title
                </Label>
                <Input
                  maxLength={80}
                  value={typeof content.facilitiesTitle === "string" ? content.facilitiesTitle : ""}
                  onChange={(e) => updateField("facilitiesTitle", e.target.value)}
                  placeholder="e.g. Facility & Gallery"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Facilities Description / Subtitle
              </Label>
              <textarea
                rows={2}
                value={
                  typeof content.facilitiesSubtitle === "string"
                    ? content.facilitiesSubtitle
                    : typeof content.clinicDescription === "string"
                    ? content.clinicDescription
                    : ""
                }
                onChange={(e) => {
                  updateField("facilitiesSubtitle", e.target.value);
                  updateField("clinicDescription", e.target.value);
                }}
                placeholder="Sanitized consultation chambers and comfortable patient waiting area..."
                className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-transparent p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a76d1]/20 focus:border-[#1a76d1]"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#1a76d1]" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {isHospitalTarget ? "Hospital Facility & Campus Gallery" : "Clinic Photo Gallery"} ({galleryPhotos.length}/6)
                  </span>
                </div>
                {isGalleryInherited && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 gap-1">
                    <Lock className="h-3 w-3" /> Shared from {inheritedHospitalName || "Hospital Admin"}
                  </Badge>
                )}
              </div>

              {galleryPhotos.length === 0 && !isGalleryInherited && (
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-800 font-medium">
                  Upload at least 1 clinic/facility photo below so this Gallery section renders on your public website.
                </div>
              )}

              {isGalleryInherited ? (
                galleryPhotos.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Affiliated doctors automatically display their parent hospital&apos;s campus gallery. Use the toggle switch above to show or hide this section on your personal doctor page.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {galleryPhotos.map((img, i) => (
                        <div key={img.publicId || img.url || i} className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={`Facility photo ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center border border-dashed rounded-xl text-xs text-slate-500 bg-slate-50/50">
                    Hospital administration has not uploaded campus gallery photos yet.
                  </div>
                )
              ) : (
                <GalleryUploader
                  label={isHospitalTarget ? "Hospital Facility & Campus Photos" : "Clinic Facility & Campus Photos"}
                  value={galleryPhotos}
                  onChange={(assets) => {
                    onGalleryChange?.(assets);
                  }}
                  maxFiles={6}
                />
              )}
            </div>
          </div>
        );

      case "reviews":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Small Badge
                </Label>
                <Input
                  maxLength={40}
                  value={typeof content.reviewsBadge === "string" ? content.reviewsBadge : ""}
                  onChange={(e) => updateField("reviewsBadge", e.target.value)}
                  placeholder="e.g. Patient Reviews"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Heading
                </Label>
                <Input
                  maxLength={80}
                  value={typeof content.reviewsTitle === "string" ? content.reviewsTitle : ""}
                  onChange={(e) => updateField("reviewsTitle", e.target.value)}
                  placeholder="e.g. What Our Patients Say"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Custom Subtitle (leave blank to auto-generate with practice name)
              </Label>
              <Input
                maxLength={220}
                value={typeof content.reviewsSubtitle === "string" ? content.reviewsSubtitle : ""}
                onChange={(e) => updateField("reviewsSubtitle", e.target.value)}
                placeholder="Real experiences and feedback from verified patients..."
                className="text-xs h-9"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquareQuote className="h-4 w-4 text-[#1a76d1]" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Manage Patient Testimonials
                </span>
              </div>
              <TestimonialsManagementView
                embedded={true}
                portalType={targetType}
                practiceName={practiceName}
                doctorId={doctorIdForReviews}
              />
            </div>
          </div>
        );

      case "timings":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Small Badge Text
                </Label>
                <Input
                  value={typeof content.scheduleBadge === "string" ? content.scheduleBadge : ""}
                  onChange={(e) => updateField("scheduleBadge", e.target.value)}
                  placeholder="e.g. Timings"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Title
                </Label>
                <Input
                  value={typeof content.scheduleTitle === "string" ? content.scheduleTitle : ""}
                  onChange={(e) => updateField("scheduleTitle", e.target.value)}
                  placeholder="e.g. Timings & Schedule"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Booking Subtitle / Instructions
              </Label>
              <Input
                value={typeof content.scheduleSubtitle === "string" ? content.scheduleSubtitle : ""}
                onChange={(e) => updateField("scheduleSubtitle", e.target.value)}
                placeholder="e.g. Review weekly consultation hours and track appointment status."
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Schedule Card Box Title
                </Label>
                <Input
                  value={typeof content.scheduleBoxTitle === "string" ? content.scheduleBoxTitle : ""}
                  onChange={(e) => updateField("scheduleBoxTitle", e.target.value)}
                  placeholder="e.g. Timings & Working Hours"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Fallback Working Hours Notice
                </Label>
                <Input
                  value={typeof content.scheduleNotice === "string" ? content.scheduleNotice : ""}
                  onChange={(e) => updateField("scheduleNotice", e.target.value)}
                  placeholder="e.g. Standard working hours from Monday to Saturday."
                  className="text-xs h-9"
                />
              </div>
            </div>
          </div>
        );

      case "faqs":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {renderRegenButton("faqs", "Patient FAQs")}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddFaq}
                disabled={faqs.length >= 5}
                className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Add FAQ ({faqs.length}/5)
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  FAQ Small Badge
                </Label>
                <Input
                  value={typeof content.faqsBadge === "string" ? content.faqsBadge : ""}
                  onChange={(e) => updateField("faqsBadge", e.target.value)}
                  placeholder="e.g. Patient FAQs"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  FAQ Section Title
                </Label>
                <Input
                  value={typeof content.faqsTitle === "string" ? content.faqsTitle : ""}
                  onChange={(e) => updateField("faqsTitle", e.target.value)}
                  placeholder="e.g. Frequently Asked Questions"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  FAQ Section Subtitle
                </Label>
                <Input
                  value={typeof content.faqsSubtitle === "string" ? content.faqsSubtitle : ""}
                  onChange={(e) => updateField("faqsSubtitle", e.target.value)}
                  placeholder="Essential clinical information for your visit."
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Questions &amp; Answers ({faqs.length}/5) — Min 3, Max 5
              </Label>

              <div className="space-y-3">
                {faqs.map((faq: FAQItem, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Question #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFaq(idx)}
                        disabled={faqs.length <= 3}
                        className={cn(
                          "h-6 w-6 p-0",
                          faqs.length <= 3
                            ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                            : "text-slate-400 hover:text-destructive hover:bg-destructive/10"
                        )}
                        title={faqs.length <= 3 ? "Minimum 3 FAQs required" : "Remove question"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={faq.question || ""}
                      onChange={(e) => handleUpdateFaq(idx, "question", e.target.value)}
                      placeholder="Question (e.g. How early should I arrive before my appointment?)"
                      className="text-xs font-semibold h-8 bg-white dark:bg-slate-900"
                    />
                    <textarea
                      rows={2}
                      value={faq.answer || ""}
                      onChange={(e) => handleUpdateFaq(idx, "answer", e.target.value)}
                      placeholder="Detailed, reassuring answer for patients..."
                      className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
                    />
                  </div>
                ))}

                {faqs.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#1a76d1] hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2 text-xs font-semibold text-[#1a76d1] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add FAQ Question ({faqs.length}/5)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case "custom":
        return (
          <DoctorCustomSectionEditor
            value={content.customSection}
            onChange={(nextCustom) => updateField("customSection", nextCustom)}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP STICKY HEADER & SAVE BANNER */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 sticky top-2 z-20">
        <div className="h-1.5 bg-gradient-to-r from-[#1a76d1] via-[#1560aa] to-[#1a76d1]" />
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Globe className="w-5 h-5 text-[#1a76d1]" />
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  Live Website Content, Order &amp; Visibility
                </CardTitle>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                  v{version}
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Edit sections in exact top-to-bottom website order, toggle sections ON/OFF, or reorder middle sections.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {isDirty ? (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 font-medium">
                  Unsaved Changes
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-blue-50 text-[#1560aa] border-blue-200 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Published Live
                </Badge>
              )}

              {aiRegenEnabled && (
                <Badge
                  variant="outline"
                  className="text-[11px] bg-violet-50 text-violet-700 border-violet-200 px-2.5 py-1 gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  AI Regen: {regenRemainingToday}/{regenDailyLimit}
                </Badge>
              )}

              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className="text-xs h-8 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Discard
                </Button>
              )}

              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                size="sm"
                className="text-xs font-medium h-8 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-1.5 shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes to Live Website
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* WEBSITE FLOW & ORDER MAP */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader className="py-3 px-4 sm:px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#1a76d1]" />
              <CardTitle className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Page Section Sequence &amp; Alternating Backgrounds
              </CardTitle>
            </div>
            <span className="text-[11px] text-slate-500">
              Header, Home, About &amp; Footer are locked • Live backgrounds alternate strictly Gradient / Simple
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-2.5">
          {/* Top Locked Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => scrollToSectionCard("home")}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 text-left hover:border-blue-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1560aa] text-[10px] font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-xs font-semibold text-slate-800">Header &amp; Hero (#home)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-[#1560aa] border-blue-200">
                  Gradient BG
                </Badge>
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => scrollToSectionCard("about")}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 text-left hover:border-blue-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1560aa] text-[10px] font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-semibold text-slate-800">About &amp; Profile (#about)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] bg-white text-slate-600 border-slate-200">
                  Simple BG
                </Badge>
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </button>
          </div>

          {/* Ordered Reorderable Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {sectionOrder.map((secId, idx) => {
              const meta = sectionMetaMap[secId];
              const isHidden = hiddenSet.has(secId);
              const parity = liveBgParityMap[secId];
              return (
                <button
                  key={secId}
                  type="button"
                  onClick={() => scrollToSectionCard(secId)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                    isHidden || parity === "SKIPPED"
                      ? "bg-slate-50 border-slate-200 text-slate-400"
                      : "bg-white border-slate-200 text-slate-800 hover:border-[#1a76d1]"
                  )}
                >
                  <span className="text-[10px] font-mono text-slate-400">#{idx + 3}</span>
                  <span className={cn(isHidden && "line-through")}>{meta.shortLabel}</span>
                  {isHidden ? (
                    <EyeOff className="h-3 w-3 text-amber-500" />
                  ) : parity === "GRADIENT" ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#1560aa]">
                      Gradient
                    </span>
                  ) : parity === "SIMPLE" ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      Simple
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                      Inactive
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => scrollToSectionCard("footer")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-800 text-white text-xs font-medium cursor-pointer"
            >
              <Lock className="h-3 w-3 text-slate-300" />
              <span>Footer (#contact)</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1 (LOCKED): HERO BANNER */}
      <Card
        ref={(el) => { sectionRefs.current.home = el; }}
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm scroll-mt-24"
      >
        <CardHeader className="py-3 px-4 sm:px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleCollapse("home")}
            className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
          >
            {collapsedMap.home ? (
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                Hero / Home Section (#home)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground truncate">
                First screen viewed by patients: badge, main tagline, intro summary, and action buttons.
              </CardDescription>
            </div>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] bg-blue-50 text-[#1560aa] border-blue-200">
              Gradient BG
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 gap-1">
              <Lock className="h-3 w-3" /> Fixed
            </Badge>
          </div>
        </CardHeader>

        {!collapsedMap.home && (
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Top Small Badge Text
              </Label>
              <Input
                value={typeof content.heroBadge === "string" ? content.heroBadge : ""}
                onChange={(e) => updateField("heroBadge", e.target.value)}
                placeholder="e.g. Trusted Healthcare"
                className="text-xs h-9 max-w-md"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hero Main Headline / Tagline
                </Label>
                {renderRegenButton("tagline", "Hero Tagline")}
              </div>
              <Input
                maxLength={150}
                value={typeof content.tagline === "string" ? content.tagline : ""}
                onChange={(e) => updateField("tagline", e.target.value)}
                placeholder="e.g. Personalized Medical Care You Can Trust"
                className="text-sm font-medium h-10"
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                <span>{(content.tagline || "").length}/150 chars</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {introLabel} (Hero Subtitle)
                </Label>
                {renderRegenButton(introKey, "Hero Subtitle")}
              </div>
              <textarea
                maxLength={350}
                rows={3}
                value={typeof content[introKey] === "string" ? (content[introKey] as string) : ""}
                onChange={(e) => updateField(introKey, e.target.value)}
                placeholder="Concise clinical summary introducing your practice..."
                className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-transparent p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a76d1]/20 focus:border-[#1a76d1]"
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                <span>{((content[introKey] as string) || "").length}/350 chars</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Primary Action Button Text
                </Label>
                <Input
                  value={typeof content.heroCtaPrimary === "string" ? content.heroCtaPrimary : ""}
                  onChange={(e) => updateField("heroCtaPrimary", e.target.value)}
                  placeholder="e.g. Track Appointment"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Secondary Action Button Text
                </Label>
                <Input
                  value={typeof content.heroCtaSecondary === "string" ? content.heroCtaSecondary : ""}
                  onChange={(e) => updateField("heroCtaSecondary", e.target.value)}
                  placeholder="e.g. Explore Services"
                  className="text-xs h-9"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* SECTION 2 (LOCKED): ABOUT & CLINICAL PROFILE */}
      <Card
        ref={(el) => { sectionRefs.current.about = el; }}
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm scroll-mt-24"
      >
        <CardHeader className="py-3 px-4 sm:px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleCollapse("about")}
            className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
          >
            {collapsedMap.about ? (
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                About &amp; Clinical Profile (#about)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground truncate">
                Clinical narrative, practice care philosophy, facility info card title, and booking button.
              </CardDescription>
            </div>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] bg-white text-slate-600 border-slate-200">
              Simple BG
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 gap-1">
              <Lock className="h-3 w-3" /> Fixed
            </Badge>
          </div>
        </CardHeader>

        {!collapsedMap.about && (
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Small Badge
                </Label>
                <Input
                  value={typeof content.aboutBadge === "string" ? content.aboutBadge : ""}
                  onChange={(e) => updateField("aboutBadge", e.target.value)}
                  placeholder="e.g. About Practice"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Section Title
                </Label>
                <Input
                  value={typeof content.aboutTitle === "string" ? content.aboutTitle : ""}
                  onChange={(e) => updateField("aboutTitle", e.target.value)}
                  placeholder="e.g. About Our Practice"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isHospitalTarget ? "About Hospital & Healthcare Mission" : "Doctor Clinical Bio & Narrative"}
                </Label>
                {renderRegenButton("about", "About Section")}
              </div>
              <textarea
                maxLength={1500}
                rows={4}
                value={typeof content.about === "string" ? content.about : ""}
                onChange={(e) => updateField("about", e.target.value)}
                placeholder="Comprehensive clinical background, credentials, patient management principles..."
                className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-transparent p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a76d1]/20 focus:border-[#1a76d1]"
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                <span>{(content.about || "").length}/1500 chars</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Facility / Clinic Info Card Title
                </Label>
                <Input
                  value={typeof content.aboutFacilityCardTitle === "string" ? content.aboutFacilityCardTitle : ""}
                  onChange={(e) => updateField("aboutFacilityCardTitle", e.target.value)}
                  placeholder="e.g. Clinic Information"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  About Section Action Button Text
                </Label>
                <Input
                  value={typeof content.aboutCtaButton === "string" ? content.aboutCtaButton : ""}
                  onChange={(e) => updateField("aboutCtaButton", e.target.value)}
                  placeholder="e.g. Book Your Visit Today"
                  className="text-xs h-9"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* DYNAMIC MIDDLE SECTIONS (IN EXACT CUSTOM ORDER) */}
      {sectionOrder.map((secId, index) => {
        const meta = sectionMetaMap[secId];
        const isHidden = hiddenSet.has(secId);
        const isCollapsed = collapsedMap[secId] ?? false;
        const parity = liveBgParityMap[secId];

        return (
          <Card
            key={secId}
            ref={(el) => { sectionRefs.current[secId] = el; }}
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm scroll-mt-24 transition-opacity",
              isHidden && "border-dashed bg-slate-50/40"
            )}
          >
            <CardHeader className="py-3 px-4 sm:px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleCollapse(secId)}
                  className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0",
                      isHidden
                        ? "bg-slate-200 text-slate-500"
                        : "bg-blue-100 text-[#1560aa]"
                    )}
                  >
                    {index + 3}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className={cn("text-sm font-semibold truncate", isHidden ? "text-slate-500 line-through" : "text-slate-900 dark:text-white")}>
                        {meta.cardTitle}
                      </CardTitle>
                      <span className="text-[10px] font-mono text-slate-400">{meta.anchor}</span>
                    </div>
                    <CardDescription className="text-[11px] text-muted-foreground truncate">
                      {meta.cardDesc}
                    </CardDescription>
                  </div>
                </button>

                {/* Controls: BG Indicator + Move Up/Down + ON/OFF Switch */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isHidden ? (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  ) : parity === "GRADIENT" ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-[#1560aa] border-blue-200">
                      Gradient BG
                    </Badge>
                  ) : parity === "SIMPLE" ? (
                    <Badge variant="outline" className="text-[10px] bg-white text-slate-600 border-slate-200">
                      Simple BG
                    </Badge>
                  ) : null}

                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => moveMiddleSection(secId, "up")}
                      className="h-6 w-6 p-0 text-slate-600 hover:text-[#1a76d1] disabled:opacity-30"
                      title="Move section up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === sectionOrder.length - 1}
                      onClick={() => moveMiddleSection(secId, "down")}
                      className="h-6 w-6 p-0 text-slate-600 hover:text-[#1a76d1] disabled:opacity-30"
                      title="Move section down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <label className="flex items-center gap-1.5 pl-1 cursor-pointer select-none">
                    <Switch
                      checked={!isHidden}
                      onCheckedChange={(checked) => toggleSectionVisibility(secId, checked)}
                      aria-label={`Toggle ${meta.cardTitle} visibility`}
                    />
                    <span className={cn("text-[11px] font-semibold w-7", isHidden ? "text-slate-400" : "text-emerald-600")}>
                      {isHidden ? "OFF" : "ON"}
                    </span>
                  </label>
                </div>
              </div>
            </CardHeader>

            {isHidden ? (
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>
                    This section is currently <strong>OFF</strong> and hidden on your live website. Remaining sections automatically maintain Gradient / Simple order.
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => toggleCollapse(secId)}
                  className="text-[11px] h-7 shrink-0 self-start sm:self-auto"
                >
                  {isCollapsed ? "Edit Content Anyway" : "Hide Fields"}
                </Button>
              </CardContent>
            ) : null}

            {!isCollapsed && (
              <CardContent className={cn("p-4 sm:p-5", isHidden && "pt-0 opacity-75")}>
                {renderMiddleSectionBody(secId)}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* LOCKED FOOTER SECTION */}
      <Card
        ref={(el) => { sectionRefs.current.footer = el; }}
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm scroll-mt-24"
      >
        <CardHeader className="py-3 px-4 sm:px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleCollapse("footer")}
            className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
          >
            {collapsedMap.footer ? (
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {sectionOrder.length + 3}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                Footer Section (#contact)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground truncate">
                Bottom contact band: quick navigation links, hours summary, and copyright notice.
              </CardDescription>
            </div>
          </button>
          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 gap-1 shrink-0">
            <Lock className="h-3 w-3" /> Fixed at Bottom
          </Badge>
        </CardHeader>

        {!collapsedMap.footer && (
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Footer Practice Description
              </Label>
              <textarea
                rows={2}
                value={typeof content.footerAbout === "string" ? content.footerAbout : ""}
                onChange={(e) => updateField("footerAbout", e.target.value)}
                placeholder="e.g. Committed to providing clinical excellence, advanced diagnostics, and compassionate patient care."
                className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-transparent p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hours Box Title
                </Label>
                <Input
                  value={typeof content.footerHoursTitle === "string" ? content.footerHoursTitle : ""}
                  onChange={(e) => updateField("footerHoursTitle", e.target.value)}
                  placeholder="e.g. Consultation Hours"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hours Schedule Notice
                </Label>
                <Input
                  value={typeof content.footerHoursNotice === "string" ? content.footerHoursNotice : ""}
                  onChange={(e) => updateField("footerHoursNotice", e.target.value)}
                  placeholder="e.g. Standard OPD schedule from Monday to Saturday."
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Walk-ins / Appointment Note
                </Label>
                <Input
                  value={typeof content.footerHoursWalkinNotice === "string" ? content.footerHoursWalkinNotice : ""}
                  onChange={(e) => updateField("footerHoursWalkinNotice", e.target.value)}
                  placeholder="e.g. Walk-ins and appointments are welcome during practice hours."
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Footer Copyright Text
                </Label>
                <Input
                  value={typeof content.footerCopyright === "string" ? content.footerCopyright : ""}
                  onChange={(e) => updateField("footerCopyright", e.target.value)}
                  placeholder="e.g. © 2026 Practice Name. All healthcare rights reserved."
                  className="text-xs h-9"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* SEO METADATA & GOOGLE LIVE PREVIEW */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-4 sm:px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
              Google Search (SEO) Title, Meta &amp; Snippet Preview
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Controls how your website appears in Google search results and link previews.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 shrink-0">
            SEO Metadata
          </Badge>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                SEO Meta Title
              </Label>
              <span className={`text-[11px] font-mono ${seoTitle.length > 70 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {seoTitle.length} / 70 characters
              </span>
            </div>
            <Input
              value={seoTitle}
              onChange={(e) => updateField("seoTitle", e.target.value)}
              placeholder="e.g. Dr. John Doe | Specialist Clinic"
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                SEO Meta Description
              </Label>
              <span className={`text-[11px] font-mono ${seoDescription.length > 160 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {seoDescription.length} / 160 characters
              </span>
            </div>
            <textarea
              rows={2}
              value={seoDescription}
              onChange={(e) => updateField("seoDescription", e.target.value)}
              placeholder="Brief summary displayed on Google search and when sharing website links..."
              className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-transparent p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
            />
          </div>

          <div className="pt-1">
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Google Search Snippet Preview
            </Label>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-xs text-[#1560aa] truncate">
                https://doczeno.vercel.app/{targetId}
              </div>
              <div className="text-sm font-medium text-blue-700 dark:text-blue-400 truncate">
                {seoTitle || "Doctor & Clinic Website | Doczeno Healthcare"}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {seoDescription || "Consult specialist doctor. View consultation hours, clinic services, treatments, patient FAQs, and book online appointments."}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOTTOM SAVE ACTION BAR */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {isDirty ? (
            <span className="text-amber-600 font-medium">
              You have unsaved edits (content, order, or visibility). Click Save to update live website immediately.
            </span>
          ) : (
            <span className="text-[#1a76d1] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All content, ordering &amp; visibility settings are synced with your live website.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={isSaving}
              className="text-xs h-9 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </Button>
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            size="sm"
            className="text-xs font-semibold h-9 px-5 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-2 shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating Live Website...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes to Live Website
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
