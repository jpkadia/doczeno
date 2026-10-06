import mongoose from "mongoose";
import {
  ChatbotConversation,
  IPendingAction,
  Doctor,
  Organization,
  Website,
  Appointment,
  AuditLog,
} from "@/models";
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/config/env";
import { AuthUserPayload, UserRole } from "@/types";
import { z } from "zod";

// Zod schemas for tool arguments validation
const getHospitalDoctorsArgsSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const getDoctorProfileArgsSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
});

const getUpcomingAppointmentsArgsSchema = z.object({
  doctorId: z.string().optional(),
  limit: z.number().max(50).optional(),
});

const getHospitalOverviewArgsSchema = z.object({
  organizationId: z.string().optional(),
});

const updateDoctorProfileArgsSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
  bio: z.string().max(2000).optional(),
  yearsOfExperience: z.number().min(0).max(80).optional(),
  degree: z.string().max(200).optional(),
});

const updateHospitalContentArgsSchema = z.object({
  tagline: z.string().max(200).optional(),
  about: z.string().max(2500).optional(),
});

const updateWebsiteTabTitleArgsSchema = z.object({
  tabTitle: z.string().min(2).max(100),
});

const updateHospitalBrandingArgsSchema = z.object({
  selectedTheme: z.string().optional(),
  faviconUrl: z.string().url().optional(),
});

const createDoctorArgsSchema = z.object({
  doctorName: z.string().min(2).max(100),
  degree: z.string().min(2).max(100),
  specialization: z.string().min(2).max(100),
  yearsOfExperience: z.number().min(0).max(75),
  email: z.string().email(),
});

const deactivateDoctorArgsSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
});

function toObjectIdSafe(val: any): mongoose.Types.ObjectId | null {
  if (!val) return null;
  return mongoose.Types.ObjectId.isValid(String(val)) ? new mongoose.Types.ObjectId(String(val)) : null;
}

export const ADMIN_ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: "getHospitalDoctors",
    description: "List all doctors currently affiliated with the administrator's hospital organization.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: ACTIVE or INACTIVE" },
      },
    },
  },
  {
    name: "getDoctorProfile",
    description: "Get detailed profile information for a specific doctor.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Doctor ID to retrieve" },
      },
      required: ["doctorId"],
    },
  },
  {
    name: "getUpcomingAppointments",
    description: "Retrieve upcoming scheduled patient appointments for the doctor or hospital.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Optional doctor ID to filter appointments" },
        limit: { type: "number", description: "Maximum number of appointments to retrieve" },
      },
    },
  },
  {
    name: "getHospitalOverview",
    description: "Retrieve hospital profile details, departments, working hours, and doctor counts.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "updateDoctorProfile",
    description: "Update clinical bio, years of experience, or degree qualifications for a doctor.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Doctor ID to update" },
        bio: { type: "string", description: "Updated clinical biography" },
        yearsOfExperience: { type: "number", description: "Updated years of experience" },
        degree: { type: "string", description: "Updated qualifications" },
      },
      required: ["doctorId"],
    },
  },
  {
    name: "updateHospitalContent",
    description: "Update the hospital tagline or about narrative text.",
    parameters: {
      type: "object",
      properties: {
        tagline: { type: "string", description: "Updated hospital tagline" },
        about: { type: "string", description: "Updated hospital about narrative" },
      },
    },
  },
  {
    name: "updateWebsiteTabTitle",
    description: "Update the public browser tab title for the website.",
    parameters: {
      type: "object",
      properties: {
        tabTitle: { type: "string", description: "New browser tab title" },
      },
      required: ["tabTitle"],
    },
  },
  {
    name: "updateHospitalBranding",
    description: "Update hospital theme or favicon URL.",
    parameters: {
      type: "object",
      properties: {
        selectedTheme: { type: "string", description: "Theme identifier (theme-1, theme-2, theme-3)" },
        faviconUrl: { type: "string", description: "New favicon URL" },
      },
    },
  },
  {
    name: "createDoctor",
    description: "Add a new affiliated doctor to the hospital roster.",
    parameters: {
      type: "object",
      properties: {
        doctorName: { type: "string", description: "Full name of the doctor" },
        degree: { type: "string", description: "Medical degrees (e.g. MBBS, MS)" },
        specialization: { type: "string", description: "Medical specialization" },
        yearsOfExperience: { type: "number", description: "Years of clinical experience" },
        email: { type: "string", description: "Doctor's professional email" },
      },
      required: ["doctorName", "degree", "specialization", "yearsOfExperience", "email"],
    },
  },
  {
    name: "deactivateDoctor",
    description: "DESTRUCTIVE ACTION: Deactivates an affiliated doctor. Requires explicit confirmation from the user.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "ID of the doctor to deactivate" },
      },
      required: ["doctorId"],
    },
  },
];

