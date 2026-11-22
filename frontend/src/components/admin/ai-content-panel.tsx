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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  // 4. Clinic / Facilities
  facilitiesTitle?: string;
  facilitiesSubtitle?: string;
  clinicDescription?: string;

  // 5. Consultation Schedule & Availability
  scheduleBadge?: string;
  scheduleTitle?: string;
  scheduleSubtitle?: string;
  scheduleBoxTitle?: string;
  scheduleNotice?: string;

  // 6. Patient FAQs
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
  target: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR"
): AIContentPayload {
  const isDoctor = target !== "HOSPITAL";
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

  const services =
    Array.isArray(raw.services) && raw.services.length >= 4
      ? raw.services
      : Array.isArray(raw.services) && raw.services.length > 0
      ? [...raw.services, ...defaultServices.slice(raw.services.length, 4)]
      : defaultServices;

  const faqs =
    Array.isArray(raw.faqs) && raw.faqs.length >= 3
      ? raw.faqs
      : defaultFaqs;

  return {
    ...raw,
    heroBadge: (typeof raw.heroBadge === "string" && raw.heroBadge) || (isDoctor ? "Trusted Healthcare" : "Multi-Specialty Healthcare"),
    tagline: (typeof raw.tagline === "string" && raw.tagline) || (isDoctor ? "Dedicated Dermatology & Venereology & Personalized Patient Care in Ahmedabad" : "Advanced Healthcare Services You Can Trust"),
    shortIntro: (typeof raw.shortIntro === "string" && raw.shortIntro) || (target === "ONLY_DOCTOR" ? "Specialist in Dermatology & Venereology providing comprehensive diagnostic evaluations and tailored clinical treatments." : undefined),
    professionalIntro: (typeof raw.professionalIntro === "string" && raw.professionalIntro) || (target === "HOSPITAL_DOCTOR" ? "Senior Consultant providing advanced clinical evaluations and tailored medical treatments." : undefined),
    hospitalIntro: (typeof raw.hospitalIntro === "string" && raw.hospitalIntro) || (target === "HOSPITAL" ? "Comprehensive healthcare institution delivering round-the-clock emergency care, advanced diagnostics, and specialist medicine." : undefined),
    heroCtaPrimary: (typeof raw.heroCtaPrimary === "string" && raw.heroCtaPrimary) || "Track Appointment",
    heroCtaSecondary: (typeof raw.heroCtaSecondary === "string" && raw.heroCtaSecondary) || "Explore Services",
    aboutBadge: (typeof raw.aboutBadge === "string" && raw.aboutBadge) || "Clinical Profile",
    aboutTitle: (typeof raw.aboutTitle === "string" && raw.aboutTitle) || (isDoctor ? "About Our Practice" : "About Our Hospital & Medical Mission"),
    about: (typeof raw.about === "string" && raw.about) || (isDoctor ? "Experienced specialist committed to compassionate, evidence-based healthcare." : "Premier healthcare institution dedicated to medical excellence and compassionate patient care."),
    aboutFacilityCardTitle: (typeof raw.aboutFacilityCardTitle === "string" && raw.aboutFacilityCardTitle) || (isDoctor ? "Clinic Information" : "Hospital Information"),
    aboutCtaButton: (typeof raw.aboutCtaButton === "string" && raw.aboutCtaButton) || "Book Your Visit Today",
    servicesBadge: (typeof raw.servicesBadge === "string" && raw.servicesBadge) || "Specialized Care",
    servicesTitle: (typeof raw.servicesTitle === "string" && raw.servicesTitle) || (isDoctor ? "Treatments" : "Departments & Treatments"),
    servicesSubtitle: (typeof raw.servicesSubtitle === "string" && raw.servicesSubtitle) || "Patient-focused clinical care in Dermatology & Venereology.",
    facilitiesTitle: (typeof raw.facilitiesTitle === "string" && raw.facilitiesTitle) || (isDoctor ? "Facility & Gallery" : "Hospital Infrastructure & Facilities"),
    facilitiesSubtitle: (typeof raw.facilitiesSubtitle === "string" && raw.facilitiesSubtitle) || (isDoctor ? "Sanitized consultation chambers and comfortable patient waiting area." : "Modern clinical environment, advanced diagnostic suites, and patient-first care."),
    scheduleBadge: (typeof raw.scheduleBadge === "string" && raw.scheduleBadge) || "Timings",
    scheduleTitle: (typeof raw.scheduleTitle === "string" && raw.scheduleTitle) || "Timings & Schedule",
    scheduleSubtitle: (typeof raw.scheduleSubtitle === "string" && raw.scheduleSubtitle) || "Review weekly consultation hours and track appointment status.",
    scheduleBoxTitle: (typeof raw.scheduleBoxTitle === "string" && raw.scheduleBoxTitle) || (isDoctor ? "Timings & Working Hours" : "OPD & Emergency Hours"),
    scheduleNotice: (typeof raw.scheduleNotice === "string" && raw.scheduleNotice) || "Standard working hours from Monday to Saturday.",
    faqsTitle: (typeof raw.faqsTitle === "string" && raw.faqsTitle) || "Frequently Asked Questions",
    faqsSubtitle: (typeof raw.faqsSubtitle === "string" && raw.faqsSubtitle) || "Essential clinical information for your upcoming visit.",
    footerAbout: (typeof raw.footerAbout === "string" && raw.footerAbout) || "Committed to providing clinical excellence, advanced diagnostics, and compassionate patient care.",
    footerHoursTitle: (typeof raw.footerHoursTitle === "string" && raw.footerHoursTitle) || "Consultation Hours",
    footerHoursNotice: (typeof raw.footerHoursNotice === "string" && raw.footerHoursNotice) || "Standard schedule from Monday to Saturday.",
    footerHoursWalkinNotice: (typeof raw.footerHoursWalkinNotice === "string" && raw.footerHoursWalkinNotice) || "Walk-ins and appointments are welcome during practice hours.",
    footerCopyright: (typeof raw.footerCopyright === "string" && raw.footerCopyright) || `© ${new Date().getFullYear()} Dr. Parth Kadiya. All healthcare rights reserved.`,
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
}

export function AIContentPanel({ targetType, targetId, onPublished }: AIContentPanelProps) {
  const [content, setContent] = React.useState<AIContentPayload>({});
  const [initialContent, setInitialContent] = React.useState<AIContentPayload>({});
  const [version, setVersion] = React.useState<number>(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  // Fetch record on mount
  const fetchRecord = React.useCallback(async () => {
    if (!targetId) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get<{ success: boolean; data: AIContentRecord }>(
        `/ai/content/${targetType}/${targetId}`
      );
      if (res?.data) {
        const rawData =
          res.data.publishedContent ||
          res.data.approvedContent ||
          res.data.draftContent ||
          {};
        const liveData = populateDefaults(rawData, targetType);
        setContent(liveData);
        setInitialContent(liveData);
        setVersion(res.data.version || 1);
        setIsDirty(false);
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

  // Update field and mark dirty
  const updateField = (key: string, value: unknown) => {
    setContent((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Service helpers (Min 4, Max 12)
  const handleAddService = () => {
    const current = Array.isArray(content.services) ? [...content.services] : [];
    if (current.length >= 12) {
      toast.error("Maximum 12 treatment cards allowed.");
      return;
    }
    current.push({ title: "", description: "" });
    updateField("services", current);
  };

  const handleUpdateService = (index: number, field: "title" | "description", val: string) => {
    const current = Array.isArray(content.services) ? [...content.services] : [];
    if (!current[index]) return;
    current[index] = { ...current[index], [field]: val };
    updateField("services", current);
  };

  const handleDeleteService = (index: number) => {
    const current = Array.isArray(content.services) ? [...content.services] : [];
    if (current.length <= 4) {
      toast.error("Minimum 4 treatment cards required. You cannot delete below 4.");
      return;
    }
    current.splice(index, 1);
    updateField("services", current);
  };

  // Department helpers (Hospital only)
  const handleAddDepartment = () => {
    const current = Array.isArray(content.departments) ? [...content.departments] : [];
    current.push({ name: "", description: "" });
    updateField("departments", current);
  };

  const handleUpdateDepartment = (index: number, field: "name" | "description", val: string) => {
    const current = Array.isArray(content.departments) ? [...content.departments] : [];
    if (!current[index]) return;
    current[index] = { ...current[index], [field]: val };
    updateField("departments", current);
  };

  const handleDeleteDepartment = (index: number) => {
    const current = Array.isArray(content.departments) ? [...content.departments] : [];
    current.splice(index, 1);
    updateField("departments", current);
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

  // Save changes to live website
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message: string;
        data: AIContentRecord;
      }>("/ai/content/update-live", {
        targetType,
        targetId,
        content,
      });

      if (res?.data) {
        const liveData = res.data.publishedContent || content;
        setContent(liveData);
        setInitialContent(liveData);
        setVersion(res.data.version || version + 1);
        setIsDirty(false);
        toast.success("Live website content updated successfully!");
        if (onPublished) {
          onPublished();
        }
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

  // Determine introductory field key based on targetType
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
  const departments = Array.isArray(content.departments) ? content.departments : [];
  const faqs = Array.isArray(content.faqs) ? content.faqs : [];

  const seoTitle = typeof content.seoTitle === "string" ? content.seoTitle : "";
  const seoDescription = typeof content.seoDescription === "string" ? content.seoDescription : "";

  return (
    <div className="space-y-6">
      {/* TOP HEADER & ACTION BANNER */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 sticky top-2 z-10">
        <div className="h-1.5 bg-gradient-to-r from-[#1a76d1] via-[#1560aa] to-[#1a76d1]" />
        <CardHeader className="pb-3 pt-4 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-5 h-5 text-[#1a76d1]" />
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  Live Website Content Editor
                </CardTitle>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                  v{version}
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                All fields below are arranged in the exact top-to-bottom visual sequence of your public website.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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

              {isDirty && (
                <Button
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
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                size="sm"
                className="text-xs font-medium h-8 bg-[#1a76d1] hover:bg-[#1560aa] text-white gap-1.5 shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating Live Website...
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

      {/* SECTION 1: HERO BANNER (WEBSITE TOP) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              1
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Hero / Home Section (#home)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                First screen viewed by patients: badges, headlines, intro paragraph, and action buttons.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
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
            <p className="text-[10px] text-muted-foreground">Pill badge shown directly above the main title.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Hero Main Headline / Tagline
            </Label>
            <Input
              maxLength={150}
              value={typeof content.tagline === "string" ? content.tagline : ""}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder="e.g. Personalized Medical Care You Can Trust"
              className="text-sm font-medium h-10"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>The most prominent headline visible to visitors.</span>
              <span>{(content.tagline || "").length}/150 chars</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {introLabel} (Hero Subtitle)
            </Label>
            <textarea
              maxLength={350}
              rows={3}
              value={typeof content[introKey] === "string" ? (content[introKey] as string) : ""}
              onChange={(e) => updateField(introKey, e.target.value)}
              placeholder="Concise clinical summary introducing your practice, expertise, and patient care commitment..."
              className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-transparent p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a76d1]/20 focus:border-[#1a76d1]"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Descriptive paragraph under the main headline.</span>
              <span>{((content[introKey] as string) || "").length}/350 chars</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Primary Call-To-Action Button Text
              </Label>
              <Input
                value={typeof content.heroCtaPrimary === "string" ? content.heroCtaPrimary : ""}
                onChange={(e) => updateField("heroCtaPrimary", e.target.value)}
                placeholder="e.g. Get Appointment"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Secondary Button Text
              </Label>
              <Input
                value={typeof content.heroCtaSecondary === "string" ? content.heroCtaSecondary : ""}
                onChange={(e) => updateField("heroCtaSecondary", e.target.value)}
                placeholder="e.g. Explore Experties / Explore Departments"
                className="text-xs h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: ABOUT US & CLINICAL PROFILE */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              2
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                About &amp; Clinical Profile (#about)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                In-depth clinical background, patient care philosophy, facility card title, and booking button.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Small Badge
              </Label>
              <Input
                value={typeof content.aboutBadge === "string" ? content.aboutBadge : ""}
                onChange={(e) => updateField("aboutBadge", e.target.value)}
                placeholder="e.g. CLINICAL PROFILE or ABOUT PRACTICE"
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
                placeholder="e.g. Dedicated to Modern Clinical Care & Patient Wellness"
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {targetType === "HOSPITAL" ? "About Hospital & Healthcare Mission" : "Doctor Clinical Bio & Narrative"}
            </Label>
            <textarea
              maxLength={1500}
              rows={5}
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
                placeholder="e.g. Clinic Information or Facility Information"
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
      </Card>

      {/* SECTION 3: CLINICAL SERVICES & EXPERTISE */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              3
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Clinical Treatments &amp; Services (#treatments)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Card grid displaying doctor&apos;s specialized treatments or hospital departments.
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddService}
            disabled={services.length >= 12}
            className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Service Card ({services.length}/12)
          </Button>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Small Badge Text
              </Label>
              <Input
                value={typeof content.servicesBadge === "string" ? content.servicesBadge : ""}
                onChange={(e) => updateField("servicesBadge", e.target.value)}
                placeholder="e.g. Clinical Experties or Medical Care"
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
                placeholder="e.g. Experties & Clinical Care or Departments & Treatments"
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
              placeholder="e.g. Patient-focused clinical experties and personalized treatments in our practice."
              className="text-xs h-9"
            />
          </div>

          {/* Services Card Grid Editor */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Treatment Cards ({services.length}/12) — Min 4, Max 12 (4 per row on website)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Enter conditions/problems in simple patient-friendly words
              </span>
            </div>
            {services.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                No custom services defined. The website will display intelligent specialization defaults. Click &quot;Add Service Card&quot; to override.
              </div>
            ) : (
              services.map((svc: ServiceItem, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Service Card #{idx + 1}
                    </span>
                    <Button
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
                  </div>
                  <div className="space-y-1">
                    <Input
                      maxLength={45}
                      value={svc.title || ""}
                      onChange={(e) => handleUpdateService(idx, "title", e.target.value)}
                      placeholder="Problem / Condition Treated (e.g. Acne & Pimples, Hair Fall, Skin Allergy)"
                      className="text-xs font-semibold h-8 bg-white dark:bg-slate-900"
                    />
                    <div className="flex justify-end text-[10px] text-muted-foreground px-0.5">
                      <span>{(svc.title || "").length}/45 chars</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <textarea
                      maxLength={120}
                      rows={2}
                      value={svc.description || ""}
                      onChange={(e) => handleUpdateService(idx, "description", e.target.value)}
                      placeholder="Patient guidance (8-14 words, max 120 chars) so it fits in card without cut-off..."
                      className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                      <span>Fits cleanly in website card without truncation</span>
                      <span>{(svc.description || "").length}/120 chars</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Hospital Departments List (if Hospital) */}
          {targetType === "HOSPITAL" && (
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Hospital Departments ({departments.length})
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddDepartment}
                  className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Department
                </Button>
              </div>
              {departments.length === 0 ? (
                <div className="p-4 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                  No separate department cards configured.
                </div>
              ) : (
                departments.map((dept: DepartmentItem, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Department #{idx + 1}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDepartment(idx)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                        title="Remove department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={dept.name || ""}
                      onChange={(e) => handleUpdateDepartment(idx, "name", e.target.value)}
                      placeholder="Department Name (e.g. Critical Care & ICU)"
                      className="text-xs font-semibold h-8 bg-white dark:bg-slate-900"
                    />
                    <textarea
                      rows={2}
                      value={dept.description || ""}
                      onChange={(e) => handleUpdateDepartment(idx, "description", e.target.value)}
                      placeholder="Department scope and facilities..."
                      className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: CLINIC FACILITIES & INFRASTRUCTURE */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              4
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Facility &amp; Clinic Environment (#facility)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Heading and description displayed above the photo gallery lightbox.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Section Title
            </Label>
            <Input
              value={typeof content.facilitiesTitle === "string" ? content.facilitiesTitle : ""}
              onChange={(e) => updateField("facilitiesTitle", e.target.value)}
              placeholder="e.g. Clinic Environment & Facilities or Clinical Facility & Infrastructure"
              className="text-xs h-9"
            />
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
              placeholder="e.g. Sanitized consultation chambers and comfortable patient waiting area with modern amenities..."
              className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-transparent p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a76d1]/20 focus:border-[#1a76d1]"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 5: CONSULTATION SCHEDULE & AVAILABILITY */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              5
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Timings &amp; Availability (#timings)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Headings, booking description, timetable box title, and working hours notices.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Small Badge Text
              </Label>
              <Input
                value={typeof content.scheduleBadge === "string" ? content.scheduleBadge : ""}
                onChange={(e) => updateField("scheduleBadge", e.target.value)}
                placeholder="e.g. Doctor Availability or Fast Slot Access"
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
                placeholder="e.g. Clinic Availability & Hours or Working Hours"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Standard Working Hours Notice
              </Label>
              <Input
                value={typeof content.scheduleNotice === "string" ? content.scheduleNotice : ""}
                onChange={(e) => updateField("scheduleNotice", e.target.value)}
                placeholder="e.g. Standard working hours from Monday to Saturday."
                className="text-xs h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 6: PATIENT FAQS */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              6
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Patient Frequently Asked Questions (#faqs)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Accordion questions and answers providing reassurance and visit guidelines.
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddFaq}
            disabled={faqs.length >= 5}
            className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add FAQ ({faqs.length}/5)
          </Button>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                placeholder="e.g. Essential clinical information for your upcoming visit."
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Questions &amp; Answers List ({faqs.length}/5) — Min 3, Max 5
            </Label>
            {faqs.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                No custom FAQs configured yet. Click &quot;Add FAQ&quot; above to create questions.
              </div>
            ) : (
              faqs.map((faq: FAQItem, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Question #{idx + 1}
                    </span>
                    <Button
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 7: FOOTER & PRACTICE DETAILS */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              7
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Footer Section (#contact)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Deep navy bottom footer: brief description, consultation hours notice, and copyright line.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
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
                placeholder="e.g. © 2026 Dr. John Doe. All healthcare rights reserved."
                className="text-xs h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 8: SEO METADATA & GOOGLE LIVE PREVIEW */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 px-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1560aa] text-xs font-bold flex items-center justify-center">
              8
            </span>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Google Search (SEO) Title, Meta &amp; Live Snippet Preview
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                How your website appears when indexed on Google search and shared on WhatsApp or social media.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
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
              placeholder="e.g. Dr. John Doe | Cardiologist & Heart Specialist in Mumbai"
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

          {/* Google Live Search Preview Card */}
          <div className="pt-2">
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Google Search Snippet Preview
            </Label>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-xs text-[#1560aa] truncate">
                https://doczeno.vercel.app/{targetId}
              </div>
              <div className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer truncate">
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
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {isDirty ? (
            <span className="text-amber-600 font-medium">You have unsaved edits. Click &quot;Save Changes to Live Website&quot; to update immediately.</span>
          ) : (
            <span className="text-[#1a76d1] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All content is 100% synchronized with your live website.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
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
