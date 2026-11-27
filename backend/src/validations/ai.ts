import { z } from "zod";

/**
 * Service & FAQ items
 */
export const serviceItemSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
});

export const departmentItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
});

export const faqItemSchema = z.object({
  question: z.string().min(5).max(200),
  answer: z.string().min(10).max(600),
});

/**
 * 1. Only Doctor Generated Content Schema
 */
export const onlyDoctorContentSchema = z.object({
  tagline: z.string().min(5).max(150),
  about: z.string().min(20).max(1500),
  shortIntro: z.string().min(10).max(400),
  clinicDescription: z.string().min(10).max(600),
  services: z.array(serviceItemSchema).min(1).max(12),
  faqs: z.array(faqItemSchema).min(1).max(10),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(10).max(160),
});

export type OnlyDoctorGeneratedContent = z.infer<typeof onlyDoctorContentSchema>;

/**
 * 2. Hospital / Clinic Generated Content Schema
 */
export const hospitalContentSchema = z.object({
  tagline: z.string().min(5).max(150),
  about: z.string().min(20).max(1500),
  hospitalIntro: z.string().min(10).max(500),
  services: z.array(serviceItemSchema).min(1).max(60),
  departments: z.array(departmentItemSchema).min(1).max(60),
  faqs: z.array(faqItemSchema).min(1).max(10),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(10).max(160),
});

export type HospitalGeneratedContent = z.infer<typeof hospitalContentSchema>;

/**
 * 3. Hospital Doctor Generated Content Schema
 */
export const hospitalDoctorContentSchema = z.object({
  tagline: z.string().min(5).max(150).optional(),
  professionalIntro: z.string().min(10).max(500),
  about: z.string().min(20).max(1500),
  expertiseSummary: z.string().min(10).max(600),
  services: z.array(serviceItemSchema).min(1).max(12).optional(),
  faqs: z.array(faqItemSchema).min(1).max(10),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(10).max(160),
});

export type HospitalDoctorGeneratedContent = z.infer<typeof hospitalDoctorContentSchema>;

/**
 * Target Types
 */
export const AiTargetType = {
  ONLY_DOCTOR: "ONLY_DOCTOR",
  INDEPENDENT_DOCTOR: "ONLY_DOCTOR",
  HOSPITAL: "HOSPITAL",
  HOSPITAL_DOCTOR: "HOSPITAL_DOCTOR",
} as const;

export type AiTargetType = (typeof AiTargetType)[keyof typeof AiTargetType];

/**
 * Allowed AI Content Statuses
 */
export const AiContentStatus = {
  NOT_GENERATED: "NOT_GENERATED",
  GENERATING: "GENERATING",
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
} as const;

export type AiContentStatus = (typeof AiContentStatus)[keyof typeof AiContentStatus];

/**
 * Section Validation Maps
 */
export const onlyDoctorSectionSchemas: Record<string, z.ZodTypeAny> = {
  tagline: onlyDoctorContentSchema.shape.tagline,
  about: onlyDoctorContentSchema.shape.about,
  shortIntro: onlyDoctorContentSchema.shape.shortIntro,
  clinicDescription: onlyDoctorContentSchema.shape.clinicDescription,
  services: onlyDoctorContentSchema.shape.services,
  faqs: onlyDoctorContentSchema.shape.faqs,
  seoTitle: onlyDoctorContentSchema.shape.seoTitle,
  seoDescription: onlyDoctorContentSchema.shape.seoDescription,
};

export const hospitalSectionSchemas: Record<string, z.ZodTypeAny> = {
  tagline: hospitalContentSchema.shape.tagline,
  about: hospitalContentSchema.shape.about,
  hospitalIntro: hospitalContentSchema.shape.hospitalIntro,
  services: hospitalContentSchema.shape.services,
  departments: hospitalContentSchema.shape.departments,
  faqs: hospitalContentSchema.shape.faqs,
  seoTitle: hospitalContentSchema.shape.seoTitle,
  seoDescription: hospitalContentSchema.shape.seoDescription,
};

export const hospitalDoctorSectionSchemas: Record<string, z.ZodTypeAny> = {
  tagline: hospitalDoctorContentSchema.shape.tagline,
  professionalIntro: hospitalDoctorContentSchema.shape.professionalIntro,
  about: hospitalDoctorContentSchema.shape.about,
  expertiseSummary: hospitalDoctorContentSchema.shape.expertiseSummary,
  services: hospitalDoctorContentSchema.shape.services,
  faqs: hospitalDoctorContentSchema.shape.faqs,
  seoTitle: hospitalDoctorContentSchema.shape.seoTitle,
  seoDescription: hospitalDoctorContentSchema.shape.seoDescription,
};

