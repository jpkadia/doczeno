import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "@/app";
import { UserRole, WebsiteType } from "@/types";
import {
  Website,
  Doctor,
  Organization,
  ChatbotKnowledge,
  ChatbotConversation,
  Appointment,
  AuditLog,
} from "@/models";
import { ragKnowledgeService } from "@/services/rag-knowledge.service";
import { isMedicalAdviceQuery } from "@/services/public-chatbot.service";
import { adminAssistantService } from "@/services/admin-assistant.service";
import { clearChatbotRateLimitState } from "@/middleware/chatbot-rate-limit";

// Mock DB connection
vi.mock("@/db/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    connection: { readyState: 1 },
  }),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

// Mock GoogleGenAI SDK
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn().mockResolvedValue({
    text: "Dr. Parth Kadiya consults Monday to Saturday from 09:00 AM to 01:00 PM.",
    functionCalls: [],
  }),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
  Type: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
  },
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

describe("TASK 7 — Public Chatbot, Admin AI Assistant & Tenant-Scoped RAG", () => {
  const app = createApp();

  const doctorId = new mongoose.Types.ObjectId().toString();
  const foreignDoctorId = new mongoose.Types.ObjectId().toString();
  const hospitalId = new mongoose.Types.ObjectId().toString();
  const foreignHospitalId = new mongoose.Types.ObjectId().toString();
  const hospitalDoctorId = new mongoose.Types.ObjectId().toString();

  const hospitalAdminToken = generateTestToken({
    userId: "user-hosp-admin",
    email: "admin@apollo.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: hospitalId,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearChatbotRateLimitState();

    mockGenerateContent.mockResolvedValue({
      text: "Dr. Parth Kadiya consults Monday to Saturday from 09:00 AM to 01:00 PM.",
      functionCalls: [],
    });

    vi.spyOn(Website, "findOne").mockResolvedValue({
      _id: "w-doc-1",
      slug: "dr-parth",
      websiteType: WebsiteType.INDEPENDENT_DOCTOR,
      doctorId: doctorId,
      ownerId: doctorId,
    } as any);

    vi.spyOn(Doctor, "findById").mockResolvedValue({
      _id: doctorId,
      doctorName: "Parth Kadiya",
      specialization: "Cardiology",
      degree: "MBBS, MS",
      status: "ACTIVE",
    } as any);

    vi.spyOn(ChatbotConversation, "findOne").mockResolvedValue(null);
    vi.spyOn(ChatbotConversation, "create").mockImplementation((data: any) => {
      const doc = {
        ...data,
        messages: [...(data.messages || [])],
        save: vi.fn().mockResolvedValue(undefined),
      };
      return Promise.resolve(doc as any);
    });
    vi.spyOn(ChatbotConversation.prototype, "save").mockResolvedValue({} as any);
    vi.spyOn(AuditLog, "create").mockResolvedValue({} as any);
    vi.spyOn(Doctor, "countDocuments").mockResolvedValue(12 as any);
    vi.spyOn(Appointment, "countDocuments").mockResolvedValue(5 as any);
  });

  // ==========================================
  // 1. TENANT PRE-FILTERING (RAG SECURITY)
  // ==========================================
  describe("1. Strict Tenant Pre-Filtering (RAG Isolation)", () => {
    it("generates strict pre-filter for independent doctor with null organizationId", () => {
      const scope = {
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        doctorId: doctorId,
        organizationId: null,
        displayName: "Dr. Parth Kadiya",
      };

      const filter = ragKnowledgeService.getTenantFilter(scope);

      expect(String(filter.doctorId)).toBe(doctorId);
      expect(filter.isActive).toBe(true);
      expect(filter.visibility).toBe("PUBLIC");
      expect(filter.organizationId).toBeUndefined();
    });

    it("generates strict pre-filter for hospital with organizationId only", () => {
      const scope = {
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        doctorId: null,
        organizationId: hospitalId,
        displayName: "Apollo Hospitals",
      };

      const filter = ragKnowledgeService.getTenantFilter(scope);

      expect(String(filter.organizationId)).toBe(hospitalId);
      expect(filter.visibility).toBe("PUBLIC");
      expect(filter.isActive).toBe(true);
    });

    it("generates pre-filter for hospital doctor allowing only doctor profile and parent hospital", () => {
      const scope = {
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        doctorId: hospitalDoctorId,
        organizationId: hospitalId,
        displayName: "Dr. Rajiv Shah",
      };

      const filter = ragKnowledgeService.getTenantFilter(scope);

      expect(filter.isActive).toBe(true);
      expect(filter.visibility).toBe("PUBLIC");
      expect(filter.$or).toBeDefined();
      expect(String(filter.$or![0]!.doctorId)).toBe(hospitalDoctorId);
      expect(String(filter.$or![1]!.organizationId)).toBe(hospitalId);
    });

    it("executes retrieval strictly against tenant-scoped filter", async () => {
      const findSpy = vi.spyOn(ChatbotKnowledge, "find").mockResolvedValueOnce([
        {
          title: "Consultation Hours",
          chunkText: "Consultation hours are 09:00 AM - 01:00 PM, Monday to Saturday.",
          category: "SCHEDULE",
        } as any,
      ]);

      const scope = {
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        doctorId: doctorId,
        organizationId: null,
        displayName: "Dr. Parth Kadiya",
      };

      const results = await ragKnowledgeService.retrieveAuthorizedKnowledge(scope, "What are consultation hours?");

      expect(findSpy).toHaveBeenCalled();
      expect(results.length).toBe(1);
      expect(results[0]!.title).toBe("Consultation Hours");
    });
  });

  // ==========================================
  // 2. MEDICAL ADVICE & PRESCRIPTION REFUSAL
  // ==========================================
  describe("2. Medical Advice & Prescription Safe Refusal", () => {
    it("detects clinical diagnosis and prescription queries accurately", () => {
      expect(isMedicalAdviceQuery("I have severe chest pain and breathlessness")).toBe(true);
      expect(isMedicalAdviceQuery("What medicine or antibiotics should I take for fever?")).toBe(true);
      expect(isMedicalAdviceQuery("Can you prescribe me paracetamol dosage?")).toBe(true);
      expect(isMedicalAdviceQuery("Diagnose my symptoms of dizziness")).toBe(true);

      // Safe practice management queries should NOT be blocked
      expect(isMedicalAdviceQuery("What are your consultation timings?")).toBe(false);
      expect(isMedicalAdviceQuery("Where is your clinic located?")).toBe(false);
      expect(isMedicalAdviceQuery("How can I book an appointment?")).toBe(false);
      expect(isMedicalAdviceQuery("What is the doctor's qualification?")).toBe(false);
    });

    it("refuses medical diagnosis/prescription query immediately without invoking LLM", async () => {
      const response = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: "I have acute chest pain. What tablets should I take right now?",
          sessionId: "sess-medical-1",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain("Doczeno cannot provide medical diagnoses, treatment recommendations, or prescriptions");
      expect(response.body.response).toContain("Dr. Parth Kadiya");

      // Verify that Gemini was NEVER called for medical advice
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 3. PUBLIC CHATBOT GROUNDING & TURNS
  // ==========================================
  describe("3. Grounded Knowledge Responses & Turn Tracking", () => {
    it("provides grounded response using authorized knowledge chunks", async () => {
      vi.spyOn(ChatbotKnowledge, "find").mockResolvedValue([
        {
          title: "Consultation Hours",
          chunkText: "Consultation hours are 09:00 AM - 01:00 PM, Monday to Saturday.",
          category: "SCHEDULE",
        } as any,
      ]);

      mockGenerateContent.mockResolvedValueOnce({
        text: "Dr. Parth Kadiya's consultation hours are Monday to Saturday, 09:00 AM to 01:00 PM.",
      });

      const response = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: "What are your consultation hours?",
          sessionId: "sess-hours-1",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain("09:00 AM to 01:00 PM");
      expect(mockGenerateContent).toHaveBeenCalled();

      // Ensure model received the prompt with AUTHORIZED_KNOWLEDGE tags
      const callArgs = mockGenerateContent.mock.calls[0]![0];
      expect(callArgs.contents).toContain("<AUTHORIZED_KNOWLEDGE>");
      expect(callArgs.contents).toContain("<USER_QUERY>");
    });

    it("handles queries where info is not available with grounded refusal", async () => {
      vi.spyOn(ChatbotKnowledge, "find").mockResolvedValue([]);

      mockGenerateContent.mockResolvedValueOnce({
        text: "That information is not available in Dr. Parth Kadiya's practice records. Please contact the clinic directly.",
      });

      const response = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: "What is the secret recipe of the cafeteria tea?",
          sessionId: "sess-unknown-1",
        });

      expect(response.status).toBe(200);
      expect(response.body.response).toContain("Dr. Parth Kadiya");
      expect(response.body.response).toContain("not have information");
    });
  });

  // ==========================================
  // 4. RATE LIMITING & INPUT CONSTRAINTS
  // ==========================================
  describe("4. Rate Limiting, Turn Limits & Validation", () => {
    it("rejects messages exceeding 500 characters with 400 Bad Request", async () => {
      const longMessage = "a".repeat(501);

      const response = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: longMessage,
          sessionId: "sess-long-1",
        });

      expect(response.status).toBe(400);
      expect(response.body.message || response.body.error).toContain("500 characters");
    });

    it("rejects requests exceeding maximum turns (20 turns)", async () => {
      // Create conversation with 40 dialogue turns (20 rounds)
      const existingTurns = Array.from({ length: 40 }, (_, i) => ({
        role: "user" as const,
        content: `Question ${i}`,
        timestamp: new Date(),
      }));

      vi.spyOn(ChatbotConversation, "findOne").mockResolvedValue({
        sessionId: "sess-max-turns",
        messages: existingTurns,
        save: vi.fn(),
      } as any);

      const response = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: "One more question please",
          sessionId: "sess-max-turns",
        });

      expect(response.status).toBe(400);
      expect(response.body.message || response.body.error).toContain("Session turn limit reached");
    });

    it("enforces session debounce rejecting rapid-fire requests within 1.5 seconds", async () => {
      // First request succeeds
      const firstRes = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: "First message",
          sessionId: "sess-rapid-1",
        });

      expect(firstRes.status).toBe(200);

      // Second immediate request with same sessionId fails with 429
      const secondRes = await request(app)
        .post("/api/v1/chatbot/public/message")
        .send({
          slug: "dr-parth",
          message: "Second immediate message",
          sessionId: "sess-rapid-1",
        });

      expect(secondRes.status).toBe(429);
      expect(secondRes.body.message || secondRes.body.error).toContain("Please wait a moment");
    });
  });

  // ==========================================
  // 5. ADMIN AI ASSISTANT RBAC & SCOPED TOOLS
  // ==========================================
  describe("5. Admin AI Assistant RBAC & Scoped Controlled Tools", () => {
    it("rejects unauthenticated admin assistant calls with 401", async () => {
      const response = await request(app)
        .post("/api/v1/chatbot/admin/message")
        .send({
          message: "Show upcoming appointments",
        });

      expect(response.status).toBe(401);
    });

    it("independent doctor admin can execute getDoctorProfile for their own profile", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: doctorId,
        doctorName: "Parth Kadiya",
        degree: "MBBS, MS",
        specialization: "General Surgery",
        yearsOfExperience: 12,
        email: "dr.parth@heartcare.com",
        status: "ACTIVE",
      } as any);

      const user = {
        _id: "user-doc-1",
        email: "dr.parth@heartcare.com",
        role: UserRole.INDEPENDENT_DOCTOR,
        doctorProfileId: doctorId,
      } as any;

      const toolResult = await adminAssistantService.executeTool(
        "getDoctorProfile",
        { doctorId },
        user,
        false
      );

      expect(toolResult.requiresConfirmation).toBe(false);
      expect(toolResult.result.doctorName).toBe("Parth Kadiya");
      expect(toolResult.result.specialization).toBe("General Surgery");
    });

    it("prevents independent doctor from inspecting another doctor profile (cross-tenant denial)", async () => {
      const user = {
        _id: "user-doc-1",
        email: "dr.parth@heartcare.com",
        role: UserRole.INDEPENDENT_DOCTOR,
        doctorProfileId: doctorId,
      } as any;

      await expect(
        adminAssistantService.executeTool(
          "getDoctorProfile",
          { doctorId: foreignDoctorId },
          user,
          false
        )
      ).rejects.toThrow(/Forbidden: Cannot access another doctor's profile/i);
    });

    it("hospital admin can execute getHospitalOverview for their own hospital", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: hospitalId,
        name: "Apollo Hospitals",
        organizationType: "HOSPITAL",
        email: "admin@apollo.com",
        departments: ["Cardiology", "Neurology"],
        status: "ACTIVE",
      } as any);

      vi.spyOn(Doctor, "countDocuments").mockResolvedValue(12);

      const user = {
        _id: "user-hosp-admin",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: hospitalId,
      } as any;

      const toolResult = await adminAssistantService.executeTool(
        "getHospitalOverview",
        { organizationId: hospitalId },
        user,
        false
      );

      expect(toolResult.requiresConfirmation).toBe(false);
      expect(toolResult.result.name).toBe("Apollo Hospitals");
      expect(toolResult.result.totalDoctors).toBe(12);
    });

    it("prevents hospital admin from inspecting another hospital (cross-tenant denial)", async () => {
      const user = {
        _id: "user-hosp-admin",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: hospitalId,
      } as any;

      await expect(
        adminAssistantService.executeTool(
          "getHospitalOverview",
          { organizationId: foreignHospitalId },
          user,
          false
        )
      ).rejects.toThrow(/Forbidden: Cannot access another hospital's data/i);
    });
  });

  // ==========================================
  // 6. DESTRUCTIVE ACTIONS TWO-PHASE CONFIRMATION
  // ==========================================
  describe("6. Destructive Actions Two-Phase Confirmation Flow", () => {
    it("deactivateDoctor requires explicit confirmation and creates a pending action without immediate mutation", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: doctorId,
        doctorName: "Parth Kadiya",
        organizationId: hospitalId,
        status: "ACTIVE",
      } as any);

      const user = {
        _id: "user-hosp-admin",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: hospitalId,
      } as any;

      // Execute tool with confirmed = false
      const toolResult = await adminAssistantService.executeTool(
        "deactivateDoctor",
        { doctorId },
        user,
        false
      );

      expect(toolResult.requiresConfirmation).toBe(true);
      expect(toolResult.pendingAction).toBeDefined();
      expect(toolResult.pendingAction?.actionType).toBe("deactivateDoctor");
      expect(toolResult.confirmationPrompt).toContain('Are you sure you want to deactivate doctor "Dr. Parth Kadiya"?');

      // Verify doctor was NOT deactivated yet
      expect(toolResult.result.doctorStatus).toBe("ACTIVE");
    });

    it("executes deactivation and writes AuditLog only when confirmed by user", async () => {
      const doctorSaveMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: doctorId,
        doctorName: "Parth Kadiya",
        organizationId: hospitalId,
        status: "ACTIVE",
        save: doctorSaveMock,
      } as any);

      const auditLogCreateSpy = vi.spyOn(AuditLog, "create").mockResolvedValue({} as any);

      const user = {
        _id: "user-hosp-admin",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: hospitalId,
      } as any;

      // Execute tool with confirmed = true
      const toolResult = await adminAssistantService.executeTool(
        "deactivateDoctor",
        { doctorId },
        user,
        true
      );

      expect(toolResult.requiresConfirmation).toBe(false);
      expect(doctorSaveMock).toHaveBeenCalled();
      expect(auditLogCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CHATBOT_DEACTIVATE_DOCTOR",
        })
      );
      expect(toolResult.result.doctorStatus).toBe("INACTIVE");
    });

    it("handles two-phase confirmation over API endpoint (/api/v1/chatbot/admin/message)", async () => {
      const pendingActionId = "action-deact-123";
      const existingConversation = {
        sessionId: "sess-confirm-flow",
        userId: "user-hosp-admin",
        conversationType: "ADMIN",
        messages: [],
        pendingAction: {
          actionId: pendingActionId,
          actionType: "deactivateDoctor",
          toolName: "deactivateDoctor",
          args: { doctorId },
          prompt: "Confirm deactivation?",
          targetDescription: "Dr. Parth Kadiya",
          expiresAt: new Date(Date.now() + 300000), // 5 min in future
        },
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(ChatbotConversation, "findOne").mockResolvedValue(existingConversation as any);

      const doctorSaveMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: doctorId,
        doctorName: "Parth Kadiya",
        organizationId: hospitalId,
        status: "ACTIVE",
        save: doctorSaveMock,
      } as any);

      const response = await request(app)
        .post("/api/v1/chatbot/admin/message")
        .set("Authorization", `Bearer ${hospitalAdminToken}`)
        .send({
          message: "Confirm deactivation",
          sessionId: "sess-confirm-flow",
          confirmActionId: pendingActionId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain("deactivated successfully");
      expect(existingConversation.pendingAction).toBeNull();
    });
  });
});
