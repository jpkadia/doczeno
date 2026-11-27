"use client";

import * as React from "react";
import {
  ShieldCheck,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  LogOut,
  Clock,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AdminLogEntry {
  id: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userRole: string;
  portalSlug?: string;
  ipAddress: string;
  browser: string;
  os: string;
  deviceType: "Desktop" | "Mobile" | "Tablet" | "Unknown";
  deviceLabel: string;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  status: "ACTIVE" | "LOGGED_OUT" | "EXPIRED";
  isLoggedIn: boolean;
  isCurrentSession: boolean;
  logoutAt?: string | null;
  logoutReason?: "MANUAL" | "INACTIVITY" | "SESSION_EXPIRED" | "REVOKED" | null;
}

interface AdminLogViewProps {
  isSuperadmin?: boolean;
  title?: string;
  description?: string;
}

/**
 * Formats any ISO date string into exact Indian Standard Time (IST / Asia/Kolkata).
 */
function formatIST(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(d) + " IST"
    );
  } catch {
    return "—";
  }
}

export function AdminLogView({
  isSuperadmin = false,
  title = "Admin Session & Login Logs",
  description = "Real-time audit trail of admin logins in Indian Standard Time (IST), device, browser, IP address, and logout status.",
}: AdminLogViewProps) {
  const [logs, setLogs] = React.useState<AdminLogEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const fetchLogs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = isSuperadmin && roleFilter !== "ALL" ? `?role=${encodeURIComponent(roleFilter)}` : "";
      const res = await apiClient.get<{
        success: boolean;
        data?: { logs?: AdminLogEntry[] };
      }>(`/auth/admin-logs${qs}`);
      if (res.success && Array.isArray(res.data?.logs)) {
        setLogs(res.data.logs);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin logs");
    } finally {
      setIsLoading(false);
    }
  }, [isSuperadmin, roleFilter]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await apiClient.post(`/auth/admin-logs/${encodeURIComponent(sessionId)}/revoke`, {});
      toast.success("Session terminated successfully.");
      await fetchLogs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to terminate session");
    } finally {
      setRevokingId(null);
    }
  };

  const activeCount = React.useMemo(() => logs.filter((l) => l.isLoggedIn).length, [logs]);
  const manualLogoutCount = React.useMemo(
    () => logs.filter((l) => l.logoutReason === "MANUAL").length,
    [logs]
  );
  const inactivityLogoutCount = React.useMemo(
    () => logs.filter((l) => l.logoutReason === "INACTIVITY").length,
    [logs]
  );

  const columns = React.useMemo<ColumnDef<AdminLogEntry>[]>(() => {
    const baseCols: ColumnDef<AdminLogEntry>[] = [];

    if (isSuperadmin) {
      baseCols.push({
        key: "userEmail",
        header: "Admin / Portal",
        cell: (log) => (
          <div className="space-y-0.5">
            <div className="font-bold text-slate-900 text-xs">
              {log.userName || log.userEmail}
            </div>
            <div className="text-[11px] text-slate-500">{log.userEmail}</div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {log.userRole}
              </Badge>
              {log.portalSlug && (
                <span className="text-[10px] font-mono text-[#1a76d1]">/{log.portalSlug}</span>
              )}
            </div>
          </div>
        ),
      });
    }

    baseCols.push(
      {
        key: "loginAt",
        header: "Login Time (IST)",
        cell: (log) => (
          <div className="space-y-0.5 whitespace-nowrap">
            <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#1a76d1] shrink-0" />
              <span>{formatIST(log.loginAt)}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Last active: {formatIST(log.lastActivityAt)}
            </div>
          </div>
        ),
      },
      {
        key: "deviceLabel",
        header: "Device & Browser",
        cell: (log) => {
          const DeviceIcon =
            log.deviceType === "Mobile"
              ? Smartphone
              : log.deviceType === "Tablet"
              ? Tablet
              : Monitor;
          return (
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <DeviceIcon className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <span>{log.deviceLabel}</span>
                <span className="text-[10px] text-slate-500 font-normal">({log.os})</span>
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-1">
                <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                <span>{log.browser}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: "ipAddress",
        header: "IP Address",
        cell: (log) => (
          <span className="font-mono text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
            {log.ipAddress || "Unknown"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Login Status",
        cell: (log) => (
          <div className="space-y-1">
            {log.isLoggedIn ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Still Logged In
                </Badge>
                {log.isCurrentSession && (
                  <Badge variant="outline" className="text-[9px] border-blue-300 text-[#1560aa] bg-blue-50">
                    Current
                  </Badge>
                )}
              </div>
            ) : (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold gap-1"
              >
                <XCircle className="h-3 w-3 text-slate-500" />
                {log.status === "EXPIRED" ? "Expired" : "Logged Out"}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "logoutReason",
        header: "Logout Method & Time (IST)",
        cell: (log) => {
          if (log.isLoggedIn) {
            return (
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Session Active
              </span>
            );
          }

          const reasonBadge =
            log.logoutReason === "INACTIVITY" ? (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-semibold gap-1">
                <AlertTriangle className="h-3 w-3" />
                Inactivity Auto-Logout
              </Badge>
            ) : log.logoutReason === "MANUAL" ? (
              <Badge className="bg-blue-100 text-[#1560aa] border border-blue-300 text-[10px] font-semibold">
                Manual Logout (Self)
              </Badge>
            ) : log.logoutReason === "REVOKED" ? (
              <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-semibold">
                Force Logged Out
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-slate-600">
                Session Expired
              </Badge>
            );

          return (
            <div className="space-y-1">
              {reasonBadge}
              {log.logoutAt && (
                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                  {formatIST(log.logoutAt)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Action",
        sortable: false,
        headerClassName: "text-right",
        cell: (log) =>
          log.isLoggedIn && !log.isCurrentSession ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={revokingId === log.sessionId}
                onClick={() => handleRevokeSession(log.sessionId)}
                className="h-7 px-2.5 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
                title="Terminate this active session"
              >
                <LogOut className="h-3 w-3 mr-1" />
                {revokingId === log.sessionId ? "Ending..." : "Force Logout"}
              </Button>
            </div>
          ) : (
            <div className="text-right text-[11px] text-slate-400">
              {log.isCurrentSession ? "This Session" : "—"}
            </div>
          ),
      }
    );

    return baseCols;
  }, [isSuperadmin, revokingId]);

  return (
    <div className="space-y-5">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Login Sessions
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{logs.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-emerald-200 shadow-xs">
          <CardContent className="p-4">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Currently Logged In
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-blue-200 shadow-xs">
          <CardContent className="p-4">
            <div className="text-[11px] font-semibold text-[#1560aa] uppercase tracking-wider">
              Manual Logouts
            </div>
            <div className="text-2xl font-extrabold text-[#1560aa] mt-1">{manualLogoutCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-amber-200 shadow-xs">
          <CardContent className="p-4">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Inactivity Logouts
            </div>
            <div className="text-2xl font-extrabold text-amber-700 mt-1">{inactivityLogoutCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Logs Table */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1a76d1]" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              {description} (Auto-deleted after 30 days)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isSuperadmin && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by admin role"
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
              >
                <option value="ALL">All Admin Roles</option>
                <option value="SUPERADMIN">Superadmin</option>
                <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                <option value="ONLY_DOCTOR">Only Doctor</option>
                <option value="HOSPITAL_DOCTOR">Hospital Doctor</option>
              </select>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={fetchLogs}
              disabled={isLoading}
              className="h-8 px-3 text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={logs}
            searchPlaceholder="Search IP, browser, device, email..."
            pageSize={10}
            exportFileName="admin_login_logs"
            emptyMessage={isLoading ? "Loading admin session logs..." : "No login activity recorded yet."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
