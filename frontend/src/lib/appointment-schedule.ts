/**
 * Frontend Appointment Schedule & Advance Booking Window Validator
 *
 * Enforces business rules:
 * 1. Maximum 3-day advance booking window (Today = Day 0, Day 1, Day 2, Day 3).
 *    Past dates and dates beyond 3 days are strictly prohibited.
 * 2. Clinic consultation schedule & weekly off validation:
 *    Appointments can ONLY be booked on days when the doctor/clinic is open.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayName = (typeof DAY_NAMES)[number];

const DAY_ALIASES: Record<DayName, string[]> = {
  Sunday: ["sunday", "sun", "ravivar", "ravivaar", "adityawar", "aavjo"],
  Monday: ["monday", "mon", "somwar", "somvaar"],
  Tuesday: ["tuesday", "tue", "mangalwar", "mangalvaar"],
  Wednesday: ["wednesday", "wed", "budhwar", "budhvaar"],
  Thursday: ["thursday", "thu", "guruwar", "guruvaar", "veervar"],
  Friday: ["friday", "fri", "shukrawar", "shukravaar"],
  Saturday: ["saturday", "sat", "shaniwar", "shanivaar"],
};

export interface DaySlotInfo {
  startTime: string;
  endTime: string;
}

export interface DayScheduleItem {
  day: string;
  isClosed?: boolean;
  slots?: DaySlotInfo[];
}

export interface BookingDayOption {
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  dayOfWeek: DayName;
  diffDays: number; // 0 = today, 1 = tomorrow, 2 = day after, 3 = 3 days later
  dayLabel: string;
  isOpen: boolean;
  closedReason?: string;
  formattedHours?: string;
}

export interface AppointmentDateValidationResult {
  isValid: boolean;
  errorCode?: "PAST_DATE" | "EXCEEDS_MAX_DAYS" | "CLINIC_CLOSED" | "INVALID_DATE";
  errorMessage?: string;
  diffDays?: number;
  dayOfWeek?: DayName;
  dateStr?: string;
  availableOptions?: BookingDayOption[];
}

/**
 * Normalizes input date to year, month, day.
 */
export function parseDateInputToParts(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  dateStr: string;
  dateObj: Date;
} | null {
  if (!dateInput) return null;

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const ymd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd && ymd[1] && ymd[2] && ymd[3]) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10);
      const day = parseInt(ymd[3], 10);
      const d = new Date(year, month - 1, day);
      if (isNaN(d.getTime())) return null;
      return {
        year,
        month,
        day,
        dateStr: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        dateObj: d,
      };
    }

    const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy && dmy[1] && dmy[2] && dmy[3]) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10);
      const year = parseInt(dmy[3], 10);
      const d = new Date(year, month - 1, day);
      if (isNaN(d.getTime())) return null;
      return {
        year,
        month,
        day,
        dateStr: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        dateObj: d,
      };
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    return {
      year,
      month,
      day,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dateObj: new Date(year, month - 1, day),
    };
  }

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    const year = dateInput.getFullYear();
    const month = dateInput.getMonth() + 1;
    const day = dateInput.getDate();
    return {
      year,
      month,
      day,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dateObj: new Date(year, month - 1, day),
    };
  }

  return null;
}

/**
 * Checks if a specific day of week is closed according to weeklyOff and consultation/working hours.
 */
export function isDayClosed(
  dayName: DayName,
  scheduleRaw?: string,
  weeklyOffRaw?: string
): { isClosed: boolean; reason?: string; formattedHours?: string } {
  // 1. Check weeklyOff string
  if (weeklyOffRaw && typeof weeklyOffRaw === "string" && weeklyOffRaw.trim()) {
    const normWeeklyOff = weeklyOffRaw.toLowerCase();
    const aliases = DAY_ALIASES[dayName] || [dayName.toLowerCase()];
    const matchesWeeklyOff = aliases.some((alias) =>
      new RegExp(`\\b${alias}\\b`, "i").test(normWeeklyOff)
    );
    if (matchesWeeklyOff) {
      return { isClosed: true, reason: "Weekly Off" };
    }
  }

  // 2. Check consultationHours / workingHours schedule JSON
  if (scheduleRaw && typeof scheduleRaw === "string" && scheduleRaw.trim()) {
    try {
      const parsed: DayScheduleItem[] = JSON.parse(scheduleRaw);
      if (Array.isArray(parsed)) {
        const item = parsed.find(
          (s) => s.day && s.day.toLowerCase() === dayName.toLowerCase()
        );
        if (item) {
          if (item.isClosed || !Array.isArray(item.slots) || item.slots.length === 0) {
            return { isClosed: true, reason: "Closed as per Consultation Schedule" };
          }
          const formattedHours = item.slots
            .map((slot) => `${slot.startTime} - ${slot.endTime}`)
            .join(", ");
          return { isClosed: false, formattedHours };
        }
      }
    } catch {
      const lower = scheduleRaw.toLowerCase();
      if (
        dayName === "Sunday" &&
        (lower.includes("mon - sat") ||
          lower.includes("monday - saturday") ||
          lower.includes("monday to saturday"))
      ) {
        return { isClosed: true, reason: "Closed on Sundays" };
      }
    }
  }

  // 3. Default: If no schedule and no weekly off provided, Sunday is typically weekly off
  if (!scheduleRaw && !weeklyOffRaw && dayName === "Sunday") {
    return { isClosed: true, reason: "Weekly Off (Sunday)" };
  }

  return { isClosed: false };
}