export class AdminAssistantService {
  private client: GoogleGenAI | null = null;
  private model: string;

  constructor() {
    const env = getEnv();
    this.model = env.GEMINI_MODEL || "gemini-3.8-flash";
    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const env = getEnv();
      const apiKey = env.GEMINI_API_KEY || "mock-gemini-api-key-for-test";
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Executes a backend tool with role checking, tenant isolation, argument validation, and audit logging
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    user: AuthUserPayload,
    isConfirmed = false
  ): Promise<{ result?: any; requiresConfirmation?: boolean; confirmationPrompt?: string; pendingAction?: IPendingAction }> {
    switch (toolName) {
      // 1. getHospitalDoctors
      case "getHospitalDoctors": {
        const parsed = getHospitalDoctorsArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid arguments for getHospitalDoctors");

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Only hospital administrators or superadmins can list hospital doctors");
        }

        const orgId = user.organizationId;
        if (!orgId && user.role !== UserRole.SUPERADMIN) {
          throw new Error("No organization associated with current administrator");
        }

        const query: any = {};
        if (orgId) query.organizationId = new mongoose.Types.ObjectId(orgId);
        if (parsed.data.status) query.status = parsed.data.status;

        const doctors = await Doctor.find(query)
          .select("doctorName specialization degree yearsOfExperience status email")
          .lean();

        return { requiresConfirmation: false, result: { count: doctors.length, doctors } };
      }

      // 2. getDoctorProfile
      case "getDoctorProfile": {
        const parsed = getDoctorProfileArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Doctor ID is required");

        if (
          (user.role === UserRole.INDEPENDENT_DOCTOR || user.role === UserRole.HOSPITAL_DOCTOR) &&
          user.doctorProfileId &&
          user.doctorProfileId.toString() !== parsed.data.doctorId.toString()
        ) {
          throw new Error("Forbidden: Cannot access another doctor's profile");
        }

        const doctor = await Doctor.findById(parsed.data.doctorId);
        if (!doctor) throw new Error("Doctor not found");

        // Tenant check for hospital admin
        if (
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          doctor.organizationId &&
          doctor.organizationId.toString() !== user.organizationId.toString()
        ) {
          throw new Error("Forbidden: You cannot access doctors outside your hospital");
        }

        return { requiresConfirmation: false, result: doctor };
      }

      // 3. getUpcomingAppointments
      case "getUpcomingAppointments": {
        const parsed = getUpcomingAppointmentsArgsSchema.safeParse(args);
        const limit = parsed.success && parsed.data.limit ? parsed.data.limit : 10;

        const query: any = { status: { $in: ["PENDING", "CONFIRMED"] } };

        if (user.role === UserRole.INDEPENDENT_DOCTOR || user.role === UserRole.HOSPITAL_DOCTOR) {
          if (!user.doctorProfileId) throw new Error("Doctor profile not found for user");
          query.doctorId = new mongoose.Types.ObjectId(user.doctorProfileId);
        } else if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
          query.organizationId = new mongoose.Types.ObjectId(user.organizationId);
          if (parsed.success && parsed.data.doctorId) {
            query.doctorId = new mongoose.Types.ObjectId(parsed.data.doctorId);
          }
        }

        const appointments = await Appointment.find(query)
          .sort({ appointmentDate: 1, startTime: 1 })
          .limit(limit)
          .lean();

        return { requiresConfirmation: false, result: { count: appointments.length, appointments } };
      }

      // 4. getHospitalOverview
      case "getHospitalOverview": {
        const parsed = getHospitalOverviewArgsSchema.safeParse(args);
        const targetOrgId = parsed.success && parsed.data.organizationId ? parsed.data.organizationId : user.organizationId;

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Hospital overview requires hospital admin role");
        }
        if (
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          targetOrgId &&
          targetOrgId.toString() !== user.organizationId.toString()
        ) {
          throw new Error("Forbidden: Cannot access another hospital's data");
        }
        if (!targetOrgId && user.role !== UserRole.SUPERADMIN) {
          throw new Error("No organization associated with user");
        }

        const org = await Organization.findById(targetOrgId);
        if (!org) throw new Error("Organization not found");

