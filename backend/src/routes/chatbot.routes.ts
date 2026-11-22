import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/middleware/auth";
import {
  publicChatbotRateLimiter,
  adminAssistantRateLimiter,
} from "@/middleware/chatbot-rate-limit";
import { publicChatbotService } from "@/services/public-chatbot.service";
import { adminAssistantService } from "@/services/admin-assistant.service";
import { ragKnowledgeService } from "@/services/rag-knowledge.service";
import mongoose from "mongoose";
import { ChatbotConversation, Doctor } from "@/models";
import { UserRole } from "@/types";

export const chatbotRouter = Router();

const publicMessageSchema = z.object({
  slug: z.string().min(1, "Website slug is required"),
  doctorSlug: z.string().optional(),
  sessionId: z.string().min(1, "Session ID is required"),
  message: z.string().min(1, "Message is required").max(500, "Message cannot exceed 500 characters"),
});

const adminMessageSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1, "Message is required").max(1000, "Message cannot exceed 1000 characters"),
  confirmActionId: z.string().optional(),
});

/**
 * POST /api/v1/chatbot/public/message
 * Handles public website visitor chat queries with strict tenant RAG pre-filtering
 */
chatbotRouter.post(
  "/public/message",
  publicChatbotRateLimiter,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = publicMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: parsed.error.issues.map((i) => i.message).join(", "),
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { slug, doctorSlug, sessionId, message } = parsed.data;
      const result = await publicChatbotService.handlePublicMessage({
        slug,
        doctorSlug,
        sessionId,
        message,
      });

      res.status(200).json({
        success: true,
        ...result,
        data: result,
      });
    } catch (err: any) {
      const status = err?.status || 500;
      res.status(status).json({
        success: false,
        message: err?.message || "Failed to process chat message",
        error: err?.message || "Failed to process chat message",
        code: "CHATBOT_ERROR",
      });
    }
  }
);

/**
 * GET /api/v1/chatbot/public/history/:sessionId
 * Retrieves previous turns for a public visitor session
 */
chatbotRouter.get(
  "/public/history/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const conversation = await ChatbotConversation.findOne({
        sessionId,
        conversationType: "PUBLIC",
      })
        .select("messages createdAt updatedAt")
        .lean();

      res.status(200).json({
        success: true,
        data: conversation || { messages: [] },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/chatbot/admin/message
 * Authenticated AI assistant with controlled backend tools and destructive confirmation flow
 */
chatbotRouter.post(
  "/admin/message",
  requireAuthenticatedUser,
  adminAssistantRateLimiter,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = adminMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { sessionId, message, confirmActionId } = parsed.data;
      const result = await adminAssistantService.handleAdminMessage({
        user: req.user!,
        sessionId,
        message,
        confirmActionId,
      });

      res.status(200).json({
        success: true,
        ...result,
        data: result,
      });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        success: false,
        message: err?.message || "Failed to process admin assistant query",
        error: err?.message || "Failed to process admin assistant query",
        code: "ADMIN_ASSISTANT_ERROR",
      });
    }
  }
);

/**
 * GET /api/v1/chatbot/admin/history/:sessionId
 * Retrieves past conversation turns for the authenticated administrator
 */