/**
 * Computes the 4 eligible days from today (Day 0 to Day 3) and their open/closed status.
 */
export function getBookingWindowDays(
  scheduleRaw?: string,
  weeklyOffRaw?: string,
  now: Date = new Date()
): BookingDayOption[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const options: BookingDayOption[] = [];

  const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let diff = 0; diff <= 3; diff++) {
    const d = new Date(year, month, day + diff);
    const dYear = d.getFullYear();
    const dMonth = d.getMonth() + 1;
    const dDay = d.getDate();
    const dayOfWeek = DAY_NAMES[d.getDay()] || "Monday";

    const dateStr = `${dYear}-${String(dMonth).padStart(2, "0")}-${String(dDay).padStart(2, "0")}`;
    const displayDate = `${String(dDay).padStart(2, "0")}/${String(dMonth).padStart(2, "0")}/${dYear}`;

    let dayLabel = `${dDay} ${monthShortNames[dMonth - 1]} (${dayOfWeek})`;
    if (diff === 0) {
      dayLabel = `Today, ${dDay} ${monthShortNames[dMonth - 1]} (${dayOfWeek})`;
    } else if (diff === 1) {
      dayLabel = `Tomorrow, ${dDay} ${monthShortNames[dMonth - 1]} (${dayOfWeek})`;
    }

    const closedCheck = isDayClosed(dayOfWeek, scheduleRaw, weeklyOffRaw);

    options.push({
      dateStr,
      displayDate,
      dayOfWeek,
      diffDays: diff,
      dayLabel,
      isOpen: !closedCheck.isClosed,
      closedReason: closedCheck.reason,
      formattedHours: closedCheck.formattedHours,
    });
  }

  return options;
}

/**
 * Validates a requested appointment booking date.
 * Enforces:
 * 1. Must be within [today, today + 3 days] (diffDays between 0 and 3).
 * 2. Clinic/doctor must be open on that date.
 */
export function validateAppointmentBookingDate(
  dateInput: Date | string,
  scheduleRaw?: string,
  weeklyOffRaw?: string,
  entityName?: string,
  now: Date = new Date()
): AppointmentDateValidationResult {
  const target = parseDateInputToParts(dateInput);
  if (!target) {
    return {
      isValid: false,
      errorCode: "INVALID_DATE",
      errorMessage: "Please select a valid appointment date (today or within the next 3 days).",
    };
  }

  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(target.year, target.month - 1, target.day);

  const diffMs = targetDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const dayOfWeek = DAY_NAMES[targetDate.getDay()] || "Monday";

  const availableOptions = getBookingWindowDays(scheduleRaw, weeklyOffRaw, now);
  const openOptions = availableOptions.filter((opt) => opt.isOpen);

  // 1. Past Date Check
  if (diffDays < 0) {
    const openDatesText = openOptions.map((o) => `${o.dayOfWeek} (${o.displayDate})`).join(", ");
    return {
      isValid: false,
      errorCode: "PAST_DATE",
      errorMessage: `Appointments cannot be booked for past dates. Please choose an upcoming date within the next 3 days.${openDatesText ? ` Available days: ${openDatesText}` : ""}`,
      diffDays,
      dayOfWeek,
      dateStr: target.dateStr,
      availableOptions,
    };
  }

  // 2. Beyond 3 Days Advance Window Check
  if (diffDays > 3) {
    const openDatesText = openOptions.map((o) => `${o.dayOfWeek} (${o.displayDate})`).join(", ");
    return {
      isValid: false,
      errorCode: "EXCEEDS_MAX_DAYS",
      errorMessage: `Per clinic booking policy, appointments can only be booked up to 3 days in advance.${openDatesText ? ` Available upcoming dates: ${openDatesText}` : ""}`,
      diffDays,
      dayOfWeek,
      dateStr: target.dateStr,
      availableOptions,
    };
  }

  // 3. Schedule / Closed Day Check
  const closedCheck = isDayClosed(dayOfWeek, scheduleRaw, weeklyOffRaw);
  if (closedCheck.isClosed) {
    const openDatesText = openOptions.map((o) => `${o.dayOfWeek} (${o.displayDate})`).join(", ");
    const namePrefix = entityName ? `${entityName}` : "Doctor / Clinic";
    return {
      isValid: false,
      errorCode: "CLINIC_CLOSED",
      errorMessage: `${namePrefix} is closed on ${dayOfWeek} (${closedCheck.reason || "Closed / Weekly Off"}).${openDatesText ? ` Available days within the 3-day booking window: ${openDatesText}.` : " Please select an open consultation day."}`,
      diffDays,
      dayOfWeek,
      dateStr: target.dateStr,
      availableOptions,
    };
  }

  return {
    isValid: true,
    diffDays,
    dayOfWeek,
    dateStr: target.dateStr,
    availableOptions,
  };
}
