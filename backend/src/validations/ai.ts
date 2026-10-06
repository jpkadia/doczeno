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
 * 1. Independent Doctor Generated Content Schema
 */
export const independentDoctorContentSchema = z.object({
  tagline: z.string().min(5).max(150),
  about: z.string().min(20).max(1500),
  shortIntro: z.string().min(10).max(400),
  clinicDescription: z.string().min(10).max(600),
  services: z.array(serviceItemSchema).min(1).max(12),
  faqs: z.array(faqItemSchema).min(1).max(10),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(10).max(160),
});

export type IndependentDoctorGeneratedContent = z.infer<typeof independentDoctorContentSchema>;

/**
 * 2. Hospital / Clinic Generated Content Schema
 */
export const hospitalContentSchema = z.object({
  tagline: z.string().min(5).max(150),
  about: z.string().min(20).max(1500),
  hospitalIntro: z.string().min(10).max(500),
  services: z.array(serviceItemSchema).min(1).max(15),
  departments: z.array(departmentItemSchema).min(1).max(15),
  faqs: z.array(faqItemSchema).min(1).max(10),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(10).max(160),
});

export type HospitalGeneratedContent = z.infer<typeof hospitalContentSchema>;

/**
 * 3. Hospital Doctor Generated Content Schema
 */
export const hospitalDoctorContentSchema = z.object({
  professionalIntro: z.string().min(10).max(500),
  about: z.string().min(20).max(1500),
  expertiseSummary: z.string().min(10).max(600),
  faqs: z.array(faqItemSchema).min(1).max(10),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(10).max(160),
});

export type HospitalDoctorGeneratedContent = z.infer<typeof hospitalDoctorContentSchema>;

/**
 * Target Types
 */
export const AiTargetType = {
  INDEPENDENT_DOCTOR: "INDEPENDENT_DOCTOR",
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
export const independentDoctorSectionSchemas: Record<string, z.ZodTypeAny> = {
  tagline: independentDoctorContentSchema.shape.tagline,
  about: independentDoctorContentSchema.shape.about,
  shortIntro: independentDoctorContentSchema.shape.shortIntro,
  clinicDescription: independentDoctorContentSchema.shape.clinicDescription,
  services: independentDoctorContentSchema.shape.services,
  faqs: independentDoctorContentSchema.shape.faqs,
  seoTitle: independentDoctorContentSchema.shape.seoTitle,
  seoDescription: independentDoctorContentSchema.shape.seoDescription,
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
  professionalIntro: hospitalDoctorContentSchema.shape.professionalIntro,
  about: hospitalDoctorContentSchema.shape.about,
  expertiseSummary: hospitalDoctorContentSchema.shape.expertiseSummary,
  faqs: hospitalDoctorContentSchema.shape.faqs,
  seoTitle: hospitalDoctorContentSchema.shape.seoTitle,
  seoDescription: hospitalDoctorContentSchema.shape.seoDescription,
};

export function getSectionSchema(targetType: string, section: string): z.ZodTypeAny | null {
  if (targetType === "INDEPENDENT_DOCTOR") {
    return independentDoctorSectionSchemas[section] || null;
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
  if (targetType === "INDEPENDENT_DOCTOR") {
    schema = independentDoctorContentSchema;
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
  targetType: z.enum(["INDEPENDENT_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
});

export const aiRegenerateRequestSchema = z.object({
  targetType: z.enum(["INDEPENDENT_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
  section: z.string().min(1, "Section to regenerate is required"),
});

export const aiApproveRequestSchema = z.object({
  targetType: z.enum(["INDEPENDENT_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
  editedContent: z.record(z.unknown()).optional(),
});

export const aiPublishRequestSchema = z.object({
  targetType: z.enum(["INDEPENDENT_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"]),
  targetId: z.string().min(1, "Target ID is required"),
});
