"use client";

import * as React from "react";
import { DAYS_OF_WEEK, DayOfWeek } from "@/constants/healthcare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Clock, AlertCircle } from "lucide-react";

export interface TimeSlot {
  startTime: string;
  endTime: string;
  maxPatients?: number | null;
}

export interface DaySchedule {
  day: DayOfWeek;
  isClosed: boolean;
  slots: TimeSlot[];
}

interface ConsultationHoursBuilderProps {
  value: DaySchedule[];
  onChange: (schedules: DaySchedule[]) => void;
  onClosedDaysChange?: (closedDays: DayOfWeek[]) => void;
  error?: string;
  disabled?: boolean;
  hospitalWeeklyOff?: string[];
  hospitalName?: string;
  showCapacityControls?: boolean;
}

export const DEFAULT_WEEK_SCHEDULE: DaySchedule[] = DAYS_OF_WEEK.map((day) => ({
  day,
  isClosed: day === "Sunday",
  slots: day === "Sunday" ? [] : [{ startTime: "09:00", endTime: "13:00" }, { startTime: "17:00", endTime: "20:00" }],
}));

export function ConsultationHoursBuilder({
  value,
  onChange,
  onClosedDaysChange,
  error,
  disabled,
  hospitalWeeklyOff,
  hospitalName,
  showCapacityControls = false,
}: ConsultationHoursBuilderProps) {
  const schedules = value && value.length > 0 ? value : DEFAULT_WEEK_SCHEDULE;

  const normalizedHospitalOffDays = React.useMemo(() => {
    if (!hospitalWeeklyOff || hospitalWeeklyOff.length === 0) return new Set<string>();
    return new Set(hospitalWeeklyOff.map((d) => d.trim().toLowerCase()));
  }, [hospitalWeeklyOff]);

  // If hospital off days are provided, ensure any day matching is forced closed in schedule
  React.useEffect(() => {
    if (normalizedHospitalOffDays.size === 0) return;
    let needsUpdate = false;
    const sanitized = schedules.map((s) => {
      if (normalizedHospitalOffDays.has(s.day.trim().toLowerCase()) && (!s.isClosed || s.slots.length > 0)) {
        needsUpdate = true;
        return { ...s, isClosed: true, slots: [] };
      }
      return s;
    });
    if (needsUpdate) {
      onChange(sanitized);
      onClosedDaysChange?.(sanitized.filter((s) => s.isClosed).map((s) => s.day));
    }
  }, [normalizedHospitalOffDays, schedules, onChange, onClosedDaysChange]);

  const handleToggleClosed = (index: number) => {
    const target = schedules[index];
    if (target && normalizedHospitalOffDays.has(target.day.trim().toLowerCase())) {
      return; // Locked by parent hospital
    }
    const updated = schedules.map((s, i) => {
      if (i !== index) return s;
      const willBeClosed = !s.isClosed;
      return {
        ...s,
        isClosed: willBeClosed,
        slots: willBeClosed ? [] : (s.slots.length > 0 ? s.slots : [{ startTime: "09:00", endTime: "17:00" }]),
      };
    });
    onChange(updated);
    onClosedDaysChange?.(updated.filter((s) => s.isClosed).map((s) => s.day));
  };

  const handleAddSlot = (index: number) => {
    const updated = [...schedules];
    const target = updated[index];
    if (!target || target.isClosed) return;
    target.slots.push({ startTime: "14:00", endTime: "18:00" });
    onChange(updated);
  };

  const handleRemoveSlot = (dayIndex: number, slotIndex: number) => {
    const updated = [...schedules];
    const target = updated[dayIndex];
    if (!target) return;
    target.slots.splice(slotIndex, 1);
    onChange(updated);
  };

  const handleSlotChange = (
    dayIndex: number,
    slotIndex: number,
    field: "startTime" | "endTime" | "maxPatients",
    val: string
  ) => {
    const updated = [...schedules];
    const targetDay = updated[dayIndex];
    if (!targetDay) return;
    const targetSlot = targetDay.slots[slotIndex];
    if (!targetSlot) return;
    if (field === "maxPatients") {
      const parsed = parseInt(val, 10);
      targetSlot.maxPatients = !val.trim() || isNaN(parsed) || parsed <= 0 ? null : Math.min(500, parsed);
    } else {
      targetSlot[field] = val;
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Weekly Consultation Schedule</Label>
      </div>

      {hospitalWeeklyOff && hospitalWeeklyOff.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold block">Hospital Operational Constraint</span>
            <span>
              {hospitalName ? `${hospitalName} is` : "The affiliated hospital is"} closed on{" "}
              <strong>{hospitalWeeklyOff.join(", ")}</strong>. Doctor consultation hours cannot be scheduled on hospital weekly-off days.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2 border rounded-lg p-3 bg-card/60">
        {schedules.map((schedule, dayIndex) => {
          const isLockedByHospital = normalizedHospitalOffDays.has(schedule.day.trim().toLowerCase());
          const isOpen = !schedule.isClosed && !isLockedByHospital;

          return (
            <div
              key={schedule.day}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-md border transition-colors ${
                isLockedByHospital
                  ? "border-rose-200/80 bg-rose-50/40 dark:border-rose-950 dark:bg-rose-950/20"
                  : "border-border/70 bg-background/50 hover:bg-background"
              }`}
            >
              <div className="flex items-center justify-between sm:w-44 gap-2">
                <span className="text-xs font-semibold text-foreground w-20">
                  {schedule.day}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isOpen}
                    onCheckedChange={() => handleToggleClosed(dayIndex)}
                    disabled={disabled || isLockedByHospital}
                    aria-label={`Toggle ${schedule.day} open or closed`}
                  />
                  {isLockedByHospital ? (
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 select-none">
                      Hospital Off
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-semibold select-none min-w-[44px] ${
                        isOpen
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {isOpen ? "Open" : "Closed"}
                    </span>
                  )}
                </div>
              </div>

              {/* Slots Section */}
              <div className="flex-1 flex flex-col gap-2">
                {isLockedByHospital ? (
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-medium py-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                    Hospital Closed (Weekly Off) — Doctor consultations unavailable
                  </span>
                ) : !isOpen ? (
                  <span className="text-xs text-muted-foreground italic py-1">
                    Doctor off on this day
                  </span>
                ) : (
                  schedule.slots.map((slot, slotIndex) => {
                    const isInvalid = slot.startTime >= slot.endTime;

                    return (
                      <div
                        key={slotIndex}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <Input
                          type="time"
                          disabled={disabled}
                          value={slot.startTime}
                          onChange={(e) =>
                            handleSlotChange(dayIndex, slotIndex, "startTime", e.target.value)
                          }
                          className="h-8 w-28 text-xs font-mono"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          disabled={disabled}
                          value={slot.endTime}
                          onChange={(e) =>
                            handleSlotChange(dayIndex, slotIndex, "endTime", e.target.value)
                          }
                          className={`h-8 w-28 text-xs font-mono ${
                            isInvalid ? "border-destructive text-destructive" : ""
                          }`}
                        />

                        {showCapacityControls && (
                          <div className="flex items-center gap-1.5" title="Maximum patients allowed in this slot (leave blank for unlimited)">
                            <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                              Max Patients:
                            </span>
                            <Input
                              type="number"
                              min={1}
                              max={500}
                              placeholder="Unlimited"
                              disabled={disabled}
                              value={slot.maxPatients ?? ""}
                              onChange={(e) =>
                                handleSlotChange(dayIndex, slotIndex, "maxPatients", e.target.value)
                              }
                              className="h-8 w-24 text-xs font-mono"
                            />
                          </div>
                        )}

                        {isInvalid && (
                          <span className="text-[10px] text-destructive font-medium">
                            Start must be before End
                          </span>
                        )}

                        {schedule.slots.length > 1 && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => handleRemoveSlot(dayIndex, slotIndex)}
                            className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                            title="Remove slot"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {isOpen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => handleAddSlot(dayIndex)}
                  className="h-7 px-2 text-xs text-primary self-start sm:self-center"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Slot
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
