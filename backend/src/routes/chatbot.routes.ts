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
import { ChatbotConversation } from "@/models";

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
      if (targetType === "INDEPENDENT_DOCTOR" || targetType === "HOSPITAL_DOCTOR") {
        count = await ragKnowledgeService.syncIndependentDoctorKnowledge(targetId);
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
