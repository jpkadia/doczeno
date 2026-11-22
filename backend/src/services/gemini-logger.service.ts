import mongoose from "mongoose";
import {
  GeminiApiLog,
  GeminiFeature,
  GeminiCallStatus,
} from "@/models";

export interface LogGeminiCallParams {
  feature: GeminiFeature;
  model: string;
  status: GeminiCallStatus;
  statusCode?: number;
  latencyMs: number;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  organizationId?: string | mongoose.Types.ObjectId | null;
  doctorId?: string | mongoose.Types.ObjectId | null;
  userId?: string | mongoose.Types.ObjectId | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, any>;
}

export interface GeminiAnalyticsFilters {
  range?: "24h" | "7d" | "30d" | "all";
  feature?: string;
  model?: string;
  status?: string;
  organizationId?: string;
  doctorId?: string;
}

export interface GeminiLogsFilters {
  page?: number;
  limit?: number;
  feature?: string;
  status?: string;
  model?: string;
  errorCode?: string;
  search?: string;
  range?: "24h" | "7d" | "30d" | "all";
}

export class GeminiLoggerService {
  /**
   * Safe asynchronous non-blocking recorder.
   * Catches all errors internally so calling services never fail due to logging.
   */
  public static async logCall(params: LogGeminiCallParams): Promise<void> {
    try {
      const orgId =
        params.organizationId && mongoose.Types.ObjectId.isValid(String(params.organizationId))
          ? new mongoose.Types.ObjectId(String(params.organizationId))
          : null;

      const docId =
        params.doctorId && mongoose.Types.ObjectId.isValid(String(params.doctorId))
          ? new mongoose.Types.ObjectId(String(params.doctorId))
          : null;

      const usrId =
        params.userId && mongoose.Types.ObjectId.isValid(String(params.userId))
          ? new mongoose.Types.ObjectId(String(params.userId))
          : null;

      const promptTokens = Math.max(0, Number(params.promptTokens) || 0);
      const candidatesTokens = Math.max(0, Number(params.candidatesTokens) || 0);
      const totalTokens =
        params.totalTokens !== undefined && params.totalTokens !== null
          ? Math.max(0, Number(params.totalTokens))
          : promptTokens + candidatesTokens;

      await GeminiApiLog.create({
        feature: params.feature,
        model: params.model || "gemini-3.5-flash-lite",
        status: params.status,
        statusCode: params.statusCode || (params.status === "SUCCESS" ? 200 : 500),
        latencyMs: Math.max(0, Math.round(params.latencyMs || 0)),
        promptTokens,
        candidatesTokens,
        totalTokens,
        organizationId: orgId,
        doctorId: docId,
        userId: usrId,
        errorMessage: params.errorMessage || null,
        errorCode: params.errorCode || null,
        metadata: params.metadata || null,
      });
    } catch (err) {
      // Non-blocking fire-and-forget fallback
      console.warn("[GeminiLoggerService] Warning: Failed to record Gemini log entry:", err);
    }
  }

  /**
   * Helper to parse error code and status code from unknown Gemini errors
   */
  public static parseError(err: any): { statusCode: number; errorCode: string; errorMessage: string } {
    const rawMsg = String(err?.message || err || "Unknown Gemini API error");
    const status = Number(err?.status || err?.statusCode || 500);

    let errorCode = "UNKNOWN_ERROR";
    if (status === 429 || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("429")) {
      errorCode = "RATE_LIMIT_429";
    } else if (status === 503 || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("503")) {
      errorCode = "UNAVAILABLE_503";
    } else if (status === 400 || rawMsg.includes("INVALID_ARGUMENT") || rawMsg.includes("400")) {
      errorCode = "INVALID_ARGUMENT_400";
    } else if (status === 401 || status === 403 || rawMsg.includes("PERMISSION_DENIED")) {
      errorCode = "AUTH_PERMISSION_ERROR";
    } else if (status === 500 || rawMsg.includes("INTERNAL")) {
      errorCode = "INTERNAL_SERVER_ERROR_500";
    } else if (rawMsg.includes("fetch failed") || rawMsg.includes("ECONNRESET") || rawMsg.includes("ETIMEDOUT")) {
      errorCode = "NETWORK_TIMEOUT_ERROR";
    } else if (rawMsg.includes("Empty response")) {
      errorCode = "EMPTY_MODEL_RESPONSE";
    }

    return {
      statusCode: isNaN(status) || status < 100 || status > 599 ? 500 : status,
      errorCode,
      errorMessage: rawMsg.slice(0, 500),
    };
  }

