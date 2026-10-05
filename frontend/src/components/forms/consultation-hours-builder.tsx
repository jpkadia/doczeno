"use client";

import * as React from "react";
import { DAYS_OF_WEEK, DayOfWeek } from "@/constants/healthcare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Clock, AlertCircle } from "lucide-react";

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DaySchedule {
  day: DayOfWeek;
  isClosed: boolean;
  slots: TimeSlot[];
}

interface ConsultationHoursBuilderProps {
  value: DaySchedule[];
  onChange: (schedules: DaySchedule[]) => void;
  error?: string;
  disabled?: boolean;
}

export const DEFAULT_WEEK_SCHEDULE: DaySchedule[] = DAYS_OF_WEEK.map((day) => ({
  day,
  isClosed: day === "Sunday",
  slots: day === "Sunday" ? [] : [{ startTime: "09:00", endTime: "13:00" }, { startTime: "17:00", endTime: "20:00" }],
}));

export function ConsultationHoursBuilder({
  value,
  onChange,
  error,
  disabled,
}: ConsultationHoursBuilderProps) {
  const schedules = value && value.length > 0 ? value : DEFAULT_WEEK_SCHEDULE;

  const handleToggleClosed = (index: number) => {
    const updated = [...schedules];
    const target = updated[index];
    if (!target) return;
    target.isClosed = !target.isClosed;
    if (target.isClosed) {
      target.slots = [];
    } else if (target.slots.length === 0) {
      target.slots = [{ startTime: "09:00", endTime: "17:00" }];
    }
    onChange(updated);
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
    field: "startTime" | "endTime",
    val: string
  ) => {
    const updated = [...schedules];
    const targetDay = updated[dayIndex];
    if (!targetDay) return;
    const targetSlot = targetDay.slots[slotIndex];
    if (!targetSlot) return;
    targetSlot[field] = val;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Weekly Consultation Schedule</Label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2 border rounded-lg p-3 bg-card/60">
        {schedules.map((schedule, dayIndex) => {
          return (
            <div
              key={schedule.day}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-md border border-border/70 bg-background/50 hover:bg-background transition-colors"
            >
              <div className="flex items-center justify-between sm:w-36">
                <span className="text-xs font-semibold text-foreground">
                  {schedule.day}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToggleClosed(dayIndex)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                    schedule.isClosed
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}
                >
                  {schedule.isClosed ? "Closed" : "Open"}
                </button>
              </div>

              {/* Slots Section */}
              <div className="flex-1 flex flex-col gap-2">
                {schedule.isClosed ? (
                  <span className="text-xs text-muted-foreground italic">
                    Clinic closed on this day
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

              {!schedule.isClosed && (
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
