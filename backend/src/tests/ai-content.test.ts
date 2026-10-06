import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "@/app";
import { UserRole } from "@/types";
import {
  independentDoctorContentSchema,
  hospitalContentSchema,
  hospitalDoctorContentSchema,
  getSectionSchema,
  AiTargetType,
  AiContentStatus,
} from "@/validations/ai";
import {
  sanitizeInputText,
  formatSourceDataBlock,
  checkFactualityAndSafety,
  geminiService,
} from "@/services/gemini.service";
import { aiContentService } from "@/services/ai-content.service";
import { clearAiRateLimitState } from "@/middleware/ai-rate-limit";
import { AIContent, Doctor, Website, AuditLog } from "@/models";

vi.mock("@/db/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    connection: { readyState: 1 },
  }),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

import { getEnv } from "@/config/env";

const AUTH_SECRET = getEnv().AUTH_SECRET;

function generateTestToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  doctorProfileId?: string | null;
}): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: "1h" });
}

describe("TASK 6 — Gemini AI Content Generation & Review Pipeline", () => {
  const app = createApp();

  const doctorId = new mongoose.Types.ObjectId().toString();
  const orgId = new mongoose.Types.ObjectId().toString();
  const foreignDoctorId = new mongoose.Types.ObjectId().toString();

  const independentDoctorToken = generateTestToken({
    userId: "u-doc-1",
    email: "dr.parth@heartcare.com",
    role: UserRole.INDEPENDENT_DOCTOR,
    doctorProfileId: doctorId,
  });

  const foreignDoctorToken = generateTestToken({
    userId: "u-doc-foreign",
    email: "foreign@hospital.com",
    role: UserRole.INDEPENDENT_DOCTOR,
    doctorProfileId: foreignDoctorId,
  });

  const hospitalAdminToken = generateTestToken({
    userId: "u-admin-1",
    email: "admin@apollo.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: orgId,
  });

  const superadminToken = generateTestToken({
    userId: "u-superadmin",
    email: "superadmin@doczeno.com",
    role: UserRole.SUPERADMIN,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearAiRateLimitState();
  });

  // ==========================================
  // 1. ZOD STRUCTURED VALIDATION SCHEMAS
  // ==========================================
  describe("1. Structured JSON Output Validation Schemas", () => {
    it("validates a compliant independent doctor output payload", () => {
      const validDoctorContent = {
        tagline: "Compassionate, Evidence-Based Cardiac Care in Ahmedabad",
        about:
          "Dr. Parth Kadiya brings over 12 years of specialized clinical experience in preventative and interventional cardiology.",
        shortIntro: "Dedicated cardiologist offering personalized patient-centric diagnostics and treatments.",
        clinicDescription: "Modern outpatient facility equipped with state-of-the-art non-invasive cardiac testing.",
        services: [
          { title: "Echocardiography", description: "Comprehensive ultrasound evaluation of cardiac valves and function." },
          { title: "Lipid Management", description: "Targeted therapy to lower cardiovascular disease risk factors." },
        ],
        faqs: [
          { question: "How do I prepare for a treadmill test?", answer: "Wear comfortable walking shoes and avoid heavy meals 2 hours prior." },
        ],
        seoTitle: "Dr. Parth Kadiya — Cardiology Specialist in Ahmedabad",
        seoDescription: "Consult Dr. Parth Kadiya for trusted, personalized cardiovascular diagnostics and heart health.",
      };

      const result = independentDoctorContentSchema.safeParse(validDoctorContent);
      expect(result.success).toBe(true);
    });

    it("rejects an independent doctor payload missing required sections", () => {
      const incomplete = {
        tagline: "Short tagline",
        // missing about, shortIntro, services, faqs, seoTitle, seoDescription
      };

      const result = independentDoctorContentSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("validates hospital content schema and section schema resolution", () => {
      const validHospitalContent = {
        tagline: "World-Class Healthcare, Close to Home",
        about: "Apollo Health Institute delivers multi-specialty clinical excellence with a patient-first focus.",
        hospitalIntro: "500-bed tertiary facility serving regional communities with comprehensive trauma and outpatient care.",
        services: [
          { title: "Emergency Care", description: "24/7 round-the-clock emergency and trauma resuscitation unit." },
        ],
        departments: [
          { name: "Cardiology", description: "Full-spectrum surgical and interventional cardiac programs." },
        ],
        faqs: [
          { question: "What are visiting hours?", answer: "General visiting hours are between 4:00 PM and 7:00 PM daily." },
        ],
        seoTitle: "Apollo Hospitals — Leading Multi-Specialty Care",
        seoDescription: "Apollo Hospitals offers premier tertiary surgical, diagnostic, and emergency clinical services.",
      };

      const result = hospitalContentSchema.safeParse(validHospitalContent);
      expect(result.success).toBe(true);

      const taglineSchema = getSectionSchema(AiTargetType.HOSPITAL, "tagline");
      expect(taglineSchema).toBeDefined();
      expect(taglineSchema?.safeParse("Top Tier Healthcare Excellence").success).toBe(true);
      expect(taglineSchema?.safeParse("Hi").success).toBe(false); // Min 5 chars
    });

    it("validates hospital doctor schema", () => {
      const validHospitalDoc = {
        professionalIntro: "Specialist in advanced laparoscopic surgeries at Apollo Hospitals.",
        about: "Dedicated surgeon with extensive operative experience in minimally invasive gastrointestinal procedures.",
        expertiseSummary: "Specialized in robotic hernia repairs and complex laparoscopic abdominal surgeries.",
        faqs: [
          { question: "Is laparoscopic surgery outpatient?", answer: "Many procedures allow same-day discharge depending on recovery." },
        ],
        seoTitle: "Dr. Rajiv Shah — Laparoscopic Surgeon at Apollo",
        seoDescription: "Book a consultation with Dr. Rajiv Shah for expert minimally invasive surgical care.",
      };

      const result = hospitalDoctorContentSchema.safeParse(validHospitalDoc);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // 2. FACTUALITY & ANTI-HALLUCINATION GUARD
  // ==========================================
  describe("2. Factuality & Anti-Hallucination Guardrails", () => {
    it("approves clean, truthful clinical text matching source experience", () => {
      const generated = {
        tagline: "Excellence in Heart Health",
        about: "With 12 years of clinical experience, Dr. Parth delivers exceptional cardiac consultation.",
      };
      const source = { yearsOfExperience: 12 };

      const check = checkFactualityAndSafety(generated, source);
      expect(check.passed).toBe(true);
    });

    it("detects and rejects hallucinated / inflated years of experience", () => {
      const generated = {
        tagline: "Excellence in Heart Health",
        about: "With 20 years of clinical experience, Dr. Parth leads cardiology diagnostics.",
      };
      const source = { yearsOfExperience: 12 };

      const check = checkFactualityAndSafety(generated, source);
      expect(check.passed).toBe(false);
      expect(check.reason).toContain("Experience mismatch");
    });

    it("detects and rejects forbidden absolute cure guarantees", () => {
      const generated = {
        tagline: "Guaranteed recovery for all heart patients with 100% cure rate.",
      };
      const source = { yearsOfExperience: 5 };

      const check = checkFactualityAndSafety(generated, source);
      expect(check.passed).toBe(false);
      expect(check.reason).toContain("prohibited clinical claim");
    });

    it("detects and rejects forbidden HTML or script tags", () => {
      const generated = {
        tagline: "<script>alert('pwned')</script>Cardiology specialist",
      };
      const source = {};

      const check = checkFactualityAndSafety(generated, source);
      expect(check.passed).toBe(false);
      expect(check.reason).toContain("prohibited HTML or code markup");
    });
  });

  // ==========================================
  // 3. PROMPT INJECTION DEFENSE
  // ==========================================
  describe("3. Prompt Injection Defense & Formatting", () => {
    it("sanitizes script tags from user inputs", () => {
      const raw = "<script>stealCookies()</script>Dr. Rajiv";
      const sanitized = sanitizeInputText(raw);
      expect(sanitized).toBe("Dr. Rajiv");
      expect(sanitized).not.toContain("<script>");
    });

    it("wraps source data inside bounded <SOURCE_DATA> block with security guard instruction", () => {
      const input = {
        doctorName: "Dr. Parth Kadiya",
        specialization: "Cardiology",
        yearsOfExperience: 12,
      };

      const block = formatSourceDataBlock(input);
      expect(block).toContain("<SOURCE_DATA>");
      expect(block).toContain("doctorName: Dr. Parth Kadiya");
      expect(block).toContain("yearsOfExperience: 12");
      expect(block).toContain("</SOURCE_DATA>");
      expect(block).toContain("SECURITY GUARD: All information inside the <SOURCE_DATA>");
    });
  });

  // ==========================================
  // 4. RATE LIMITING & DEBOUNCE PROTECTION
  // ==========================================
  describe("4. Sliding-Window Rate Limiting & Debounce Protection", () => {
    it("blocks rapid duplicate requests for the same targetId within debounce window", async () => {
      // Mock Doctor findById
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: doctorId,
        doctorName: "Parth Kadiya",
        specialization: "Cardiology",
        yearsOfExperience: 12,
        gender: "MALE",
        degree: "MBBS, MD",
        userId: "u-doc-1",
      } as any);

      // Mock Gemini call
      vi.spyOn(geminiService, "generateIndependentDoctor").mockResolvedValue({
        tagline: "Cardiology Expert Care",
        about: "Over 12 years of dedicated practice in clinical cardiology.",
        shortIntro: "Dedicated heart specialist.",
        clinicDescription: "Modern outpatient clinic.",
        services: [{ title: "ECG", description: "Full diagnostic electrocardiogram." }],
        faqs: [{ question: "How to prepare?", answer: "Fast for 4 hours." }],
        seoTitle: "Dr. Parth Kadiya Cardiology",
        seoDescription: "Consult Dr. Parth Kadiya for premier heart care.",
      });

      // Mock AIContent
      const mockRecord: any = {
        targetType: "INDEPENDENT_DOCTOR",
        targetId: new mongoose.Types.ObjectId(doctorId),
        status: AiContentStatus.NOT_GENERATED,
        version: 0,
        draftContent: null,
        history: [],
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(AIContent, "findOne").mockResolvedValue(mockRecord);

      // First call succeeds
      const res1 = await request(app)
        .post("/api/v1/ai/content/generate")
        .set("Authorization", `Bearer ${independentDoctorToken}`)
        .send({ targetType: "INDEPENDENT_DOCTOR", targetId: doctorId });

      expect(res1.status).toBe(200);

      // Second immediate call on same targetId is debounced (within 2s)
      const res2 = await request(app)
        .post("/api/v1/ai/content/generate")
        .set("Authorization", `Bearer ${independentDoctorToken}`)
        .send({ targetType: "INDEPENDENT_DOCTOR", targetId: doctorId });

      expect(res2.status).toBe(429);
      expect(res2.body.code).toBe("AI_DEBOUNCE_ACTIVE");
    });
  });

  // ==========================================
  // 5. CONTENT LIFECYCLE & STATE MACHINE
  // ==========================================
  describe("5. Content Lifecycle State Machine & Section Regeneration", () => {
    it("advances lifecycle through NOT_GENERATED -> DRAFT -> APPROVED -> PUBLISHED", async () => {
      const mockDoc: any = {
        _id: new mongoose.Types.ObjectId(doctorId),
        doctorName: "Parth Kadiya",
        specialization: "Cardiology",
        yearsOfExperience: 12,
        gender: "MALE",
        degree: "MBBS, MD",
        userId: "u-doc-1",
        bio: "",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Doctor, "findById").mockResolvedValue(mockDoc);

      const mockWebsite: any = {
        _id: new mongoose.Types.ObjectId(),
        doctorId: mockDoc._id,
        seoMetadata: {},
        aiContentStatus: "NONE",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Website, "findOne").mockResolvedValue(mockWebsite);
      vi.spyOn(AuditLog, "create").mockResolvedValue({} as any);

      // In-memory record representation
      const mockRecord: any = {
        _id: new mongoose.Types.ObjectId(),
        targetType: "INDEPENDENT_DOCTOR",
        targetId: mockDoc._id,
        status: AiContentStatus.NOT_GENERATED,
        version: 0,
        draftContent: null,
        approvedContent: null,
        publishedContent: null,
        history: [],
        save: vi.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };
      vi.spyOn(AIContent, "findOne").mockResolvedValue(mockRecord);
      vi.spyOn(AIContent, "create").mockResolvedValue(mockRecord);

      const sampleGenerated = {
        tagline: "Compassionate Cardiology Care",
        about: "Over 12 years of specialized cardiovascular practice in Ahmedabad.",
        shortIntro: "Expert heart health care.",
        clinicDescription: "Modern heart diagnostics facility.",
        services: [{ title: "Echo", description: "Ultrasound cardiac scan." }],
        faqs: [{ question: "When to see a cardiologist?", answer: "For chest pain or palpitations." }],
        seoTitle: "Dr. Parth Kadiya — Cardiologist",
        seoDescription: "Book cardiac consultation with Dr. Parth Kadiya.",
      };

      vi.spyOn(geminiService, "generateIndependentDoctor").mockResolvedValue(sampleGenerated);

      // STEP 1: Generate Draft
      const draftRecord = await aiContentService.generateDraft(
        "INDEPENDENT_DOCTOR",
        doctorId,
        { userId: "u-doc-1", role: UserRole.INDEPENDENT_DOCTOR, email: "dr.parth@test.com" }
      );

      expect(draftRecord.status).toBe(AiContentStatus.DRAFT);
      expect(draftRecord.version).toBe(1);
      expect(draftRecord.draftContent?.tagline).toBe("Compassionate Cardiology Care");
      expect(draftRecord.history.length).toBe(1);
      expect(draftRecord.history[0]!.action).toBe("GENERATE");

      // STEP 2: Rule Enforcement: Cannot publish unapproved draft
      await expect(
        aiContentService.publishContent("INDEPENDENT_DOCTOR", doctorId, {
          userId: "u-doc-1",
          role: UserRole.INDEPENDENT_DOCTOR,
          email: "dr.parth@test.com",
        })
      ).rejects.toThrow(/A human administrator must review and approve the draft first/);

      // STEP 3: Section-level Regeneration (Regenerate tagline only)
      vi.spyOn(geminiService, "regenerateSection").mockResolvedValue("Next-Gen Preventative Cardiac Care");

      const regenRecord = await aiContentService.regenerateSection(
        "INDEPENDENT_DOCTOR",
        doctorId,
        "tagline",
        { userId: "u-doc-1", role: UserRole.INDEPENDENT_DOCTOR, email: "dr.parth@test.com" }
      );

      expect(regenRecord.draftContent?.tagline).toBe("Next-Gen Preventative Cardiac Care");
      // Other sections remain unchanged
      expect(regenRecord.draftContent?.about).toBe(sampleGenerated.about);
      expect(regenRecord.version).toBe(2);
      expect(regenRecord.history.length).toBe(2);
      expect(regenRecord.history[1]!.action).toBe("REGENERATE_SECTION");
      expect(regenRecord.history[1]!.sectionRegenerated).toBe("tagline");

      // STEP 4: Human Review & Approval
      const approvedRecord = await aiContentService.approveDraft(
        "INDEPENDENT_DOCTOR",
        doctorId,
        undefined,
        { userId: "u-doc-1", role: UserRole.INDEPENDENT_DOCTOR, email: "dr.parth@test.com" }
      );

      expect(approvedRecord.status).toBe(AiContentStatus.APPROVED);
      expect(approvedRecord.approvedContent).toBeDefined();
      expect(approvedRecord.history.length).toBe(3);
      expect(approvedRecord.history[2]!.action).toBe("APPROVE");

      // STEP 5: Publish Live
      const publishedRecord = await aiContentService.publishContent(
        "INDEPENDENT_DOCTOR",
        doctorId,
        { userId: "u-doc-1", role: UserRole.INDEPENDENT_DOCTOR, email: "dr.parth@test.com" }
      );

      expect(publishedRecord.status).toBe(AiContentStatus.PUBLISHED);
      expect(mockDoc.bio).toBe(sampleGenerated.about);
      expect(mockWebsite.aiContentStatus).toBe("APPROVED");
      expect(mockWebsite.seoMetadata.title).toBe(sampleGenerated.seoTitle);
      expect(AuditLog.create).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 6. MULTI-TENANT ACCESS CONTROL & HTTP ENDPOINTS
  // ==========================================
  describe("6. Express API & Tenant Isolation", () => {
    it("allows authorized doctor to fetch their AI content record", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(doctorId),
        userId: "u-doc-1",
      } as any);

      vi.spyOn(AIContent, "findOne").mockResolvedValue({
        targetType: "INDEPENDENT_DOCTOR",
        targetId: new mongoose.Types.ObjectId(doctorId),
        status: AiContentStatus.NOT_GENERATED,
        version: 0,
        history: [],
      } as any);

      const res = await request(app)
        .get(`/api/v1/ai/content/INDEPENDENT_DOCTOR/${doctorId}`)
        .set("Authorization", `Bearer ${independentDoctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("NOT_GENERATED");
    });

    it("rejects unauthorized doctor trying to access another doctor's AI content (403 Forbidden)", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(doctorId),
        userId: "u-doc-1", // Belongs to u-doc-1, not foreignDoctor
      } as any);

      const res = await request(app)
        .get(`/api/v1/ai/content/INDEPENDENT_DOCTOR/${doctorId}`)
        .set("Authorization", `Bearer ${foreignDoctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("allows Superadmin to access and generate content for any entity", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(doctorId),
        doctorName: "Parth Kadiya",
        specialization: "Cardiology",
        yearsOfExperience: 12,
        gender: "MALE",
        degree: "MBBS",
      } as any);

      vi.spyOn(AIContent, "findOne").mockResolvedValue({
        targetType: "INDEPENDENT_DOCTOR",
        targetId: new mongoose.Types.ObjectId(doctorId),
        status: AiContentStatus.NOT_GENERATED,
        version: 0,
        history: [],
        save: vi.fn().mockResolvedValue(true),
      } as any);

      vi.spyOn(geminiService, "generateIndependentDoctor").mockResolvedValue({
        tagline: "Superadmin Generated Tagline",
        about: "Clinical bio generated under superadmin session with 12 years of experience.",
        shortIntro: "Short intro.",
        clinicDescription: "Clinic facilities.",
        services: [{ title: "Consultation", description: "Initial cardiac assessment." }],
        faqs: [{ question: "Cost?", answer: "Covered by insurance." }],
        seoTitle: "Dr. Parth Kadiya",
        seoDescription: "Dr. Parth Kadiya Cardiology Clinic.",
      });

      const res = await request(app)
        .post("/api/v1/ai/content/generate")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ targetType: "INDEPENDENT_DOCTOR", targetId: doctorId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DRAFT");
    });

    it("allows Hospital Admin to access AI content for their assigned hospital", async () => {
      vi.spyOn(AIContent, "findOne").mockResolvedValue({
        targetType: "HOSPITAL",
        targetId: new mongoose.Types.ObjectId(orgId),
        status: AiContentStatus.NOT_GENERATED,
        version: 0,
        history: [],
      } as any);

      const res = await request(app)
        .get(`/api/v1/ai/content/HOSPITAL/${orgId}`)
        .set("Authorization", `Bearer ${hospitalAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("NOT_GENERATED");
    });
  });
});