        const doctorCount = await Doctor.countDocuments({ organizationId: org._id, status: "ACTIVE" });
        const apptCount = await Appointment.countDocuments({ organizationId: org._id, status: "CONFIRMED" });

        return {
          requiresConfirmation: false,
          result: {
            name: org.name,
            type: org.type,
            workingHours: org.workingHours,
            activeDoctors: doctorCount,
            totalDoctors: doctorCount,
            confirmedAppointments: apptCount,
            about: org.about,
          },
        };
      }

      // 5. updateDoctorProfile
      case "updateDoctorProfile": {
        const parsed = updateDoctorProfileArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

        const doctor = await Doctor.findById(parsed.data.doctorId);
        if (!doctor) throw new Error("Doctor not found");

        // Tenant authorization
        const isSelf = user.doctorProfileId && user.doctorProfileId.toString() === doctor._id.toString();
        const isOrgAdmin =
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          doctor.organizationId &&
          doctor.organizationId.toString() === user.organizationId.toString();
        const isSuper = user.role === UserRole.SUPERADMIN;

        if (!isSelf && !isOrgAdmin && !isSuper) {
          throw new Error("Forbidden: You do not have permission to update this doctor");
        }

        if (parsed.data.bio !== undefined) doctor.bio = parsed.data.bio;
        if (parsed.data.yearsOfExperience !== undefined) doctor.yearsOfExperience = parsed.data.yearsOfExperience;
        if (parsed.data.degree !== undefined) doctor.degree = parsed.data.degree;

        await doctor.save();

        await AuditLog.create({
          userId: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
          userRole: user.role as any,
          action: "AI_ASSISTANT_UPDATE_DOCTOR",
          entityType: "Doctor",
          entityId: String(doctor._id),
          details: { updatedFields: parsed.data },
          timestamp: new Date(),
        });

        return { requiresConfirmation: false, result: { message: `Profile updated for Dr. ${doctor.doctorName}`, doctor } };
      }

      // 6. updateHospitalContent
      case "updateHospitalContent": {
        const parsed = updateHospitalContentArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Only hospital administrators can update hospital content");
        }

        const org = await Organization.findById(user.organizationId);
        if (!org) throw new Error("Organization not found");

        if (parsed.data.about !== undefined) org.about = parsed.data.about;
        await org.save();

        await AuditLog.create({
          userId: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
          userRole: user.role as any,
          action: "AI_ASSISTANT_UPDATE_HOSPITAL_CONTENT",
          entityType: "Organization",
          entityId: String(org._id),
          details: { updatedFields: parsed.data },
          timestamp: new Date(),
        });

        return { requiresConfirmation: false, result: { message: `Hospital content updated for ${org.name}` } };
      }

      // 7. updateWebsiteTabTitle
      case "updateWebsiteTabTitle": {
        const parsed = updateWebsiteTabTitleArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Tab title is required");

        let website: any = null;
        if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
          website = await Website.findOne({ organizationId: new mongoose.Types.ObjectId(user.organizationId) });
        } else if (user.doctorProfileId) {
          website = await Website.findOne({ doctorId: new mongoose.Types.ObjectId(user.doctorProfileId) });
        }

        if (!website) throw new Error("Website not found for current tenant");

        website.seoMetadata = {
          ...website.seoMetadata,
          title: parsed.data.tabTitle,
        };
        await website.save();

        return { requiresConfirmation: false, result: { message: `Website tab title updated to: "${parsed.data.tabTitle}"` } };
      }

      // 8. updateHospitalBranding
      case "updateHospitalBranding": {
        const parsed = updateHospitalBrandingArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid branding arguments");

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Hospital branding requires hospital administrator role");
        }

        const org = await Organization.findById(user.organizationId);
        if (!org) throw new Error("Organization not found");

        if (parsed.data.selectedTheme) org.selectedTheme = parsed.data.selectedTheme;
        if (parsed.data.faviconUrl) org.faviconUrl = parsed.data.faviconUrl;
        await org.save();

        return { requiresConfirmation: false, result: { message: `Branding updated for ${org.name}` } };
      }

      // 9. createDoctor
      case "createDoctor": {
        const parsed = createDoctorArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Only hospital administrators can register new doctors");
        }

        const orgId = user.organizationId;
        if (!orgId) throw new Error("Organization context is missing");

        const slug = parsed.data.doctorName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const newDoctor = await Doctor.create({
          organizationId: new mongoose.Types.ObjectId(orgId),
          doctorName: parsed.data.doctorName,
          slug: `dr-${slug}`,
          degree: parsed.data.degree,
          specialization: parsed.data.specialization,
          yearsOfExperience: parsed.data.yearsOfExperience,
          email: parsed.data.email,
          gender: "OTHER",
          appointmentRequired: true,
          status: "ACTIVE",
        });

        await AuditLog.create({
          userId: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
          userRole: user.role as any,
          action: "AI_ASSISTANT_CREATE_DOCTOR",
          entityType: "Doctor",
          entityId: String(newDoctor._id),
          details: { doctorName: newDoctor.doctorName, specialization: newDoctor.specialization },
          timestamp: new Date(),
        });

        return { requiresConfirmation: false, result: { message: `Doctor Dr. ${newDoctor.doctorName} successfully created and added to roster`, doctorId: newDoctor._id } };
      }

      // 10. deactivateDoctor (DESTRUCTIVE ACTION: Explicit Confirmation Required)
      case "deactivateDoctor": {
        const parsed = deactivateDoctorArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Doctor ID is required");

        const doctor = await Doctor.findById(parsed.data.doctorId);
        if (!doctor) throw new Error("Doctor not found");

        // Role & Tenant check
        const isOrgAdmin =
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          doctor.organizationId &&
          doctor.organizationId.toString() === user.organizationId.toString();
        const isSuper = user.role === UserRole.SUPERADMIN;

        if (!isOrgAdmin && !isSuper) {
          throw new Error("Forbidden: You do not have permission to deactivate this doctor");
        }

        // DESTRUCTIVE ACTION SAFEGUARD: Require explicit confirmation
        if (!isConfirmed) {
          const actionId = new mongoose.Types.ObjectId().toString();
          const prompt = `Are you sure you want to deactivate doctor "Dr. ${doctor.doctorName}"?`;

          return {
            requiresConfirmation: true,
            confirmationPrompt: prompt,
            pendingAction: {
              actionId,
              actionType: "deactivateDoctor",
              toolName: "deactivateDoctor",
              args: { doctorId: String(doctor._id) },
              prompt,
              targetDescription: `Dr. ${doctor.doctorName}`,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            },
            result: {
              doctorStatus: doctor.status,
            },
          };
        }

        // Confirmed execution
        doctor.status = "INACTIVE";
        await doctor.save();

        await AuditLog.create({
          userId: toObjectIdSafe(user.userId),
          userRole: user.role as any,
          action: "CHATBOT_DEACTIVATE_DOCTOR",
          entityType: "Doctor",
          organizationId: toObjectIdSafe(user.organizationId),
          entityId: String(doctor._id),
          details: { doctorName: doctor.doctorName },
          timestamp: new Date(),
        });

        return {
          requiresConfirmation: false,
          result: {
            message: `Dr. ${doctor.doctorName} was deactivated successfully.`,
            status: "INACTIVE",
            doctorStatus: "INACTIVE",
          },
        };
      }

      default:
        throw new Error(`Unrecognized administrative tool: "${toolName}"`);
    }
  }

  /**
   * Processes a turn for the Authenticated Admin AI Assistant
   */
  public async handleAdminMessage(params: {
    user: AuthUserPayload;
    sessionId?: string;
    message: string;
    confirmActionId?: string;
  }): Promise<{
    response: string;
    sessionId: string;
    pendingConfirmation?: IPendingAction | null;
  }> {
    const { user, message, confirmActionId } = params;
    const sessionId = params.sessionId || new mongoose.Types.ObjectId().toString();

    let conversation = await ChatbotConversation.findOne({
      sessionId,
      conversationType: "ADMIN",
    });

    if (!conversation) {
      conversation = await ChatbotConversation.create({
        conversationType: "ADMIN",
        sessionId,
        userId: toObjectIdSafe(user.userId),
        organizationId: toObjectIdSafe(user.organizationId),
        doctorId: toObjectIdSafe(user.doctorProfileId),
        messages: [],
      });
    }

    // 1. Check for Pending Confirmation Resolution
    if (confirmActionId && conversation.pendingAction) {
      if (conversation.pendingAction.actionId === confirmActionId) {
        if (new Date() > conversation.pendingAction.expiresAt) {
          conversation.pendingAction = null;
          await conversation.save();
          return {
            response: "Confirmation request expired. Please re-trigger the action if still required.",
            sessionId,
            pendingConfirmation: null,
          };
        }

        // Execute confirmed tool
        const toolRes = await this.executeTool(
          conversation.pendingAction.toolName,
          conversation.pendingAction.args,
          user,
          true
        );

        conversation.pendingAction = null;
        const confirmReply = toolRes.result?.message || "Action confirmed and executed successfully.";

        conversation.messages.push({
          role: "user",
          content: message || "Confirmed.",
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "assistant",
          content: confirmReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: confirmReply,
          sessionId,
          pendingConfirmation: null,
        };
      }
    }

    // Check if user is responding "confirm" or "cancel" in natural text to an existing pending action
    if (conversation.pendingAction) {
      const lower = message.trim().toLowerCase();
      if (lower === "confirm" || lower === "yes" || lower.startsWith("yes, ")) {
        const toolRes = await this.executeTool(
          conversation.pendingAction.toolName,
          conversation.pendingAction.args,
          user,
          true
        );

        conversation.pendingAction = null;
        const confirmReply = toolRes.result?.message || "Action confirmed and executed successfully.";

        conversation.messages.push({
          role: "user",
          content: message,
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "assistant",
          content: confirmReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: confirmReply,
          sessionId,
          pendingConfirmation: null,
        };
      }

      if (lower === "cancel" || lower === "no" || lower.startsWith("no, ")) {
        conversation.pendingAction = null;
        const cancelReply = "Action cancelled. No changes were made.";

        conversation.messages.push({
          role: "user",
          content: message,
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "assistant",
          content: cancelReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: cancelReply,
          sessionId,
          pendingConfirmation: null,
        };
      }
    }

    // 2. Call Gemini with Tool Declarations
    const client = this.getClient();
    const systemInstruction = `
You are an expert administrative AI assistant for the Doczeno healthcare management platform.
You are helping an authenticated user with role: ${user.role}.
Organization ID: ${user.organizationId || "None"}
Doctor Profile ID: ${user.doctorProfileId || "None"}

CRITICAL OPERATIONAL RULES:
1. Always stay strictly within the authenticated user's organization and permissions.
2. If the user asks to query or perform actions (e.g. view doctors, get appointments, update bios, deactivate a doctor), invoke the corresponding tool function.
3. For destructive actions like deactivating a doctor, invoke the deactivateDoctor tool so the system can ask for confirmation.
4. Never reveal raw database structures or make assumptions beyond tool results.
5. If a request is outside the administrator's role or organization, decline politely.
`.trim();

    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    try {
      const geminiResponse = await client.models.generateContent({
        model: this.model,
        contents: message,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: ADMIN_ASSISTANT_TOOL_DECLARATIONS as any }],
        },
      });

      // Check if Gemini invoked a tool call
      const functionCalls = geminiResponse.functionCalls;

      if (functionCalls && functionCalls.length > 0 && functionCalls[0]?.name) {
        const fc = functionCalls[0];
        const toolName = fc.name!;
        const toolArgs = (fc.args as Record<string, any>) || {};

        const toolExecution = await this.executeTool(toolName, toolArgs, user, false);

        if (toolExecution.requiresConfirmation && toolExecution.pendingAction) {
          conversation.pendingAction = toolExecution.pendingAction;
          await conversation.save();

          const prompt = toolExecution.confirmationPrompt || "This action requires confirmation. Confirm?";
          conversation.messages.push({
            role: "assistant",
            content: prompt,
            timestamp: new Date(),
          });
          await conversation.save();

          return {
            response: prompt,
            sessionId,
            pendingConfirmation: toolExecution.pendingAction,
          };
        }

        // Tool ran immediately; provide result summary to user
        const resultString = JSON.stringify(toolExecution.result, null, 2);
        const followUp = await client.models.generateContent({
          model: this.model,
          contents: `Tool ${toolName} returned result:\n${resultString}\n\nSummarize this cleanly and professionally for the administrator in response to: "${message}".`,
          config: { systemInstruction },
        });

        const finalReply = followUp.text?.trim() || `Tool ${toolName} executed successfully.`;

        conversation.messages.push({
          role: "assistant",
          content: finalReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: finalReply,
          sessionId,
          pendingConfirmation: null,
        };
      }

      // Plain text conversational answer from assistant
      const plainReply = geminiResponse.text?.trim() || "How can I assist you with practice administration today?";

      conversation.messages.push({
        role: "assistant",
        content: plainReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: plainReply,
        sessionId,
        pendingConfirmation: null,
      };
    } catch (err: any) {
      const errorReply = `Error processing assistant request: ${err?.message || "Operation failed"}`;
      conversation.messages.push({
        role: "assistant",
        content: errorReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: errorReply,
        sessionId,
        pendingConfirmation: null,
      };
    }
  }
}

export const adminAssistantService = new AdminAssistantService();
