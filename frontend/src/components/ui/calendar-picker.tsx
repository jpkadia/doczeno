"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingDayOption } from "@/lib/appointment-schedule";

export interface CalendarPickerProps {
  id?: string;
  value?: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  bookingDays?: BookingDayOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  isDark?: boolean;
  error?: string | null;
  className?: string;
  theme?: {
    primary: string;
    primaryHover: string;
    primaryLight?: string;
    cardBgDark?: string;
    cardBorderDark?: string;
    innerCardBgDark?: string;
    cardBorderLight?: string;
  };
}

function parseYMD(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined || isNaN(y) || isNaN(m) || isNaN(d)) {
    return null;
  }
  return { year: y, month: m - 1, day: d };
}

function formatButtonDisplay(dateStr: string): string {
  const parsed = parseYMD(dateStr);
  if (!parsed) return "Choose appointment date";
  const d = new Date(parsed.year, parsed.month, parsed.day);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPicker({
  id = "calendar-picker",
  value = "",
  onChange,
  minDate,
  maxDate,
  bookingDays = [],
  placeholder = "Select date",
  disabled = false,
  required = false,
  isDark = false,
  error,
  className,
  theme,
}: CalendarPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Active viewing month in calendar
  const initialDate = React.useMemo(() => {
    const parsed = parseYMD(value) || parseYMD(minDate || "");
    if (parsed) return new Date(parsed.year, parsed.month, 1);
    return new Date();
  }, [value, minDate]);

  const [viewDate, setViewDate] = React.useState<Date>(initialDate);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sync viewing month when selected date value changes
  React.useEffect(() => {
    const parsed = parseYMD(value);
    if (parsed) {
      setViewDate(new Date(parsed.year, parsed.month, 1));
    }
  }, [value]);

  // Click outside listener to close dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation (Escape closes)
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Build 35 or 42 grid cells for current month view
  const calendarCells = React.useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
      isOpenClinic: boolean;
    }> = [];

    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled: true, // Outside current month
        isOpenClinic: false,
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = dateStr === value;
      const isToday = dateStr === todayStr;

      // Min / Max constraints
      let isDisabled = false;
      if (minDate && dateStr < minDate) isDisabled = true;
      if (maxDate && dateStr > maxDate) isDisabled = true;

      // Clinic schedule check if bookingDays passed
      const bookingOpt = bookingDays.find((b) => b.dateStr === dateStr);
      const isOpenClinic = bookingOpt ? bookingOpt.isOpen : true;
      if (bookingOpt && !bookingOpt.isOpen) {
        isDisabled = true;
      }

      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday,
        isSelected,
        isDisabled,
        isOpenClinic,
      });
    }

    // Trailing days from next month
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled: true,
        isOpenClinic: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, minDate, maxDate, bookingDays]);

  const handleSelectDate = (dateStr: string, isDisabled: boolean) => {
    if (isDisabled || disabled) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const primaryColor = theme?.primary || "#1a76d1";
  const primaryLightColor = theme?.primaryLight || "#60a5fa";

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {/* Trigger Button: Formatted identically to PhoneInput */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between rounded-xl border transition-all h-10 shadow-2xs select-none",
          "focus:outline-hidden focus:ring-2 focus:ring-[var(--theme-primary,var(--ring))]/30 focus:border-[var(--theme-primary,var(--input))]",
          error ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-[var(--theme-card-border,var(--input))]",
          disabled && "opacity-50 pointer-events-none bg-muted",
          isOpen && "ring-2 ring-[var(--theme-primary,var(--ring))]/20"
        )}
        style={{
          backgroundColor: isDark ? (theme?.innerCardBgDark || "rgba(0, 0, 0, 0.2)") : "#ffffff",
          borderColor: isDark ? (theme?.cardBorderDark || "rgba(255, 255, 255, 0.1)") : (theme?.cardBorderLight || "#e2e8f0"),
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {/* Left Badge: Calendar Icon & Styled Separator matching PhoneInput flag badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 border-r transition-colors rounded-l-xl text-xs font-semibold shrink-0 select-none h-full",
            isDark ? "bg-white/5 border-white/10 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
          )}
        >
          <CalendarIcon
            className="h-4 w-4"
            style={{ color: isDark ? primaryLightColor : primaryColor }}
          />
        </div>

        {/* Center: Formatted Date Display */}
        <div className="flex-1 px-3 text-left overflow-hidden">
          <span
            className={cn(
              "text-xs sm:text-sm font-medium truncate block",
              value
                ? (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold")
                : (isDark ? "text-slate-400" : "text-slate-500")
            )}
          >
            {value ? formatButtonDisplay(value) : placeholder}
          </span>
        </div>

        {/* Right Chevron: Matching PhoneInput ▾ indicator */}
        <div className="px-3 shrink-0 flex items-center">
          <span
            className={cn(
              "text-xs text-muted-foreground/80 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Hidden input for HTML form submission compatibility */}
      <input type="hidden" name="preferredDate" value={value} required={required} />

      {/* Modern Popover Calendar Dialog */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-[295px] sm:w-[320px] rounded-2xl border shadow-2xl p-3.5 transition-all duration-200 animate-in fade-in-0 zoom-in-95",
            isDark
              ? "bg-slate-900/95 border-slate-700/80 text-white shadow-black/80 backdrop-blur-md"
              : "bg-white border-slate-200 text-slate-900 shadow-slate-300/60 backdrop-blur-md"
          )}
        >
          {/* Calendar Header with Month/Year & Navigation Controls */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <Sparkles
                className="h-3.5 w-3.5"
                style={{ color: isDark ? primaryLightColor : primaryColor }}
              />
              <h4 className="text-xs sm:text-sm font-bold tracking-tight">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h4>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors focus:outline-hidden",
                  isDark
                    ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                    : "border-slate-200 hover:bg-slate-100 text-slate-600"
                )}
                aria-label="Previous Month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors focus:outline-hidden",
                  isDark
                    ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                    : "border-slate-200 hover:bg-slate-100 text-slate-600"
                )}
                aria-label="Next Month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((name) => (
              <span
                key={name}
                className={cn(
                  "text-[10px] font-semibold tracking-wider py-0.5",
                  isDark ? "text-slate-400" : "text-slate-500"
                )}
              >
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              const isCellSelected = cell.isSelected;
              const isCellDisabled = cell.isDisabled;
              const isCellToday = cell.isToday;

              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  type="button"
                  disabled={isCellDisabled}
                  onClick={() => handleSelectDate(cell.dateStr, isCellDisabled)}
                  className={cn(
                    "relative h-8 sm:h-8.5 rounded-xl text-xs font-semibold flex items-center justify-center transition-all select-none",
                    !cell.isCurrentMonth && "opacity-25",
                    isCellDisabled && "cursor-not-allowed opacity-30 text-slate-400 line-through decoration-slate-400/50",
                    !isCellDisabled && !isCellSelected && (
                      isDark
                        ? "text-slate-100 hover:bg-white/10 hover:scale-105 active:scale-95"
                        : "text-slate-800 hover:bg-slate-100 hover:scale-105 active:scale-95"
                    ),
                    isCellToday && !isCellSelected && (
                      isDark ? "border border-blue-400/60 font-bold" : "border border-blue-500 font-bold text-blue-600"
                    ),
                    isCellSelected && "text-white font-bold shadow-md scale-105 z-10"
                  )}
                  style={
                    isCellSelected
                      ? {
                          backgroundColor: primaryColor,
                          boxShadow: `0 4px 12px ${primaryColor}40`,
                        }
                      : undefined
                  }
                  title={
                    cell.isOpenClinic
                      ? cell.isToday
                        ? "Today (Clinic Open)"
                        : "Clinic Open for Booking"
                      : "Clinic Closed / Weekly Off"
                  }
                >
                  {cell.dayNum}

                  {/* Tiny dot for clinic open availability */}
                  {!isCellSelected && cell.isCurrentMonth && !isCellDisabled && (
                    <span
                      className="absolute bottom-1 h-1 w-1 rounded-full"
                      style={{ backgroundColor: isDark ? primaryLightColor : primaryColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Guide & 1-Click Today Selector */}
          <div
            className={cn(
              "mt-3 pt-2.5 border-t flex items-center justify-between text-[11px]",
              isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span className="text-[10px] sm:text-[11px]">Today & next 3 days</span>
            </div>

            {minDate && (
              <button
                type="button"
                onClick={() => handleSelectDate(minDate, false)}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors",
                  isDark
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                )}
              >
                <Clock className="h-3 w-3" />
                <span>Today</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