chatbotRouter.get(
  "/admin/history/:sessionId",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const conversation = await ChatbotConversation.findOne({
        sessionId,
        conversationType: "ADMIN",
      })
        .select("messages pendingAction createdAt updatedAt")
        .lean();

      res.status(200).json({
        success: true,
        data: conversation || { messages: [] },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/chatbot/sync-knowledge
 * Triggers RAG knowledge chunk re-indexing for an entity
 */
chatbotRouter.post(
  "/sync-knowledge",
  requireAuthenticatedUser,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { targetType, targetId } = req.body;
      if (!targetType || !targetId) {
        res.status(400).json({
          success: false,
          error: "targetType and targetId are required",
          code: "BAD_REQUEST",
        });
        return;
      }

      let count = 0;
      if (targetType === "ONLY_DOCTOR" || targetType === "HOSPITAL_DOCTOR") {
        count = await ragKnowledgeService.syncOnlyDoctorKnowledge(targetId);
      } else if (targetType === "HOSPITAL") {
        count = await ragKnowledgeService.syncHospitalKnowledge(targetId);
      }

      res.status(200).json({
        success: true,
        message: `Synchronized ${count} knowledge chunks into RAG index`,
        data: { chunksIndexed: count },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to synchronize knowledge chunks",
        code: "KNOWLEDGE_SYNC_ERROR",
      });
    }
  }
);

/**
 * Helper to check if the authenticated user has permission to view/delete a conversation
 */
async function canUserAccessConversation(
  user: any,
  conv: any
): Promise<boolean> {
  if (user.role === UserRole.SUPERADMIN) return true;

  if (user.role === UserRole.ONLY_DOCTOR) {
    if (!user.doctorProfileId || !conv.doctorId) return false;
    const docIdStr = conv.doctorId._id ? conv.doctorId._id.toString() : conv.doctorId.toString();
    if (docIdStr !== user.doctorProfileId.toString()) return false;
    // Strictly independent Only Doctor - must never be an organization conversation
    if (conv.organizationId) return false;
    return true;
  }

  if (user.role === UserRole.HOSPITAL_DOCTOR) {
    if (!user.doctorProfileId || !conv.doctorId) return false;
    const docIdStr = conv.doctorId._id ? conv.doctorId._id.toString() : conv.doctorId.toString();
    if (docIdStr !== user.doctorProfileId.toString()) return false;
    if (user.organizationId && conv.organizationId) {
      const convOrgIdStr = conv.organizationId._id ? conv.organizationId._id.toString() : conv.organizationId.toString();
      if (convOrgIdStr !== user.organizationId.toString()) return false;
    }
    return true;
  }

  if (user.role === UserRole.HOSPITAL_ADMIN) {
    if (!user.organizationId) return false;
    const orgIdStr = user.organizationId.toString();

    if (conv.organizationId) {
      const convOrgIdStr = conv.organizationId._id ? conv.organizationId._id.toString() : conv.organizationId.toString();
      if (convOrgIdStr === orgIdStr) return true;
    }

    if (conv.doctorId) {
      const convDocId = conv.doctorId._id ? conv.doctorId._id : conv.doctorId;
      const doc = await Doctor.findOne({ _id: convDocId, organizationId: user.organizationId });
      return Boolean(doc);
    }
  }

  return false;
}

/**
 * GET /api/v1/chatbot/conversations
 * Paginated and tenant-filtered AI conversation list for Admin Panels
 */
chatbotRouter.get(
  "/conversations",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const skip = (page - 1) * limit;
      const conversationType = (req.query.conversationType as string) || "PUBLIC";
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

      let baseFilter: any = { conversationType };

      if (user.role === UserRole.SUPERADMIN) {
        if (req.query.doctorId && mongoose.isValidObjectId(req.query.doctorId)) {
          baseFilter.doctorId = new mongoose.Types.ObjectId(req.query.doctorId as string);
        }
        if (req.query.organizationId && mongoose.isValidObjectId(req.query.organizationId)) {
          baseFilter.organizationId = new mongoose.Types.ObjectId(req.query.organizationId as string);
        }
      } else if (user.role === UserRole.ONLY_DOCTOR) {
        if (!user.doctorProfileId) {
          res.status(200).json({
            success: true,
            data: {
              conversations: [],
              pagination: { total: 0, page, limit, totalPages: 0 },
            },
          });
          return;
        }
        baseFilter.doctorId = new mongoose.Types.ObjectId(user.doctorProfileId);
        baseFilter.$or = [{ organizationId: null }, { organizationId: { $exists: false } }];
      } else if (user.role === UserRole.HOSPITAL_DOCTOR) {
        if (!user.doctorProfileId) {
          res.status(200).json({
            success: true,
            data: {
              conversations: [],
              pagination: { total: 0, page, limit, totalPages: 0 },
            },
          });
          return;
        }
        baseFilter.doctorId = new mongoose.Types.ObjectId(user.doctorProfileId);
        if (user.organizationId) {
          baseFilter.organizationId = new mongoose.Types.ObjectId(user.organizationId);
        }
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId) {
          res.status(200).json({
            success: true,
            data: {
              conversations: [],
              pagination: { total: 0, page, limit, totalPages: 0 },
            },
          });
          return;
        }

        const orgId = new mongoose.Types.ObjectId(user.organizationId);
        const hospitalDocs = await Doctor.find({ organizationId: orgId }).select("_id").lean();
        const docIds = hospitalDocs.map((d) => d._id);

        if (req.query.doctorId && mongoose.isValidObjectId(req.query.doctorId)) {
          const targetDocId = new mongoose.Types.ObjectId(req.query.doctorId as string);
          const belongs = docIds.some((id) => id.toString() === targetDocId.toString());
          if (!belongs) {
            res.status(403).json({
              success: false,
              error: "Forbidden: You cannot access chats of a doctor outside your hospital",
              code: "FORBIDDEN",
            });
            return;
          }
          baseFilter.doctorId = targetDocId;
        } else {
          baseFilter.$or = [
            { organizationId: orgId },
            { doctorId: { $in: docIds } },
          ];
        }
      }

      if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const searchConditions = [
          { "appointmentDraft.patientName": searchRegex },
          { "appointmentDraft.patientPhone": searchRegex },
          { "appointmentDraft.notes": searchRegex },
          { "messages.content": searchRegex },
        ];
        if (baseFilter.$or) {
          baseFilter.$and = [
            { $or: baseFilter.$or },
            { $or: searchConditions },
          ];
          delete baseFilter.$or;
        } else {
          baseFilter.$or = searchConditions;
        }
      }

      const [total, conversations] = await Promise.all([
        ChatbotConversation.countDocuments(baseFilter),
        ChatbotConversation.find(baseFilter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("doctorId", "doctorName specialization slug")
          .populate("organizationId", "name slug")
          .lean(),
      ]);

      const formatted = conversations.map((conv: any) => {
        const doc = conv.doctorId as any;
        const org = conv.organizationId as any;
        const lastMsg = conv.messages && conv.messages.length > 0
          ? conv.messages[conv.messages.length - 1]
          : null;

        return {
          id: conv._id.toString(),
          sessionId: conv.sessionId,
          conversationType: conv.conversationType,
          patientName: conv.appointmentDraft?.patientName || "Anonymous Visitor",
          patientPhone: conv.appointmentDraft?.patientPhone || "",
          problem: conv.appointmentDraft?.notes || "",
          bookingStatus: conv.appointmentDraft?.step || "INQUIRY",
          appointmentDate: conv.appointmentDraft?.appointmentDate || "",
          timeSlot: conv.appointmentDraft?.timeSlot || "",
          doctorName: doc?.doctorName ? `Dr. ${doc.doctorName}` : (conv.appointmentDraft?.doctorName || ""),
          doctorSpecialization: doc?.specialization || "",
          doctorId: doc?._id?.toString() || (conv.doctorId ? conv.doctorId.toString() : ""),
          hospitalName: org?.name || "",
          messageCount: conv.messages?.length || 0,
          lastMessage: lastMsg?.content ? lastMsg.content.slice(0, 120) : "",
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          conversations: formatted,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/chatbot/conversations/:id
 * Retrieves a full conversation transcript with messages and appointment draft
 */
chatbotRouter.get(
  "/conversations/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({
          success: false,
          error: "Invalid conversation ID",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const conv = await ChatbotConversation.findById(id)
        .populate("doctorId", "doctorName specialization slug")
        .populate("organizationId", "name slug")
        .lean();

      if (!conv) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
          code: "NOT_FOUND",
        });
        return;
      }

      const hasAccess = await canUserAccessConversation(req.user!, conv);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: "Forbidden: You do not have access to this conversation",
          code: "FORBIDDEN",
        });
        return;
      }

      const doc = conv.doctorId as any;
      const org = conv.organizationId as any;

      res.status(200).json({
        success: true,
        data: {
          id: conv._id.toString(),
          sessionId: conv.sessionId,
          conversationType: conv.conversationType,
          patientName: conv.appointmentDraft?.patientName || "Anonymous Visitor",
          patientPhone: conv.appointmentDraft?.patientPhone || "",
          patientEmail: conv.appointmentDraft?.patientEmail || "",
          problem: conv.appointmentDraft?.notes || "",
          bookingStatus: conv.appointmentDraft?.step || "INQUIRY",
          appointmentDate: conv.appointmentDraft?.appointmentDate || "",
          timeSlot: conv.appointmentDraft?.timeSlot || "",
          doctorName: doc?.doctorName ? `Dr. ${doc.doctorName}` : (conv.appointmentDraft?.doctorName || ""),
          doctorSpecialization: doc?.specialization || "",
          doctorId: doc?._id?.toString() || (conv.doctorId ? conv.doctorId.toString() : ""),
          hospitalName: org?.name || "",
          messages: conv.messages || [],
          appointmentDraft: conv.appointmentDraft || null,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/chatbot/conversations/:id
 * Permanently deletes a conversation from MongoDB
 */
chatbotRouter.delete(
  "/conversations/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({
          success: false,
          error: "Invalid conversation ID",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const conv = await ChatbotConversation.findById(id);
      if (!conv) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
          code: "NOT_FOUND",
        });
        return;
      }

      const hasAccess = await canUserAccessConversation(req.user!, conv);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: "Forbidden: You do not have permission to delete this conversation",
          code: "FORBIDDEN",
        });
        return;
      }

      await ChatbotConversation.deleteOne({ _id: conv._id });

      res.status(200).json({
        success: true,
        message: "Conversation permanently deleted from database",
        data: { id: conv._id.toString() },
      });
    } catch (err) {
      next(err);
    }
  }
);