  /**
   * Aggregates metrics and diagnostics for Superadmin Analytics Dashboard
   */
  public static async getAnalytics(filters: GeminiAnalyticsFilters = {}) {
    const matchQuery: Record<string, any> = {};

    // Date range filter
    const now = Date.now();
    let startDate: Date | null = null;
    const range = filters.range || "7d";

    if (range === "24h") {
      startDate = new Date(now - 24 * 60 * 60 * 1000);
    } else if (range === "7d") {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    if (startDate) {
      matchQuery.createdAt = { $gte: startDate };
    }

    if (filters.feature && filters.feature !== "ALL") {
      matchQuery.feature = filters.feature;
    }
    if (filters.model && filters.model !== "ALL") {
      matchQuery.model = filters.model;
    }
    if (filters.status && filters.status !== "ALL") {
      matchQuery.status = filters.status;
    }
    if (filters.organizationId) {
      matchQuery.organizationId = new mongoose.Types.ObjectId(filters.organizationId);
    }
    if (filters.doctorId) {
      matchQuery.doctorId = new mongoose.Types.ObjectId(filters.doctorId);
    }

    const dateFormat = range === "24h" ? "%Y-%m-%d %H:00" : "%Y-%m-%d";

    // 1. Summary KPIs
    const summaryAgg = await GeminiApiLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failedRequests: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          avgLatencyMs: { $avg: "$latencyMs" },
          totalPromptTokens: { $sum: "$promptTokens" },
          totalCandidatesTokens: { $sum: "$candidatesTokens" },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatencyMs: 0,
      totalPromptTokens: 0,
      totalCandidatesTokens: 0,
      totalTokens: 0,
    };

    const successRate =
      summary.totalRequests > 0
        ? Number(((summary.successfulRequests / summary.totalRequests) * 100).toFixed(1))
        : 100;

    // Flash pricing: $0.075 / 1M prompt tokens, $0.30 / 1M candidates tokens
    const estimatedCostUsd = Number(
      (
        ((summary.totalPromptTokens || 0) * 0.000000075) +
        ((summary.totalCandidatesTokens || 0) * 0.0000003)
      ).toFixed(4)
    );

    // 2. Timeline chart data
    const timeline = await GeminiApiLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          },
          total: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          avgLatency: { $avg: "$latencyMs" },
          tokens: { $sum: "$totalTokens" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 3. Breakdown by Feature
    const byFeature = await GeminiApiLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$feature",
          total: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          avgLatency: { $avg: "$latencyMs" },
          tokens: { $sum: "$totalTokens" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // 4. Breakdown by Model
    const byModel = await GeminiApiLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$model",
          total: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          avgLatency: { $avg: "$latencyMs" },
          tokens: { $sum: "$totalTokens" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // 5. Diagnostics - Error breakdown
    const errorBreakdown = await GeminiApiLog.aggregate([
      {
        $match: {
          ...matchQuery,
          status: "FAILED",
        },
      },
      {
        $group: {
          _id: "$errorCode",
          count: { $sum: 1 },
          sampleMessage: { $first: "$errorMessage" },
          lastOccurred: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // 6. Top consuming organizations/hospitals
    const topOrganizations = await GeminiApiLog.aggregate([
      {
        $match: {
          ...matchQuery,
          organizationId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$organizationId",
          totalCalls: { $sum: 1 },
          failedCalls: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
      { $sort: { totalCalls: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "organizations",
          localField: "_id",
          foreignField: "_id",
          as: "org",
        },
      },
      { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ["$org.name", "Unknown Hospital"] },
          slug: "$org.slug",
          totalCalls: 1,
          failedCalls: 1,
          totalTokens: 1,
        },
      },
    ]);

    // 7. Top consuming doctors
    const topDoctors = await GeminiApiLog.aggregate([
      {
        $match: {
          ...matchQuery,
          doctorId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$doctorId",
          totalCalls: { $sum: 1 },
          failedCalls: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
      { $sort: { totalCalls: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ["$doctor.doctorName", "Unknown Doctor"] },
          slug: "$doctor.slug",
          specialization: "$doctor.specialization",
          totalCalls: 1,
          failedCalls: 1,
          totalTokens: 1,
        },
      },
    ]);

    return {
      summary: {
        totalRequests: summary.totalRequests,
        successfulRequests: summary.successfulRequests,
        failedRequests: summary.failedRequests,
        successRate,
        avgLatencyMs: Math.round(summary.avgLatencyMs || 0),
        totalPromptTokens: summary.totalPromptTokens,
        totalCandidatesTokens: summary.totalCandidatesTokens,
        totalTokens: summary.totalTokens,
        estimatedCostUsd,
      },
      timeline: timeline.map((item) => ({
        timestamp: item._id,
        total: item.total,
        success: item.success,
        failed: item.failed,
        avgLatency: Math.round(item.avgLatency || 0),
        tokens: item.tokens,
      })),
      byFeature: byFeature.map((item) => ({
        feature: item._id || "OTHER",
        total: item.total,
        success: item.success,
        failed: item.failed,
        avgLatency: Math.round(item.avgLatency || 0),
        tokens: item.tokens,
      })),
      byModel: byModel.map((item) => ({
        model: item._id,
        total: item.total,
        success: item.success,
        failed: item.failed,
        avgLatency: Math.round(item.avgLatency || 0),
        tokens: item.tokens,
      })),
      errorBreakdown: errorBreakdown.map((item) => ({
        errorCode: item._id || "UNKNOWN_ERROR",
        count: item.count,
        sampleMessage: item.sampleMessage,
        lastOccurred: item.lastOccurred,
      })),
      topTenants: {
        organizations: topOrganizations,
        doctors: topDoctors,
      },
    };
  }

  /**
   * Search, filter, and paginate live Gemini API Logs
   */
  public static async getLogs(filters: GeminiLogsFilters = {}) {
    const query: Record<string, any> = {};

    // Date range filter
    const now = Date.now();
    let startDate: Date | null = null;
    const range = filters.range || "7d";

    if (range === "24h") {
      startDate = new Date(now - 24 * 60 * 60 * 1000);
    } else if (range === "7d") {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    if (startDate) {
      query.createdAt = { $gte: startDate };
    }

    if (filters.feature && filters.feature !== "ALL") {
      query.feature = filters.feature;
    }
    if (filters.status && filters.status !== "ALL") {
      query.status = filters.status;
    }
    if (filters.model && filters.model !== "ALL") {
      query.model = filters.model;
    }
    if (filters.errorCode && filters.errorCode !== "ALL") {
      query.errorCode = filters.errorCode;
    }
    if (filters.search) {
      const searchRegex = { $regex: filters.search, $options: "i" };
      query.$or = [
        { model: searchRegex },
        { errorCode: searchRegex },
        { errorMessage: searchRegex },
      ];
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      GeminiApiLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("organizationId", "name slug")
        .populate("doctorId", "doctorName slug")
        .populate("userId", "name email role")
        .lean(),
      GeminiApiLog.countDocuments(query),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
