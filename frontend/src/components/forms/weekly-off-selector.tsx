"use client";

import * as React from "react";
import { DAYS_OF_WEEK, DayOfWeek } from "@/constants/healthcare";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface WeeklyOffSelectorProps {
  value: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
  disabled?: boolean;
}

export function WeeklyOffSelector({
  value = [],
  onChange,
  disabled,
}: WeeklyOffSelectorProps) {
  const toggleDay = (day: DayOfWeek) => {
    if (disabled) return;
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Weekly Off Days</Label>
      <div className="flex flex-wrap gap-2 pt-1">
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day)}
              className={cn(
                "px-3 py-1 text-xs rounded-full border transition-all select-none font-medium",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background text-foreground border-border hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Select one or more days when the practice is routinely closed.
      </p>
    </div>
  );
}