export function getSectionSchema(targetType: string, section: string): z.ZodTypeAny | null {
  if (targetType === "ONLY_DOCTOR") {
    return onlyDoctorSectionSchemas[section] || null;
  }
  if (targetType === "HOSPITAL") {
    return hospitalSectionSchemas[section] || null;
  }
  if (targetType === "HOSPITAL_DOCTOR") {
    return hospitalDoctorSectionSchemas[section] || null;
  }
  return null;
}

export function validateFullContent(
  targetType: string,
  content: unknown
): { success: true; data: any } | { success: false; error: string } {
  let schema: z.ZodTypeAny;
  if (targetType === "ONLY_DOCTOR") {
    schema = onlyDoctorContentSchema;
  } else if (targetType === "HOSPITAL") {
    schema = hospitalContentSchema;
  } else if (targetType === "HOSPITAL_DOCTOR") {
    schema = hospitalDoctorContentSchema;
  } else {
    return { success: false, error: `Unsupported targetType: ${targetType}` };
  }

  const result = schema.safeParse(content);
  if (!result.success) {
    const errorMsg = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data };
}

/**
 * Request Payloads
 */
export const aiGenerateRequestSchema = z.object({
  targetType: z.enum(["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
});

export const aiRegenerateRequestSchema = z.object({
  targetType: z.enum(["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
  section: z.string().min(1, "Section to regenerate is required"),
});

export const aiApproveRequestSchema = z.object({
  targetType: z.enum(["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
  editedContent: z.record(z.unknown()).optional(),
});

export const aiPublishRequestSchema = z.object({
  targetType: z.enum(["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
});

export const aiUpdateLiveContentSchema = z.object({
  targetType: z.enum(["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
  content: z.record(z.any()),
});

/**
 * Website Section Ordering, Visibility & Doctor Custom Section Schema
 */
export const LOCKED_WEBSITE_SECTION_IDS = ["home", "about", "footer"] as const;
export const DOCTOR_REORDERABLE_SECTION_IDS = [
  "services",
  "facility",
  "reviews",
  "timings",
  "faqs",
  "custom",
] as const;
export const HOSPITAL_REORDERABLE_SECTION_IDS = [
  "services",
  "doctors",
  "facility",
  "reviews",
  "timings",
  "faqs",
] as const;

export const customSectionCardSchema = z.object({
  title: z.string().trim().min(2, "Card title must be at least 2 characters").max(50, "Card title must be 50 characters or fewer"),
  description: z.string().trim().min(8, "Card description must be at least 8 characters").max(160, "Card description must be 160 characters or fewer"),
});

export const customSectionPointSchema = z.object({
  heading: z.string().trim().min(2, "Point heading must be at least 2 characters").max(55, "Point heading must be 55 characters or fewer"),
  detail: z.string().trim().min(8, "Point detail must be at least 8 characters").max(140, "Point detail must be 140 characters or fewer"),
});

export const doctorCustomSectionSchema = z.object({
  enabled: z.boolean().default(false),
  navLabel: z.string().trim().max(18, "Nav label must be 18 characters or fewer").optional().default("Highlights"),
  badge: z.string().trim().max(30, "Section badge must be 30 characters or fewer").optional().default(""),
  title: z.string().trim().max(80, "Section title must be 80 characters or fewer").optional().default(""),
  subtitle: z.string().trim().max(200, "Section subtitle must be 200 characters or fewer").optional().default(""),
  layout: z.enum(["cards", "narrative", "highlights"]).default("cards"),
  cards: z.array(customSectionCardSchema).max(6, "Maximum 6 custom cards allowed").optional().default([]),
  paragraph: z.string().trim().max(1000, "Paragraph must be 1000 characters or fewer").optional().default(""),
  points: z.array(customSectionPointSchema).max(8, "Maximum 8 highlight points allowed").optional().default([]),
});

export function sanitizeAndValidateWebsiteLayoutConfig(
  targetType: string,
  content: Record<string, any>
): void {
  const isHospital = targetType === AiTargetType.HOSPITAL;
  const allowedIds: readonly string[] = isHospital
    ? HOSPITAL_REORDERABLE_SECTION_IDS
    : DOCTOR_REORDERABLE_SECTION_IDS;
  const allowedSet = new Set(allowedIds);
  const lockedSet = new Set<string>(LOCKED_WEBSITE_SECTION_IDS);

  if (content.sectionOrder !== undefined) {
    if (!Array.isArray(content.sectionOrder)) {
      throw new Error("sectionOrder must be an array of section identifiers.");
    }
    for (const rawId of content.sectionOrder) {
      const id = String(rawId || "").trim();
      if (lockedSet.has(id)) {
        throw new Error(
          `Header, Home, About, and Footer positions are fixed and cannot be reordered (${id}).`
        );
      }
    }
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const rawId of content.sectionOrder) {
      const id = String(rawId || "").trim();
      if (allowedSet.has(id) && !seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }
    for (const fallbackId of allowedIds) {
      if (!seen.has(fallbackId)) {
        deduped.push(fallbackId);
      }
    }
    content.sectionOrder = deduped;
  }

  if (content.hiddenSections !== undefined) {
    if (!Array.isArray(content.hiddenSections)) {
      throw new Error("hiddenSections must be an array of section identifiers.");
    }
    for (const rawId of content.hiddenSections) {
      const id = String(rawId || "").trim();
      if (lockedSet.has(id)) {
        throw new Error(
          `Home, About, and Footer sections cannot be hidden (${id}).`
        );
      }
    }
    const cleanHidden: string[] = [];
    const seenHidden = new Set<string>();
    for (const rawId of content.hiddenSections) {
      const id = String(rawId || "").trim();
      if (allowedSet.has(id) && !seenHidden.has(id)) {
        seenHidden.add(id);
        cleanHidden.push(id);
      }
    }
    content.hiddenSections = cleanHidden;
  }

  if (content.customSection !== undefined && content.customSection !== null) {
    if (isHospital) {
      if (content.customSection?.enabled === true) {
        throw new Error("Custom sections are only supported on doctor websites.");
      }
      delete content.customSection;
      return;
    }

    const rawCustom = content.customSection;
    if (
      rawCustom &&
      (rawCustom.image !== undefined ||
        rawCustom.imageUrl !== undefined ||
        rawCustom.photo !== undefined ||
        rawCustom.photos !== undefined ||
        rawCustom.media !== undefined)
    ) {
      throw new Error("Images are not allowed inside the Doctor Custom Section.");
    }

    const sanitizedInput = {
      enabled: Boolean(rawCustom?.enabled),
      navLabel: typeof rawCustom?.navLabel === "string" ? rawCustom.navLabel.trim() : "Highlights",
      badge: typeof rawCustom?.badge === "string" ? rawCustom.badge.trim() : "",
      title: typeof rawCustom?.title === "string" ? rawCustom.title.trim() : "",
      subtitle: typeof rawCustom?.subtitle === "string" ? rawCustom.subtitle.trim() : "",
      layout: rawCustom?.layout || "cards",
      cards: Array.isArray(rawCustom?.cards)
        ? rawCustom.cards.map((c: any) => ({
            title: String(c?.title || "").trim(),
            description: String(c?.description || "").trim(),
          }))
        : [],
      paragraph: typeof rawCustom?.paragraph === "string" ? rawCustom.paragraph.trim() : "",
      points: Array.isArray(rawCustom?.points)
        ? rawCustom.points.map((p: any) => ({
            heading: String(p?.heading || "").trim(),
            detail: String(p?.detail || "").trim(),
          }))
        : [],
    };

    if (!sanitizedInput.enabled) {
      // Allow saving disabled draft metadata without blocking on incomplete active fields
      content.customSection = {
        ...sanitizedInput,
        cards: sanitizedInput.cards.slice(0, 6),
        points: sanitizedInput.points.slice(0, 8),
      };
      return;
    }

    const parsed = doctorCustomSectionSchema.safeParse(sanitizedInput);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
    }

    const validCustom = parsed.data;
    if (!validCustom.title || validCustom.title.length < 3) {
      throw new Error("Custom section title must be at least 3 characters.");
    }
    if (validCustom.layout === "cards" && validCustom.cards.length < 2) {
      throw new Error("Custom section 'Cards Grid' layout requires at least 2 cards (maximum 6).");
    }
    if (validCustom.layout === "narrative" && validCustom.paragraph.length < 20) {
      throw new Error("Custom section 'Heading & Paragraph' layout requires at least 20 characters in the paragraph.");
    }
    if (validCustom.layout === "highlights" && validCustom.points.length < 2) {
      throw new Error("Custom section 'Key Points' layout requires at least 2 highlight points (maximum 8).");
    }

    content.customSection = validCustom;
  }
}
