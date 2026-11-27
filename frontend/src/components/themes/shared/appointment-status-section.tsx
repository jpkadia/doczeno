"use client";

import * as React from "react";
import { useState } from "react";
import { Search, Calendar, Clock, User, Stethoscope, Building2, CheckCircle2, Clock3, AlertCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebsiteThemeMode } from "./website-mode-context";
import { resolveThemePalette } from "@/lib/theme-palettes";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AppointmentStatusSectionProps {
  slug: string;
  doctorSlug?: string;
  selectedTheme?: string;
  themeVariant?: "clinical" | "minimal" | "compact";
  title?: string;
  description?: string;
  embedded?: boolean;
}

interface AppointmentStatusData {
  appointmentId: string;
  tokenNumber?: number | null;
  slotKey?: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "PATIENT_NOT_COME";
  patientName: string;
  patientAge?: number;
  appointmentDate: string;
  timeSlot: string;
  notes?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  hospitalName?: string;
  createdAt?: string;
  queueInfo?: {
    tokenNumber: number | null;
    slotKey: string;
    slotLabel: string;
    currentServingToken: number;
    patientsAhead: number;
    isYourTurn: boolean;
    isNext: boolean;
    queueMessage: string;
  };
}

export function AppointmentStatusSection({
  slug,
  doctorSlug,
  selectedTheme,
  themeVariant = "clinical",
  title = "Appointment Status",
  description = "Enter your Appointment ID to track real-time booking confirmation and details.",
  embedded = false,
}: AppointmentStatusSectionProps) {
  const { isDark } = useWebsiteThemeMode();
  const theme = resolveThemePalette(selectedTheme);
  const [appointmentIdInput, setAppointmentIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AppointmentStatusData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const handleCheckStatus = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = appointmentIdInput.trim().toUpperCase();
    if (!cleanId) {
      setErrorMsg("Please enter an Appointment ID (e.g. 151120261)");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setShowConfirmCancel(false);

    try {
      const res: any = await apiClient.post("/appointments/check-status", {
        appointmentId: cleanId,
        slug,
        doctorSlug,
      });

      if (res?.success && res.data) {
        setResult(res.data);
      } else {
        setErrorMsg("Appointment not found. Please verify your Appointment ID.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Could not find an appointment with this ID under this clinic/hospital.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!result) return;
    setCancelling(true);
    try {
      const res: any = await apiClient.post("/appointments/cancel", {
        appointmentId: result.appointmentId,
        slug,
        doctorSlug,
      });

      if (res?.success) {
        toast.success(res?.message || "Appointment successfully cancelled.");
        setResult((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
        setShowConfirmCancel(false);
      } else {
        toast.error(res?.error || "Could not cancel appointment.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Error cancelling appointment.");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: AppointmentStatusData["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirmed
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-1.5 px-3 py-1">
            <Clock3 className="h-3.5 w-3.5" />
            Pending Confirmation
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge
            className="hover:opacity-90 text-white font-semibold flex items-center gap-1.5 px-3 py-1"
            style={{ backgroundColor: theme.primary }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 px-3 py-1">
            <XCircle className="h-3.5 w-3.5" />
            Cancelled
          </Badge>
        );
      case "NO_SHOW":
      case "PATIENT_NOT_COME":
        return (
          <Badge className="bg-slate-500 hover:bg-slate-600 text-white font-semibold flex items-center gap-1.5 px-3 py-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Patient Did Not Attend
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-semibold">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const innerContent = (
    <div className="space-y-5">
            {/* Search Input Form */}
            <form onSubmit={handleCheckStatus} className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Enter Appointment ID (e.g. 151120261)"
                  value={appointmentIdInput}
                  onChange={(e) => setAppointmentIdInput(e.target.value)}
                  className={cn(
                    "uppercase font-mono tracking-wider text-sm placeholder:tracking-normal placeholder:capitalize pl-3.5 pr-8 h-10 rounded-xl transition-all shadow-xs",
                    "border",
                    "focus:border-[var(--theme-primary)] focus-visible:border-[var(--theme-primary)]",
                    "focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]/30 focus-visible:ring-offset-0",
                    isDark
                      ? "text-white placeholder:text-slate-400"
                      : "text-slate-900 placeholder:text-slate-400"
                  )}
                  style={{
                    backgroundColor: isDark ? "var(--theme-inner-card-bg, #0a2e22)" : "#ffffff",
                    borderColor: "var(--theme-card-border, rgba(5, 150, 105, 0.25))",
                  }}
                  autoComplete="off"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-10 rounded-xl font-bold text-xs sm:text-sm px-6 text-white shadow-md hover:shadow-lg transition-all shrink-0"
                style={{
                  backgroundColor: theme.primary,
                }}
              >
                {loading ? "Checking..." : "Check Status"}
              </Button>
            </form>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm text-center flex items-center justify-center gap-2 max-w-md mx-auto">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Search Result Card */}
            {result && (
              <div
                className={cn(
                  "rounded-2xl border p-5 sm:p-6 space-y-5 animate-in fade-in-50 shadow-md",
                  isDark ? "text-slate-100" : "text-slate-800"
                )}
                style={{
                  backgroundColor: isDark ? "var(--theme-inner-card-bg, rgba(255, 255, 255, 0.05))" : "var(--theme-section-alt-bg, #f1f5f9)",
                  borderColor: "var(--theme-card-border, rgba(5, 150, 105, 0.25))",
                }}
              >
                <div className={cn("flex flex-wrap items-center justify-between gap-3 pb-4 border-b", isDark ? "border-slate-700" : "border-slate-200")}>
                  <div>
                    <span className={cn("text-[11px] uppercase tracking-wider font-semibold block", isDark ? "text-slate-400" : "text-slate-500")}>
                      Appointment ID &amp; Token
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                      <span className={cn("text-xl font-bold font-mono", isDark ? "text-white" : "text-slate-900")}>
                        {result.appointmentId}
                      </span>
                      {typeof (result.tokenNumber ?? result.queueInfo?.tokenNumber) === "number" && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-mono text-xs px-2.5 py-0.5">
                          Token #{result.tokenNumber ?? result.queueInfo?.tokenNumber}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>{getStatusBadge(result.status)}</div>
                </div>

                {/* Live OPD Queue Tracker Banner */}
                {result.queueInfo && (result.status === "PENDING" || result.status === "CONFIRMED") && (
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2",
                      result.queueInfo.isYourTurn
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        : isDark
                        ? "bg-white/5 border-white/15 text-slate-200"
                        : "bg-blue-50/80 border-blue-200 text-slate-800"
                    )}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">
                        Live OPD Queue Status
                      </span>
                      <p className="text-xs sm:text-sm font-semibold">
                        {result.queueInfo.queueMessage}
                      </p>
                    </div>
                    {result.queueInfo.currentServingToken > 0 && (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase tracking-wider opacity-75 block">
                          Now Serving
                        </span>
                        <span className="text-base font-black font-mono">
                          Token #{result.queueInfo.currentServingToken}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  {/* Patient Details */}
                  <div className="space-y-1">
                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                      <User className="h-3.5 w-3.5 text-slate-400" /> Patient Name
                    </span>
                    <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                      {result.patientName} {result.patientAge ? `(${result.patientAge} yrs)` : ""}
                    </p>
                  </div>

                  {/* Doctor Details */}
                  {result.doctorName && (
                    <div className="space-y-1">
                      <span className={cn("flex items-center gap-1.5 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                        <Stethoscope className="h-3.5 w-3.5 text-[var(--theme-primary)]" /> Doctor
                      </span>
                      <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                        Dr. {result.doctorName}
                        {result.doctorSpecialization && (
                          <span className={cn("text-xs font-normal block", isDark ? "text-slate-400" : "text-slate-500")}>
                            {result.doctorSpecialization}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Date & Slot */}
                  <div className="space-y-1">
                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                      <Calendar className="h-3.5 w-3.5 text-[var(--theme-primary)]" /> Appointment Date
                    </span>
                    <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                      {formatDate(result.appointmentDate)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                      <Clock className="h-3.5 w-3.5 text-[var(--theme-primary)]" /> Time Slot
                    </span>
                    <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>{result.timeSlot}</p>
                  </div>

                  {/* Hospital Info if applicable */}
                  {result.hospitalName && (
                    <div className="space-y-1 sm:col-span-2">
                      <span className={cn("flex items-center gap-1.5 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                        <Building2 className="h-3.5 w-3.5 text-[var(--theme-primary)]" /> Hospital / Facility
                      </span>
                      <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>{result.hospitalName}</p>
                    </div>
                  )}

                  {/* Problem / Reason */}
                  {result.notes && (
                    <div className={cn("space-y-1 sm:col-span-2 pt-2 border-t", isDark ? "border-slate-700" : "border-slate-200/60")}>
                      <span className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                        Medical Concern / Reason for Visit:
                      </span>
                      <p className={cn("italic text-xs leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>
                        {result.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Patient Self-Cancellation & Lock States */}
                {(result.status === "PENDING" || result.status === "CONFIRMED") && (
                  <div className={cn("pt-4 border-t", isDark ? "border-slate-700" : "border-slate-200")}>
                    {!showConfirmCancel ? (
                      <div
                        className={cn(
                          "flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-xl p-3.5 sm:p-4 transition-colors",
                          isDark ? "bg-slate-800/60 border-slate-700/80 text-slate-300" : "bg-slate-50/90 border-slate-200/90 text-slate-600 shadow-2xs"
                        )}
                      >
                        <div className="text-xs">
                          <span className={cn("font-semibold block", isDark ? "text-white" : "text-slate-800")}>Need to cancel your visit?</span>
                          <span className={isDark ? "text-slate-400" : "text-slate-600"}>You can cancel this appointment before your scheduled consultation.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowConfirmCancel(true)}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                            isDark
                              ? "border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 hover:border-rose-500/60"
                              : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100/90 hover:border-rose-300 shadow-2xs"
                          )}
                        >
                          <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <span className={cn("font-semibold", isDark ? "text-rose-300" : "text-rose-600")}>Cancel Appointment</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "rounded-xl border p-4 space-y-3.5 transition-colors animate-in fade-in-50",
                          isDark
                            ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
                            : "bg-rose-50/90 border-rose-200 text-rose-900 shadow-xs"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5", isDark ? "text-rose-400" : "text-rose-600")} />
                          <div>
                            <p className={cn("text-xs sm:text-sm font-bold tracking-tight", isDark ? "text-rose-200" : "text-rose-900")}>
                              Confirm Appointment Cancellation
                            </p>
                            <p className={cn("text-xs mt-1 leading-relaxed", isDark ? "text-rose-300/90" : "text-rose-700")}>
                              Are you sure you want to cancel this appointment? Once cancelled, it will be permanently marked as CANCELLED in the system and cannot be reactivated by you or the clinic doctor.
                            </p>
                          </div>
                        </div>
                        <div className={cn("flex items-center justify-end gap-2.5 pt-2.5 border-t", isDark ? "border-rose-800/40" : "border-rose-200")}>
                          <button
                            type="button"
                            disabled={cancelling}
                            onClick={() => setShowConfirmCancel(false)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                              isDark
                                ? "border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs"
                            )}
                          >
                            Keep Appointment
                          </button>
                          <button
                            type="button"
                            disabled={cancelling}
                            onClick={handleCancelAppointment}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {cancelling ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Cancelling...</span>
                              </>
                            ) : (
                              <span>Yes, Cancel Appointment</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {result.status === "CANCELLED" && (
                  <div className={cn("pt-4 border-t", isDark ? "border-slate-700" : "border-slate-200")}>
                    <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                      <div>
                        <span className="font-semibold block">This appointment has been cancelled.</span>
                        <span className="text-rose-400 text-xs block mt-0.5">
                          Cancelled appointments are permanently locked. They cannot be reactivated or changed from either the website or the clinic admin portal.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <section id="appointment-status" className={cn("scroll-mt-20", themeVariant === "compact" ? "py-6" : "py-8 sm:py-12")}>
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <Card
          className={cn(
            "overflow-hidden transition-colors",
            isDark
              ? "border border-slate-700/80 shadow-lg bg-slate-900/90 text-slate-100"
              : "border border-slate-200/80 shadow-sm bg-white text-slate-900"
          )}
        >
          <CardHeader className="text-center pb-4 space-y-1.5">
            <div
              className={cn(
                "inline-flex items-center justify-center p-2 rounded-full mx-auto mb-1",
                isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
              )}
            >
              <Search className="h-5 w-5" />
            </div>
            <CardTitle className={cn("text-xl sm:text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("text-xs sm:text-sm max-w-md mx-auto", isDark ? "text-slate-400" : "text-slate-500")}>
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {innerContent}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
