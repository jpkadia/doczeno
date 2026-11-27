"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Activity, ArrowRight, RefreshCw, Users, CheckCircle2, XCircle } from "lucide-react";

interface LiveQueueSlot {
  slotKey: string;
  displayLabel: string;
  maxPatients: number | null;
  bookedCount: number;
  remainingSeats: number | null;
  isFull: boolean;
  currentServingToken: number;
}

interface LiveQueueSummary {
  doctorId: string;
  doctorName: string;
  dateKey: string;
  activeSlotKey: string;
  currentServingToken: number;
  currentPatientName: string | null;
  nextTokenNumber: number | null;
  nextPatientName: string | null;
  waitingCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  slots: LiveQueueSlot[];
}

interface LiveOpdQueueCardProps {
  doctorId?: string;
  doctorOptions?: Array<{ id: string; doctorName: string; specialization?: string }>;
  onDoctorChange?: (doctorId: string) => void;
  refreshTrigger?: number;
  onQueueAdvanced?: () => void;
}

export function LiveOpdQueueCard({
  doctorId,
  doctorOptions,
  onDoctorChange,
  refreshTrigger = 0,
  onQueueAdvanced,
}: LiveOpdQueueCardProps) {
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(
    doctorId || doctorOptions?.[0]?.id || ""
  );
  const [selectedSlotKey, setSelectedSlotKey] = React.useState<string>("");
  const [summary, setSummary] = React.useState<LiveQueueSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  React.useEffect(() => {
    if (doctorId) {
      setSelectedDoctorId(doctorId);
    } else if (!selectedDoctorId && doctorOptions && doctorOptions.length > 0) {
      setSelectedDoctorId(doctorOptions[0]?.id || "");
    }
  }, [doctorId, doctorOptions, selectedDoctorId]);

  const effectiveDoctorId = doctorId || selectedDoctorId;

  const fetchQueue = React.useCallback(async () => {
    if (!effectiveDoctorId) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data?: LiveQueueSummary }>(
        "/appointments/queue",
        {
          params: {
            doctorId: effectiveDoctorId,
            slotKey: selectedSlotKey || undefined,
          },
        }
      );
      if (res?.success && res.data) {
        setSummary(res.data);
        if (!selectedSlotKey && res.data.activeSlotKey) {
          setSelectedSlotKey(res.data.activeSlotKey);
        }
      }
    } catch {
      // Silent fallback if no appointments yet
    } finally {
      setLoading(false);
    }
  }, [effectiveDoctorId, selectedSlotKey]);

  React.useEffect(() => {
    fetchQueue();
  }, [fetchQueue, refreshTrigger]);

  const handleCallNext = async () => {
    if (!effectiveDoctorId) return;
    setAdvancing(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message?: string;
        data?: LiveQueueSummary;
      }>("/appointments/queue/next", {
        doctorId: effectiveDoctorId,
        slotKey: selectedSlotKey || summary?.activeSlotKey,
        completeCurrent: true,
      });

      if (res?.success && res.data) {
        setSummary(res.data);
        toast.success(
          res.data.currentServingToken > 0
            ? `Now serving Token #${res.data.currentServingToken}${res.data.currentPatientName ? ` (${res.data.currentPatientName})` : ""}`
            : "OPD queue cleared for current slot."
        );
        onQueueAdvanced?.();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to advance OPD queue");
    } finally {
      setAdvancing(false);
    }
  };

  if (!effectiveDoctorId) return null;

  const activeSlotObj = summary?.slots.find((s) => s.slotKey === (selectedSlotKey || summary.activeSlotKey));

  return (
    <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700 rounded-2xl shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold tracking-tight">Live OPD Queue</h3>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  Today • {summary?.dateKey || "Live"}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-300">
                Real-time token board &amp; slot capacity control (automatically skips cancelled appointments)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {doctorOptions && doctorOptions.length > 0 && (
              <select
                value={effectiveDoctorId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedDoctorId(nextId);
                  setSelectedSlotKey("");
                  onDoctorChange?.(nextId);
                }}
                className="h-8 rounded-lg border border-slate-600 bg-slate-800 px-2.5 text-xs text-white outline-none focus:border-emerald-400"
              >
                {doctorOptions.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.doctorName}{doc.specialization ? ` (${doc.specialization})` : ""}
                  </option>
                ))}
              </select>
            )}

            {summary && summary.slots.length > 0 && (
              <select
                value={selectedSlotKey || summary.activeSlotKey}
                onChange={(e) => setSelectedSlotKey(e.target.value)}
                className="h-8 rounded-lg border border-slate-600 bg-slate-800 px-2.5 text-xs text-white outline-none focus:border-emerald-400"
              >
                {summary.slots.map((sl) => (
                  <option key={sl.slotKey} value={sl.slotKey}>
                    {sl.displayLabel}
                    {sl.maxPatients !== null ? ` (${sl.bookedCount}/${sl.maxPatients})` : ` (${sl.bookedCount} booked)`}
                  </option>
                ))}
              </select>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading}
              onClick={fetchQueue}
              className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-white/10"
              title="Refresh live queue"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={advancing || (!summary?.nextTokenNumber && !summary?.currentServingToken)}
              onClick={handleCallNext}
              className="h-8 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>
                {advancing
                  ? "Calling..."
                  : summary?.nextTokenNumber
                  ? `Call Next (#${summary.nextTokenNumber})`
                  : summary?.currentServingToken
                  ? `Finish Token #${summary.currentServingToken}`
                  : "No Waiting Tokens"}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl bg-white/10 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold block">
              Now Serving
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-black font-mono text-white">
                {summary && summary.currentServingToken > 0
                  ? `Token #${summary.currentServingToken}`
                  : "Not Started"}
              </span>
            </div>
            {summary?.currentPatientName && (
              <span className="text-[11px] text-slate-300 truncate block">
                {summary.currentPatientName}
              </span>
            )}
          </div>

          <div className="rounded-xl bg-white/10 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold block">
              Next In Queue
            </span>
            <span className="text-xl font-black font-mono text-white block mt-0.5">
              {summary?.nextTokenNumber ? `Token #${summary.nextTokenNumber}` : "—"}
            </span>
            <span className="text-[11px] text-slate-300 truncate block">
              {summary?.nextPatientName || "No patient waiting"}
            </span>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1">
              <Users className="h-3 w-3" />
              Waiting / Done
            </span>
            <span className="text-xl font-black text-white block mt-0.5">
              {summary?.waitingCount ?? 0}{" "}
              <span className="text-xs font-normal text-slate-300">
                waiting • {summary?.completedCount ?? 0} done
              </span>
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                <XCircle className="h-3 w-3 text-rose-400" /> {summary?.cancelledCount ?? 0} cancelled
              </span>
            </span>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] uppercase tracking-wider text-violet-300 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Slot Capacity
            </span>
            <span className="text-xl font-black font-mono text-white block mt-0.5">
              {activeSlotObj
                ? activeSlotObj.maxPatients !== null
                  ? `${activeSlotObj.bookedCount}/${activeSlotObj.maxPatients}`
                  : `${activeSlotObj.bookedCount} / ∞`
                : "—"}
            </span>
            <span className="text-[11px] text-slate-300 block">
              {activeSlotObj
                ? activeSlotObj.isFull
                  ? "Slot Capacity Full"
                  : activeSlotObj.remainingSeats !== null
                  ? `${activeSlotObj.remainingSeats} seats left`
                  : "Unlimited capacity"
                : "Select slot"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
