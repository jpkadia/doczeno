"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Cpu,
  Database,
  DollarSign,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Zap,
  Building2,
  Stethoscope,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, ApiError } from "@/lib/api-client";

interface GeminiSummaryKPIs {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgLatencyMs: number;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface GeminiTimelinePoint {
  timestamp: string;
  total: number;
  success: number;
  failed: number;
  avgLatency: number;
  tokens: number;
}

interface GeminiFeatureStat {
  feature: string;
  total: number;
  success: number;
  failed: number;
  avgLatency: number;
  tokens: number;
}

interface GeminiModelStat {
  model: string;
  total: number;
  success: number;
  failed: number;
  avgLatency: number;
  tokens: number;
}

interface GeminiErrorStat {
  errorCode: string;
  count: number;
  sampleMessage?: string;
  lastOccurred?: string;
}

interface GeminiTopTenantOrg {
  _id: string;
  name: string;
  slug?: string;
  totalCalls: number;
  failedCalls: number;
  totalTokens: number;
}

interface GeminiTopTenantDoctor {
  _id: string;
  name: string;
  slug?: string;
  specialization?: string;
  totalCalls: number;
  failedCalls: number;
  totalTokens: number;
}

interface GeminiAnalyticsData {
  summary: GeminiSummaryKPIs;
  timeline: GeminiTimelinePoint[];
  byFeature: GeminiFeatureStat[];
  byModel: GeminiModelStat[];
  errorBreakdown: GeminiErrorStat[];
  topTenants: {
    organizations: GeminiTopTenantOrg[];
    doctors: GeminiTopTenantDoctor[];
  };
}

interface GeminiApiLogItem {
  _id: string;
  feature: string;
  model: string;
  status: "SUCCESS" | "FAILED";
  statusCode: number;
  latencyMs: number;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  organizationId?: { _id: string; name: string; slug: string } | null;
  doctorId?: { _id: string; doctorName: string; slug: string } | null;
  userId?: { _id: string; name: string; email: string; role: string } | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface GeminiLogsResponse {
  logs: GeminiApiLogItem[];
  total: number;
  page: number;
  totalPages: number;
}

const FEATURE_LABELS: Record<string, { label: string; color: string }> = {
  PUBLIC_CHATBOT: { label: "Public Chatbot", color: "bg-blue-50 text-blue-700 border-blue-200" },
  CLINICAL_TRIAGE: { label: "Clinical Triage", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ADMIN_ASSISTANT: { label: "Admin Assistant", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  AI_CONTENT_GEN: { label: "AI Copywriter", color: "bg-purple-50 text-purple-700 border-purple-200" },
  OTHER: { label: "General System", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

function getFeatureMeta(feature?: string): { label: string; color: string } {
  if (feature && feature in FEATURE_LABELS) {
    return FEATURE_LABELS[feature]!;
  }
  return { label: feature || "General System", color: "bg-slate-50 text-slate-700 border-slate-200" };
}

export function GeminiAnalyticsView() {
  const [range, setRange] = React.useState<"24h" | "7d" | "30d" | "all">("7d");
  const [featureFilter, setFeatureFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [page, setPage] = React.useState<number>(1);
  const [autoRefresh, setAutoRefresh] = React.useState<boolean>(false);

  // Data states
  const [analytics, setAnalytics] = React.useState<GeminiAnalyticsData | null>(null);
  const [logsData, setLogsData] = React.useState<GeminiLogsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = React.useState<boolean>(true);
  const [isLoadingLogs, setIsLoadingLogs] = React.useState<boolean>(true);
  const [selectedLogForDetails, setSelectedLogForDetails] = React.useState<GeminiApiLogItem | null>(null);

  // Fetch Analytics
  const fetchAnalytics = React.useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: GeminiAnalyticsData }>(
        "/superadmin/gemini-analytics",
        {
          params: {
            range,
            feature: featureFilter !== "ALL" ? featureFilter : undefined,
            status: statusFilter !== "ALL" ? statusFilter : undefined,
          },
        }
      );
      if (res && res.data) {
        setAnalytics(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        if (typeof window !== "undefined") {
          window.location.replace("/superadmin/login");
        }
        return;
      }
      console.warn("Failed to fetch Gemini analytics:", err instanceof Error ? err.message : err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [range, featureFilter, statusFilter]);

  // Fetch Logs
  const fetchLogs = React.useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: GeminiLogsResponse }>(
        "/superadmin/gemini-logs",
        {
          params: {
            page,
            limit: 15,
            range,
            feature: featureFilter !== "ALL" ? featureFilter : undefined,
            status: statusFilter !== "ALL" ? statusFilter : undefined,
            search: searchQuery.trim() || undefined,
          },
        }
      );
      if (res && res.data) {
        setLogsData(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        if (typeof window !== "undefined") {
          window.location.replace("/superadmin/login");
        }
        return;
      }
      console.warn("Failed to fetch Gemini logs:", err instanceof Error ? err.message : err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [page, range, featureFilter, statusFilter, searchQuery]);

  // Initial and reactive loads
  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval (30 seconds)
  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAnalytics();
      fetchLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAnalytics, fetchLogs]);

  // Format numbers nicely
  const formatNum = (num: number = 0) => num.toLocaleString();

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg text-white shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Gemini AI Usage & Observability
              </h2>
              <p className="text-xs text-slate-500">
                Live monitoring of Gemini API requests, success rates, latency, token consumption, and errors.
              </p>
            </div>
          </div>
        </div>

        {/* Timeframe selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time range pills */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            {(
              [
                { id: "24h", label: "24 Hours" },
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setRange(opt.id);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  range === opt.id
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Auto Refresh toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 px-2 py-1 rounded-md border border-slate-200 bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span>Auto (30s)</span>
          </label>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchAnalytics();
              fetchLogs();
            }}
            disabled={isLoadingAnalytics || isLoadingLogs}
            className="text-xs gap-1.5 bg-white"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                isLoadingAnalytics || isLoadingLogs ? "animate-spin text-sky-600" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Calls */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-slate-500">Total API Hits</CardDescription>
              <div className="p-1.5 bg-sky-50 text-sky-600 rounded-md">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {analytics ? formatNum(analytics.summary.totalRequests) : "--"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Success: <strong className="text-emerald-600 font-semibold">{analytics ? formatNum(analytics.summary.successfulRequests) : "0"}</strong>
            </span>
            <span>
              Failed: <strong className="text-rose-600 font-semibold">{analytics ? formatNum(analytics.summary.failedRequests) : "0"}</strong>
            </span>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-slate-500">Success Rate</CardDescription>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                <CheckCircle className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {analytics ? `${analytics.summary.successRate}%` : "--"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px]">
            {analytics && analytics.summary.successRate >= 98 ? (
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 font-medium">
                System Healthy
              </Badge>
            ) : analytics && analytics.summary.successRate >= 90 ? (
              <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 font-medium">
                Minor Degradation
              </Badge>
            ) : (
              <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 font-medium">
                Attention Required
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Failed Requests */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-slate-500">Failed Calls</CardDescription>
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {analytics ? formatNum(analytics.summary.failedRequests) : "--"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px]">
            {analytics && analytics.summary.failedRequests === 0 ? (
              <span className="text-emerald-600 font-medium">0 API errors in window</span>
            ) : (
              <span className="text-rose-600 font-medium">Review error diagnostics below</span>
            )}
          </CardContent>
        </Card>

        {/* Average Latency */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-slate-500">Avg API Latency</CardDescription>
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {analytics ? `${analytics.summary.avgLatencyMs} ms` : "--"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
            {analytics && analytics.summary.avgLatencyMs < 1200 ? (
              <span className="text-emerald-600 font-medium">High responsive speed</span>
            ) : (
              <span className="text-amber-600 font-medium">Standard thinking latency</span>
            )}
          </CardContent>
        </Card>

        {/* Tokens & Cost */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-slate-500">Total Tokens</CardDescription>
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {analytics ? formatNum(analytics.summary.totalTokens) : "--"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Est. Cost: <strong className="text-slate-800 font-semibold">${analytics ? analytics.summary.estimatedCostUsd.toFixed(4) : "0.00"}</strong></span>
            <span className="text-[10px] text-slate-400">Gemini Flash</span>
          </CardContent>
        </Card>
      </div>

      {/* 3. Activity Timeline Chart & Distribution Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart (2 cols) */}
        <Card className="bg-white border-slate-200 shadow-2xs lg:col-span-2">
          <CardHeader className="p-5 pb-3 border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-600" />
                  API Request Traffic & Failure Timeline
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Volume of successful requests vs failed calls across time
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-xs bg-sky-500 inline-block" /> Successful
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500 inline-block" /> Failed
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {analytics && analytics.timeline.length > 0 ? (
              <div className="space-y-4">
                {/* Visual Bar Chart */}
                <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-200 overflow-x-auto">
                  {(() => {
                    const maxCount = Math.max(
                      1,
                      ...analytics.timeline.map((t) => t.total)
                    );
                    return analytics.timeline.map((point, idx) => {
                      const successHeight = Math.round((point.success / maxCount) * 100);
                      const failHeight = Math.round((point.failed / maxCount) * 100);
                      return (
                        <div
                          key={idx}
                          className="flex-1 min-w-[36px] flex flex-col items-center group relative h-full justify-end"
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[11px] rounded p-2 shadow-lg z-20 whitespace-nowrap pointer-events-none">
                            <span className="font-semibold text-slate-200">{point.timestamp}</span>
                            <span className="text-sky-300">Success: {point.success}</span>
                            {point.failed > 0 && <span className="text-rose-300">Failed: {point.failed}</span>}
                            <span className="text-slate-400">Avg Latency: {point.avgLatency}ms</span>
                            <span className="text-slate-400">Tokens: {formatNum(point.tokens)}</span>
                          </div>

                          {/* Bars */}
                          <div className="w-full flex flex-col justify-end items-center max-w-[28px] h-full">
                            {point.failed > 0 && (
                              <div
                                style={{ height: `${failHeight}%` }}
                                className="w-full bg-rose-500 rounded-t-xs transition-all duration-300"
                              />
                            )}
                            <div
                              style={{ height: `${successHeight}%` }}
                              className={`w-full bg-sky-500 ${
                                point.failed > 0 ? "rounded-b-xs" : "rounded-t-xs"
                              } transition-all duration-300`}
                            />
                          </div>

                          {/* X-axis Label */}
                          <span className="text-[10px] text-slate-500 mt-2 truncate w-full text-center">
                            {point.timestamp.includes(" ")
                              ? point.timestamp.split(" ")[1]
                              : point.timestamp.slice(5)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Earliest in period</span>
                  <span>Latest activity</span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Database className="h-8 w-8 mb-2 stroke-1 text-slate-300" />
                No API requests recorded yet in this timeframe.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature & Model Breakdown (1 col) */}
        <div className="space-y-6">
          {/* Feature Breakdown */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="p-4 pb-2 border-b bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                Requests by Feature
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {analytics && analytics.byFeature.length > 0 ? (
                analytics.byFeature.map((item, idx) => {
                  const meta = getFeatureMeta(item.feature);
                  const totalReq = analytics.summary.totalRequests || 1;
                  const pct = Math.round((item.total / totalReq) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{meta.label}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {formatNum(item.total)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-indigo-500 rounded-full transition-all"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Latency: {item.avgLatency}ms</span>
                        <span>Tokens: {formatNum(item.tokens)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 text-center py-4">No feature activity recorded</div>
              )}
            </CardContent>
          </Card>

          {/* Model Breakdown */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="p-4 pb-2 border-b bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-600" />
                Requests by Gemini Model
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {analytics && analytics.byModel.length > 0 ? (
                analytics.byModel.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-mono text-xs font-semibold text-slate-800 block">
                        {item.model}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Avg Latency: {item.avgLatency}ms
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <Badge variant="outline" className="font-medium bg-white">
                        {formatNum(item.total)} calls
                      </Badge>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {formatNum(item.tokens)} tokens
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-4">No model activity recorded</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Error Diagnostics & Top Consuming Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Error Diagnostics (1 col) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              API Errors & Diagnostics
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Rate limits (429), timeouts, and API exceptions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {analytics && analytics.errorBreakdown.length > 0 ? (
              analytics.errorBreakdown.map((errItem, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-rose-200 bg-rose-50/60 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-mono text-[11px]">
                      {errItem.errorCode}
                    </Badge>
                    <span className="font-bold text-rose-700 font-mono">{errItem.count} occurrences</span>
                  </div>
                  {errItem.sampleMessage && (
                    <p className="text-[11px] text-slate-700 font-mono line-clamp-2 bg-white/70 p-1.5 rounded border border-rose-100">
                      {errItem.sampleMessage}
                    </p>
                  )}
                  {errItem.lastOccurred && (
                    <span className="text-[10px] text-slate-500 block">
                      Last seen: {new Date(errItem.lastOccurred).toLocaleString()}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <div className="h-8 w-8 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="font-medium text-slate-800">Zero Failures Recorded</p>
                <p className="text-[11px] text-slate-400">
                  All Gemini API calls in this timeframe completed successfully without rate limits or exceptions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Hospitals & Top Doctors (2 cols) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Top Hospitals */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="p-4 pb-2 border-b bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-600" />
                Top Consuming Hospitals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {analytics && analytics.topTenants.organizations.length > 0 ? (
                analytics.topTenants.organizations.map((org, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                        {org.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatNum(org.totalTokens)} tokens
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{formatNum(org.totalCalls)}</span>
                      <span className="text-[10px] text-slate-500 block">requests</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-6">No hospital quota data in window</div>
              )}
            </CardContent>
          </Card>

          {/* Top Doctors */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="p-4 pb-2 border-b bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#1a76d1]" />
                Top Consuming Doctors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {analytics && analytics.topTenants.doctors.length > 0 ? (
                analytics.topTenants.doctors.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {doc.specialization || "Doctor"} • {formatNum(doc.totalTokens)} tokens
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{formatNum(doc.totalCalls)}</span>
                      <span className="text-[10px] text-slate-500 block">requests</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-6">No doctor quota data in window</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5. Live Request Logs Table */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-5 pb-3 border-b bg-slate-50/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="h-4 w-4 text-sky-600" />
                Live Gemini API Request Logs
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Detailed audit trail of model calls with token usage, latency, and status
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Feature filter */}
              <select
                value={featureFilter}
                onChange={(e) => {
                  setFeatureFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              >
                <option value="ALL">All Features</option>
                <option value="PUBLIC_CHATBOT">Public Chatbot</option>
                <option value="CLINICAL_TRIAGE">Clinical Triage</option>
                <option value="ADMIN_ASSISTANT">Admin Assistant</option>
                <option value="AI_CONTENT_GEN">AI Copywriter</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed Only</option>
              </select>

              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 pl-8 text-xs w-44 bg-white"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 text-[11px]">
                <TableRow>
                  <TableHead className="w-[140px]">Timestamp</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead>Tenant Entity</TableHead>
                  <TableHead className="w-[60px] text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {isLoadingLogs ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-sky-600" />
                      Loading live Gemini API logs...
                    </TableCell>
                  </TableRow>
                ) : logsData && logsData.logs.length > 0 ? (
                  logsData.logs.map((log) => {
                    const featureMeta = getFeatureMeta(log.feature);
                    return (
                      <TableRow key={log._id} className="hover:bg-slate-50/60">
                        {/* Timestamp */}
                        <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString()}{" "}
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>

                        {/* Feature */}
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${featureMeta.color}`}>
                            {featureMeta.label}
                          </Badge>
                        </TableCell>

                        {/* Model */}
                        <TableCell className="font-mono text-[11px] text-slate-700 font-medium">
                          {log.model}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {log.status === "SUCCESS" ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
                            >
                              200 OK
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold"
                            >
                              {log.errorCode || `${log.statusCode} FAIL`}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Latency */}
                        <TableCell className="text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {log.latencyMs} ms
                        </TableCell>

                        {/* Tokens */}
                        <TableCell className="text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatNum(log.totalTokens || 0)}
                        </TableCell>

                        {/* Tenant */}
                        <TableCell className="text-[11px] text-slate-600">
                          {log.organizationId ? (
                            <span className="font-medium text-slate-800">
                              {log.organizationId.name}
                            </span>
                          ) : log.doctorId ? (
                            <span className="font-medium text-slate-800">
                              {log.doctorId.doctorName}
                            </span>
                          ) : log.userId ? (
                            <span className="text-slate-500">
                              {log.userId.email}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Global / Public</span>
                          )}
                        </TableCell>

                        {/* Action - Details */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLogForDetails(log)}
                            className="h-7 px-2 text-[11px] text-slate-600 hover:text-sky-600"
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                      No logs found matching current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination bar */}
          {logsData && logsData.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50/50 text-xs">
              <span className="text-slate-500">
                Showing page <strong>{logsData.page}</strong> of <strong>{logsData.totalPages}</strong> (
                {formatNum(logsData.total)} total logs)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2 text-xs bg-white"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= logsData.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 px-2 text-xs bg-white"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Inspection Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-sm">Gemini Request Details</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLogForDetails(null)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Status</span>
                  <span className={selectedLogForDetails.status === "SUCCESS" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                    {selectedLogForDetails.status} ({selectedLogForDetails.statusCode})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Latency</span>
                  <span className="font-mono font-medium text-slate-800">{selectedLogForDetails.latencyMs} ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Model</span>
                  <span className="font-mono text-slate-800">{selectedLogForDetails.model}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Feature</span>
                  <span className="font-medium text-slate-800">{selectedLogForDetails.feature}</span>
                </div>
              </div>

              {/* Tokens */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Token Usage</span>
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-700">
                  <span>Prompt: {formatNum(selectedLogForDetails.promptTokens || 0)}</span>
                  <span>Candidates: {formatNum(selectedLogForDetails.candidatesTokens || 0)}</span>
                  <span className="font-bold">Total: {formatNum(selectedLogForDetails.totalTokens || 0)}</span>
                </div>
              </div>

              {/* Error Message if any */}
              {selectedLogForDetails.errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                  <span className="text-[10px] text-rose-600 uppercase font-semibold block">
                    Error Message ({selectedLogForDetails.errorCode || "EXCEPTION"})
                  </span>
                  <p className="font-mono text-[11px] text-rose-900 break-words whitespace-pre-wrap">
                    {selectedLogForDetails.errorMessage}
                  </p>
                </div>
              )}

              {/* Metadata if any */}
              {selectedLogForDetails.metadata && Object.keys(selectedLogForDetails.metadata).length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Context Metadata</span>
                  <pre className="font-mono text-[11px] text-slate-700 overflow-x-auto p-1 bg-white rounded border border-slate-100">
                    {JSON.stringify(selectedLogForDetails.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLogForDetails(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
