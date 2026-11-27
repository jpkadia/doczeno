import mongoose from "mongoose";
import {
  Appointment,
  IAppointment,
  Doctor,
  Organization,
  SlotCounter,
  getNextAppointmentId,
} from "@/models";
import {
  DAY_NAMES,
  DayScheduleItem,
  DaySlotInfo,
  getISTDateParts,
  isDayClosed,
  parseDateInputToParts,
  validateAppointmentBookingDate,
} from "./appointment-schedule.service";
import { logAuditEvent } from "./audit.service";

export interface ResolvedSlotOption {
  slotKey: string;
  startTime: string;
  endTime: string;
  displayLabel: string;
  maxPatients: number | null;
  bookedCount: number;
  remainingSeats: number | null;
  isFull: boolean;
  currentServingToken: number;
  lastTokenNumber: number;
}

export interface BookAppointmentInput {
  doctorId?: string | null;
  organizationId?: string | null;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  patientEmail?: string;
  appointmentDate: Date | string;
  timeSlot?: string;
  notes: string;
  source?: "WEBSITE_FORM" | "AI_CHATBOT" | "SLUG_ADMIN" | "WALK_IN" | string;
}

export interface BookAppointmentResult {
  appointment: IAppointment;
  appointmentId: string;
  tokenNumber: number;
  slotKey: string;
  timeSlot: string;
  dateKey: string;
  maxPatients: number | null;
  bookedCount: number;
  remainingSeats: number | null;
}

export interface AppointmentLiveQueueInfo {
  tokenNumber: number | null;
  slotKey: string;
  slotLabel: string;
  currentServingToken: number;
  patientsAhead: number;
  isYourTurn: boolean;
  isNext: boolean;
  queueMessage: string;
}

/**
 * Normalizes any Date or YYYY-MM-DD string into canonical "YYYY-MM-DD".
 * Handles UTC-midnight Dates consistently across IST and UTC servers.
 */
export function normalizeDateKey(dateInput?: Date | string | null): string {
  if (!dateInput) {
    return getISTDateParts(new Date()).dateStr;
  }
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const ymd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd && ymd[1] && ymd[2] && ymd[3]) {
      return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    }
    const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy && dmy[1] && dmy[2] && dmy[3]) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
    const parsed = parseDateInputToParts(trimmed);
    if (parsed) return parsed.dateStr;
  }
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    if (
      dateInput.getUTCHours() === 0 &&
      dateInput.getUTCMinutes() === 0 &&
      dateInput.getUTCSeconds() === 0
    ) {
      const y = dateInput.getUTCFullYear();
      const m = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dateInput.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return getISTDateParts(dateInput).dateStr;
  }
  return getISTDateParts(new Date()).dateStr;
}

function buildDateDayQueryRange(dateKey: string): { $gte: Date; $lte: Date } {
  const parts = dateKey.split("-").map((n) => parseInt(n, 10));
  const y = parts[0] || 2026;
  const m = (parts[1] || 1) - 1;
  const d = parts[2] || 1;
  // Wide 36h UTC window then exact normalizeDateKey filter catches both IST local midnights and UTC midnights cleanly
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - 6 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) + 6 * 60 * 60 * 1000);
  return { $gte: start, $lte: end };
}

export function formatTime24To12(time24: string): string {
  const match = time24.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !match[1] || !match[2]) return time24;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function parseTimeToMinutes(timeStr: string): number | null {
  const t = timeStr.trim().toLowerCase();
  const m12 = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (m12 && m12[1] && m12[3]) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const mer = m12[3].toLowerCase();
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    return h * 60 + min;
  }
  const m24 = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m24 && m24[1] && m24[2]) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }
  const baje = t.match(/\b(\d{1,2})\s*baje\b/i);
  if (baje && baje[1]) {
    let h = parseInt(baje[1], 10);
    if (h >= 1 && h <= 7 && /(sham|evening|rat|raat|pm)/i.test(t)) h += 12;
    else if (h >= 1 && h <= 6) h += 12; // clinic evening heuristic (1-6 baje without morning)
    return h * 60;
  }
  return null;
}

export function buildSlotKey(startTime: string, endTime: string): string {
  const s = startTime.trim();
  const e = endTime.trim();
  if (!s || !e) return "REGULAR";
  return `${s}-${e}`;
}

export function buildSlotDisplayLabel(startTime: string, endTime: string): string {
  const s = startTime.trim();
  const e = endTime.trim();
  if (!s || !e) return "Regular Consultation";
  return `${formatTime24To12(s)} - ${formatTime24To12(e)}`;
}

export function inferSlotKeyFromLabel(timeSlot?: string): string {
  const raw = (timeSlot || "").trim();
  if (!raw || raw.toLowerCase() === "regular consultation") return "REGULAR";
  const range24 = raw.match(/^(\d{1,2}:\d{2})\s*[-to]+\s*(\d{1,2}:\d{2})$/i);
  if (range24 && range24[1] && range24[2]) {
    return `${range24[1].padStart(5, "0")}-${range24[2].padStart(5, "0")}`;
  }
  return raw.toUpperCase().replace(/\s+/g, "_");
}

function createApiError(
  message: string,
  status: number,
  code: string,
  extra?: Record<string, any>
): Error {
  const err: any = new Error(message);
  err.status = status;
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

let slotCounterIndexPromise: Promise<void> | null = null;
async function ensureSlotCounterIndex(): Promise<void> {
  if (!slotCounterIndexPromise) {
    slotCounterIndexPromise = SlotCounter.init()
      .then(() => undefined)
      .catch(() => {
        slotCounterIndexPromise = null;
      });
  }
  await slotCounterIndexPromise;
}

export class AppointmentBookingService {
  /**
   * Resolves a doctor's configured slots + real-time active booking counts for a target date.
   */
  public static async resolveDoctorSlotsForDate(params: {
    doctor: any;
    org?: any;
    dateInput: Date | string;
  }): Promise<{
    dateKey: string;
    dayOfWeek: string;
    isOpen: boolean;
    closedReason?: string;
    slots: ResolvedSlotOption[];
  }> {
    const { doctor, org, dateInput } = params;
    const dateKey = normalizeDateKey(dateInput);
    const parts = dateKey.split("-").map((n) => parseInt(n, 10));
    const dateObj = new Date(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1);
    const dayOfWeek = DAY_NAMES[dateObj.getDay()] || "Monday";

    const scheduleRaw: string | undefined = doctor?.consultationHours || org?.workingHours;
    const weeklyOffRaw: string | undefined = doctor?.weeklyOff || org?.weeklyOff;

    const closedCheck = isDayClosed(dayOfWeek, scheduleRaw, weeklyOffRaw);
    if (closedCheck.isClosed) {
      return {
        dateKey,
        dayOfWeek,
        isOpen: false,
        closedReason: closedCheck.reason,
        slots: [],
      };
    }

    let rawSlots: DaySlotInfo[] = [];
    if (scheduleRaw && typeof scheduleRaw === "string" && scheduleRaw.trim()) {
      try {
        const parsed: DayScheduleItem[] = JSON.parse(scheduleRaw);
        if (Array.isArray(parsed)) {
          const dayEntry = parsed.find(
            (s) => s.day && s.day.toLowerCase() === dayOfWeek.toLowerCase()
          );
          if (dayEntry && Array.isArray(dayEntry.slots) && dayEntry.slots.length > 0) {
            rawSlots = dayEntry.slots.filter((sl) => sl.startTime && sl.endTime);
          }
        }
      } catch {
        // Non-JSON text schedule -> single Regular Consultation slot
      }
    }

    if (rawSlots.length === 0) {
      rawSlots = [{ startTime: "", endTime: "", maxPatients: null }];
    }

    const counters = await SlotCounter.find({
      doctorId: doctor._id,
      dateKey,
    }).lean();

    const counterMap = new Map<string, any>();
    for (const c of counters) {
      counterMap.set(c.slotKey, c);
    }

    const slots: ResolvedSlotOption[] = rawSlots.map((sl) => {
      const slotKey = buildSlotKey(sl.startTime, sl.endTime);
      const displayLabel = buildSlotDisplayLabel(sl.startTime, sl.endTime);
      const maxCap =
        typeof sl.maxPatients === "number" && sl.maxPatients > 0 ? Math.floor(sl.maxPatients) : null;
      const counter = counterMap.get(slotKey);
      const bookedCount = Math.max(0, Number(counter?.activeCount || 0));
      const remainingSeats = maxCap !== null ? Math.max(0, maxCap - bookedCount) : null;
      const isFull = maxCap !== null ? bookedCount >= maxCap : false;

      return {
        slotKey,
        startTime: sl.startTime || "",
        endTime: sl.endTime || "",
        displayLabel,
        maxPatients: maxCap,
        bookedCount,
        remainingSeats,
        isFull,
        currentServingToken: Number(counter?.currentServingToken || 0),
        lastTokenNumber: Number(counter?.lastTokenNumber || 0),
      };
    });

    return {
      dateKey,
      dayOfWeek,
      isOpen: true,
      slots,
    };
  }

  /**
   * Matches visitor/form/chatbot timeSlot text against the doctor's real schedule slots for that day.
   */
  public static matchRequestedSlot(
    slots: ResolvedSlotOption[],
    requestedTimeSlot?: string
  ): ResolvedSlotOption | null {
    if (!slots || slots.length === 0) return null;
    const req = (requestedTimeSlot || "").trim();
    const reqLower = req.toLowerCase();

    // 1. Exact slotKey or displayLabel match
    if (req) {
      const exact = slots.find(
        (s) =>
          s.slotKey.toLowerCase() === reqLower ||
          s.displayLabel.toLowerCase() === reqLower ||
          `${s.startTime} - ${s.endTime}`.toLowerCase() === reqLower ||
          `${s.startTime}-${s.endTime}`.toLowerCase() === reqLower
      );
      if (exact) return exact;
    }

    // 2. If only 1 slot exists and user gave generic label or blank
    if (slots.length === 1) {
      if (!req || reqLower === "regular consultation" || /(morning|afternoon|evening|any|first)/i.test(reqLower)) {
        return slots[0] || null;
      }
    }

    // 3. Generic "Regular Consultation" with multiple slots -> pick first non-full slot
    if (!req || reqLower === "regular consultation") {
      return slots.find((s) => !s.isFull) || slots[0] || null;
    }

    // 4. Specific time e.g. "10:30 AM" or "17:30" or "5 baje" -> match slot interval containing that minute
    const targetMin = parseTimeToMinutes(req);
    if (targetMin !== null) {
      const intervalMatch = slots.find((s) => {
        if (!s.startTime || !s.endTime) return false;
        const startMin = parseTimeToMinutes(s.startTime);
        const endMin = parseTimeToMinutes(s.endTime);
        if (startMin === null || endMin === null) return false;
        return targetMin >= startMin && targetMin < endMin;
      });
      if (intervalMatch) return intervalMatch;
    }

    // 5. Part-of-day keywords ("Morning" / "Afternoon" / "Evening")
    if (/(morning|subah|savare)/i.test(reqLower)) {
      const morningSlot = slots.find((s) => {
        const startMin = parseTimeToMinutes(s.startTime);
        return startMin !== null && startMin < 12 * 60;
      });
      if (morningSlot) return morningSlot;
    }
    if (/(afternoon|dopahar|bapor)/i.test(reqLower)) {
      const afternoonSlot = slots.find((s) => {
        const startMin = parseTimeToMinutes(s.startTime);
        return startMin !== null && startMin >= 12 * 60 && startMin < 17 * 60;
      });
      if (afternoonSlot) return afternoonSlot;
    }
    if (/(evening|night|sham|saanj)/i.test(reqLower)) {
      const eveningSlot = slots.find((s) => {
        const startMin = parseTimeToMinutes(s.startTime);
        return startMin !== null && startMin >= 16 * 60;
      });
      if (eveningSlot) return eveningSlot;
    }

    return null;
  }

  /**
   * Unified, atomic appointment booking path shared by Website Form, Public Chatbot,
   * Hospital Chatbot, and Doctor/Hospital Admin portals. Zero overbooking loophole.
   */
  public static async bookAppointment(
    input: BookAppointmentInput
  ): Promise<BookAppointmentResult> {
    let targetDoctorId = input.doctorId ? String(input.doctorId) : "";
    let orgDoc: any = null;

    if (input.organizationId) {
      orgDoc = await Organization.findById(input.organizationId);
      if (!orgDoc) {
        throw createApiError("Hospital / Clinic not found.", 404, "ORGANIZATION_NOT_FOUND");
      }
      if (orgDoc.status !== "ACTIVE") {
        throw createApiError("This hospital is currently inactive and cannot accept appointments.", 403, "ORGANIZATION_INACTIVE");
      }
    }

    if (!targetDoctorId && orgDoc) {
      const firstActive = await Doctor.findOne({
        organizationId: orgDoc._id,
        status: "ACTIVE",
        approvalStatus: { $nin: ["PENDING", "REJECTED"] },
      })
        .select("_id")
        .lean();
      if (firstActive) {
        targetDoctorId = firstActive._id.toString();
      }
    }

    if (!targetDoctorId || !mongoose.Types.ObjectId.isValid(targetDoctorId)) {
      throw createApiError("Doctor ID is required to schedule an appointment.", 400, "DOCTOR_REQUIRED");
    }

    const doctor = await Doctor.findById(targetDoctorId);
    if (!doctor) {
      throw createApiError("Doctor not found.", 404, "DOCTOR_NOT_FOUND");
    }
    if (doctor.status !== "ACTIVE") {
      throw createApiError(
        `Dr. ${doctor.doctorName} is currently inactive and cannot accept appointments.`,
        403,
        "DOCTOR_INACTIVE"
      );
    }

    if (doctor.organizationId && !orgDoc) {
      orgDoc = await Organization.findById(doctor.organizationId);
      if (orgDoc && orgDoc.status !== "ACTIVE") {
        throw createApiError("Parent hospital is currently inactive and cannot accept appointments.", 403, "ORGANIZATION_INACTIVE");
      }
    }

    const finalOrgId = doctor.organizationId ? doctor.organizationId : null;
    const scheduleRaw = doctor.consultationHours || orgDoc?.workingHours;
    const weeklyOffRaw = doctor.weeklyOff || orgDoc?.weeklyOff;
    const entityName = `Dr. ${doctor.doctorName}`;

    // Validate 4-day advance window & clinic schedule
    const dateCheck = validateAppointmentBookingDate(
      input.appointmentDate,
      scheduleRaw,
      weeklyOffRaw,
      entityName
    );
    if (!dateCheck.isValid) {
      throw createApiError(
        dateCheck.errorMessage || "Selected appointment date is unavailable.",
        400,
        dateCheck.errorCode || "INVALID_DATE",
        { availableOptions: dateCheck.availableOptions }
      );
    }

    const dateKey = dateCheck.dateStr || normalizeDateKey(input.appointmentDate);

    // Resolve live slots and match requested time slot
    const daySlotsResult = await this.resolveDoctorSlotsForDate({
      doctor,
      org: orgDoc,
      dateInput: dateKey,
    });

    if (!daySlotsResult.isOpen || daySlotsResult.slots.length === 0) {
      throw createApiError(
        `${entityName} has no available consultation slots on ${daySlotsResult.dayOfWeek}.`,
        400,
        "CLINIC_CLOSED"
      );
    }

    const matchedSlot = this.matchRequestedSlot(daySlotsResult.slots, input.timeSlot);
    if (!matchedSlot) {
      const openOptionsText = daySlotsResult.slots
        .filter((s) => !s.isFull)
        .map((s) =>
          s.maxPatients !== null
            ? `${s.displayLabel} (${s.remainingSeats} left)`
            : s.displayLabel
        )
        .join(", ");
      throw createApiError(
        openOptionsText
          ? `Requested time slot "${input.timeSlot || ""}" does not match Dr. ${doctor.doctorName}'s schedule. Available slots: ${openOptionsText}.`
          : `All consultation slots for Dr. ${doctor.doctorName} on ${dateKey} are full.`,
        400,
        "INVALID_SLOT",
        { availableSlots: daySlotsResult.slots }
      );
    }

    // Step A: Ensure SlotCounter unique index exists & row is upserted idempotently
    await ensureSlotCounterIndex();
    try {
      await SlotCounter.updateOne(
        {
          doctorId: doctor._id,
          dateKey,
          slotKey: matchedSlot.slotKey,
        },
        {
          $setOnInsert: {
            doctorId: doctor._id,
            organizationId: finalOrgId,
            dateKey,
            slotKey: matchedSlot.slotKey,
            slotLabel: matchedSlot.displayLabel,
            activeCount: 0,
            lastTokenNumber: 0,
            currentServingToken: 0,
          },
        },
        { upsert: true }
      );
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }

    // Step B: Atomic seat claim & token issuance — guards activeCount < maxPatients under single-doc lock
    const maxCap =
      typeof matchedSlot.maxPatients === "number" && matchedSlot.maxPatients > 0
        ? matchedSlot.maxPatients
        : null;

    const claimFilter: Record<string, any> = {
      doctorId: doctor._id,
      dateKey,
      slotKey: matchedSlot.slotKey,
    };
    if (maxCap !== null) {
      claimFilter.activeCount = { $lt: maxCap };
    }

    const claimedSlot = await SlotCounter.findOneAndUpdate(
      claimFilter,
      {
        $inc: { activeCount: 1, lastTokenNumber: 1 },
        $set: { slotLabel: matchedSlot.displayLabel, organizationId: finalOrgId },
      },
      { new: true }
    );

    if (!claimedSlot) {
      // Refresh slots to show remaining open alternatives on the same day
      const refreshed = await this.resolveDoctorSlotsForDate({ doctor, org: orgDoc, dateInput: dateKey });
      const openAlt = refreshed.slots.filter((s) => !s.isFull);
      const altText =
        openAlt.length > 0
          ? ` Available slots on ${dateKey}: ${openAlt
              .map((s) => (s.maxPatients !== null ? `${s.displayLabel} (${s.remainingSeats} left)` : s.displayLabel))
              .join(", ")}.`
          : " Please choose another open date.";
      throw createApiError(
        `Slot "${matchedSlot.displayLabel}" on ${dateKey} for Dr. ${doctor.doctorName} is FULL (capacity ${maxCap}/${maxCap}).${altText}`,
        409,
        "SLOT_FULL",
        { availableSlots: openAlt }
      );
    }

    const tokenNumber = claimedSlot.lastTokenNumber;
    const bookedCount = claimedSlot.activeCount;
    const remainingSeats = maxCap !== null ? Math.max(0, maxCap - bookedCount) : null;

    try {
      const scopeType = finalOrgId ? "ORGANIZATION" : "DOCTOR";
      const scopeId = finalOrgId || doctor._id;
      const dateParts = dateKey.split("-").map((n) => parseInt(n, 10));
      const normalizedApptDate = new Date(
        Date.UTC(dateParts[0] || 2026, (dateParts[1] || 1) - 1, dateParts[2] || 1)
      );

      const appointmentId = await getNextAppointmentId({
        scopeType,
        scopeId,
        date: normalizedApptDate,
      });

      const appointment = await Appointment.create({
        appointmentId,
        doctorId: doctor._id,
        organizationId: finalOrgId,
        patientName: input.patientName.trim(),
        patientAge: Number(input.patientAge) || 30,
        patientPhone: input.patientPhone.trim(),
        patientEmail: input.patientEmail?.trim() || undefined,
        appointmentDate: normalizedApptDate,
        timeSlot: matchedSlot.displayLabel,
        slotKey: matchedSlot.slotKey,
        tokenNumber,
        notes: input.notes.trim(),
        source: input.source || "WEBSITE_FORM",
        status: "PENDING",
      });

      return {
        appointment,
        appointmentId: appointment.appointmentId,
        tokenNumber,
        slotKey: matchedSlot.slotKey,
        timeSlot: matchedSlot.displayLabel,
        dateKey,
        maxPatients: maxCap,
        bookedCount,
        remainingSeats,
      };
    } catch (createErr) {
      // Compensating release if creation unexpectedly failed after seat claim
      await SlotCounter.updateOne(
        {
          doctorId: doctor._id,
          dateKey,
          slotKey: matchedSlot.slotKey,
          activeCount: { $gt: 0 },
        },
        { $inc: { activeCount: -1 } }
      ).catch(() => {});
      throw createErr;
    }
  }

  /**
   * Releases slot capacity atomically when an appointment is cancelled (never mutates other tickets' numbers).
   */
  public static async releaseSlotOnCancellation(
    appointment: IAppointment,
    cancelledByRole: string
  ): Promise<void> {
    const dateKey = normalizeDateKey(appointment.appointmentDate);
    const slotKey = appointment.slotKey || inferSlotKeyFromLabel(appointment.timeSlot);

    appointment.status = "CANCELLED";
    appointment.cancelledByRole = cancelledByRole;
    appointment.cancelledAt = new Date();
    await appointment.save();

    await SlotCounter.updateOne(
      {
        doctorId: appointment.doctorId,
        dateKey,
        slotKey,
        activeCount: { $gt: 0 },
      },
      { $inc: { activeCount: -1 } }
    );

    // If cancelled token happened to be currentServingToken, advance live token pointer cleanly
    if (appointment.tokenNumber) {
      const counter = await SlotCounter.findOne({
        doctorId: appointment.doctorId,
        dateKey,
        slotKey,
      }).lean();
      if (counter && counter.currentServingToken === appointment.tokenNumber) {
        const nextWaiting = await Appointment.findOne({
          doctorId: appointment.doctorId,
          slotKey,
          appointmentDate: buildDateDayQueryRange(dateKey),
          status: { $in: ["PENDING", "CONFIRMED"] },
          tokenNumber: { $gt: appointment.tokenNumber },
        })
          .sort({ tokenNumber: 1 })
          .select("tokenNumber appointmentDate")
          .lean();

        await SlotCounter.updateOne(
          { _id: counter._id },
          { $set: { currentServingToken: nextWaiting?.tokenNumber || 0 } }
        );
      }
    }
  }

  /**
   * Computes live OPD queue metrics for a specific appointment (Patient tracking + Chatbot status check).
   */
  public static async getAppointmentLiveQueueStatus(
    appt: Pick<IAppointment, "doctorId" | "appointmentDate" | "timeSlot" | "slotKey" | "tokenNumber" | "status">
  ): Promise<AppointmentLiveQueueInfo> {
    const dateKey = normalizeDateKey(appt.appointmentDate);
    const slotKey = appt.slotKey || inferSlotKeyFromLabel(appt.timeSlot);
    const slotLabel = appt.timeSlot || "Regular Consultation";
    const myToken = typeof appt.tokenNumber === "number" ? appt.tokenNumber : null;

    const counter = await SlotCounter.findOne({
      doctorId: appt.doctorId,
      dateKey,
      slotKey,
    }).lean();

    const currentServingToken = Number(counter?.currentServingToken || 0);

    if (appt.status === "CANCELLED") {
      return {
        tokenNumber: myToken,
        slotKey,
        slotLabel,
        currentServingToken,
        patientsAhead: 0,
        isYourTurn: false,
        isNext: false,
        queueMessage: "This appointment was cancelled.",
      };
    }

    if (appt.status === "COMPLETED") {
      return {
        tokenNumber: myToken,
        slotKey,
        slotLabel,
        currentServingToken,
        patientsAhead: 0,
        isYourTurn: false,
        isNext: false,
        queueMessage: "Consultation completed.",
      };
    }

    if (appt.status === "PATIENT_NOT_COME") {
      return {
        tokenNumber: myToken,
        slotKey,
        slotLabel,
        currentServingToken,
        patientsAhead: 0,
        isYourTurn: false,
        isNext: false,
        queueMessage: "Marked as patient did not arrive.",
      };
    }

    if (myToken === null) {
      return {
        tokenNumber: null,
        slotKey,
        slotLabel,
        currentServingToken,
        patientsAhead: 0,
        isYourTurn: false,
        isNext: false,
        queueMessage:
          currentServingToken > 0
            ? `Currently serving Token #${currentServingToken}.`
            : "OPD queue has not started yet.",
      };
    }

    if (currentServingToken > 0 && myToken === currentServingToken) {
      return {
        tokenNumber: myToken,
        slotKey,
        slotLabel,
        currentServingToken,
        patientsAhead: 0,
        isYourTurn: true,
        isNext: false,
        queueMessage: `It is your turn now! Token #${myToken} is currently being served.`,
      };
    }

    // Count non-cancelled / non-completed appointments strictly ahead in the same slot on that day
    const slotMatchClause =
      slotKey === "REGULAR"
        ? { $or: [{ slotKey: "REGULAR" }, { slotKey: { $exists: false } }, { timeSlot: slotLabel }] }
        : { slotKey };

    const candidatesAhead = await Appointment.find({
      doctorId: appt.doctorId,
      ...slotMatchClause,
      appointmentDate: buildDateDayQueryRange(dateKey),
      status: { $in: ["PENDING", "CONFIRMED"] },
      tokenNumber: { $lt: myToken },
    })
      .select("tokenNumber appointmentDate")
      .lean();

    const exactAhead = candidatesAhead.filter(
      (a) =>
        normalizeDateKey(a.appointmentDate) === dateKey &&
        Number(a.tokenNumber) !== currentServingToken
    );

    const patientsAhead = exactAhead.length;
    const isNext = patientsAhead === 0;

    let queueMessage = "";
    if (currentServingToken === 0) {
      queueMessage =
        patientsAhead === 0
          ? `You are #1 in line for ${slotLabel}.`
          : `OPD queue starts soon. ${patientsAhead} patient(s) ahead of you.`;
    } else if (myToken < currentServingToken) {
      queueMessage = `Queue is currently at Token #${currentServingToken}. Please check with reception immediately.`;
    } else if (isNext) {
      queueMessage = `You are Next! Currently serving Token #${currentServingToken}.`;
    } else {
      queueMessage = `Currently serving Token #${currentServingToken} — ${patientsAhead} patient(s) waiting ahead of you.`;
    }

    return {
      tokenNumber: myToken,
      slotKey,
      slotLabel,
      currentServingToken,
      patientsAhead,
      isYourTurn: false,
      isNext,
      queueMessage,
    };
  }

  /**
   * Builds live OPD queue state for Doctor / Hospital Admin console.
   */
  public static async getLiveQueueSummary(params: {
    doctorId: string;
    dateStr?: string;
    slotKey?: string;
  }) {
    const doctor = await Doctor.findById(params.doctorId).lean();
    if (!doctor) {
      throw createApiError("Doctor not found.", 404, "DOCTOR_NOT_FOUND");
    }
    const org = doctor.organizationId ? await Organization.findById(doctor.organizationId).lean() : null;
    const dateKey = normalizeDateKey(params.dateStr);

    const resolvedDay = await this.resolveDoctorSlotsForDate({
      doctor,
      org,
      dateInput: dateKey,
    });

    const dayAppts = await Appointment.find({
      doctorId: doctor._id,
      appointmentDate: buildDateDayQueryRange(dateKey),
    })
      .sort({ tokenNumber: 1, createdAt: 1 })
      .lean();

    const exactDayAppts = dayAppts.filter((a) => normalizeDateKey(a.appointmentDate) === dateKey);

    const targetSlotKey = params.slotKey
      ? params.slotKey
      : resolvedDay.slots[0]?.slotKey || "REGULAR";

    const counter = await SlotCounter.findOne({
      doctorId: doctor._id,
      dateKey,
      slotKey: targetSlotKey,
    }).lean();

    const slotAppts = exactDayAppts.filter((a) => {
      const ak = a.slotKey || inferSlotKeyFromLabel(a.timeSlot);
      return !params.slotKey ? true : ak === targetSlotKey;
    });

    const waitingList = slotAppts.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
    const completedList = slotAppts.filter((a) => a.status === "COMPLETED");
    const cancelledList = slotAppts.filter((a) => a.status === "CANCELLED");
    const noShowList = slotAppts.filter((a) => a.status === "PATIENT_NOT_COME");

    const currentServingToken = Number(counter?.currentServingToken || 0);
    const currentAppointment =
      currentServingToken > 0
        ? waitingList.find((a) => Number(a.tokenNumber) === currentServingToken) || null
        : null;

    const nextCandidate = waitingList.find(
      (a) => typeof a.tokenNumber === "number" && a.tokenNumber > currentServingToken
    ) || waitingList.find((a) => Number(a.tokenNumber) !== currentServingToken) || null;

    return {
      doctorId: doctor._id.toString(),
      doctorName: doctor.doctorName,
      dateKey,
      activeSlotKey: targetSlotKey,
      currentServingToken,
      currentPatientName: currentAppointment?.patientName || null,
      nextTokenNumber: nextCandidate?.tokenNumber || null,
      nextPatientName: nextCandidate?.patientName || null,
      waitingCount: waitingList.filter((a) => Number(a.tokenNumber) !== currentServingToken).length,
      completedCount: completedList.length,
      cancelledCount: cancelledList.length,
      noShowCount: noShowList.length,
      slots: resolvedDay.slots,
    };
  }

  /**
   * Advances Live OPD queue: completes current serving token (if still pending/confirmed)
   * and activates the next non-cancelled waiting token.
   */
  public static async callNextToken(params: {
    doctorId: string;
    dateStr?: string;
    slotKey?: string;
    completeCurrent?: boolean;
    actor?: { userId?: string; email?: string; role?: string };
  }) {
    const summaryBefore = await this.getLiveQueueSummary({
      doctorId: params.doctorId,
      dateStr: params.dateStr,
      slotKey: params.slotKey,
    });

    const { dateKey, activeSlotKey, currentServingToken } = summaryBefore;
    const doctorObjId = new mongoose.Types.ObjectId(params.doctorId);

    // 1. Mark previously serving token as COMPLETED if still open and completeCurrent !== false
    if (currentServingToken > 0 && params.completeCurrent !== false) {
      const currentAppt = await Appointment.findOne({
        doctorId: doctorObjId,
        appointmentDate: buildDateDayQueryRange(dateKey),
        status: { $in: ["PENDING", "CONFIRMED"] },
        tokenNumber: currentServingToken,
      });
      if (currentAppt && normalizeDateKey(currentAppt.appointmentDate) === dateKey) {
        currentAppt.status = "COMPLETED";
        await currentAppt.save();
      }
    }

    // 2. Pick next waiting token (strictly skipping CANCELLED / COMPLETED / PATIENT_NOT_COME)
    const dayAppts = await Appointment.find({
      doctorId: doctorObjId,
      appointmentDate: buildDateDayQueryRange(dateKey),
      status: { $in: ["PENDING", "CONFIRMED"] },
      ...(params.slotKey ? { slotKey: activeSlotKey } : {}),
    })
      .sort({ tokenNumber: 1, createdAt: 1 })
      .lean();

    const exactDayWaiting = dayAppts.filter((a) => normalizeDateKey(a.appointmentDate) === dateKey);
    const nextAppt =
      exactDayWaiting.find((a) => typeof a.tokenNumber === "number" && a.tokenNumber > currentServingToken) ||
      exactDayWaiting[0] ||
      null;

    const nextServingToken = nextAppt?.tokenNumber || 0;
    const resolvedSlotKey = nextAppt?.slotKey || activeSlotKey;

    await SlotCounter.findOneAndUpdate(
      {
        doctorId: doctorObjId,
        dateKey,
        slotKey: resolvedSlotKey,
      },
      {
        $set: { currentServingToken: nextServingToken },
        $setOnInsert: {
          doctorId: doctorObjId,
          dateKey,
          slotKey: resolvedSlotKey,
          slotLabel: nextAppt?.timeSlot || "Regular Consultation",
          activeCount: 0,
          lastTokenNumber: nextServingToken,
        },
      },
      { upsert: true }
    );

    if (params.actor?.userId) {
      await logAuditEvent({
        userId: params.actor.userId,
        userEmail: params.actor.email || "",
        userRole: (params.actor.role as any) || "ONLY_DOCTOR",
        action: "OPD_QUEUE_NEXT_CALLED",
        entityType: "Doctor",
        entityId: params.doctorId,
        doctorId: params.doctorId,
        details: { dateKey, slotKey: resolvedSlotKey, previousToken: currentServingToken, nextToken: nextServingToken },
      }).catch(() => {});
    }

    return this.getLiveQueueSummary({
      doctorId: params.doctorId,
      dateStr: dateKey,
      slotKey: params.slotKey,
    });
  }

  /**
   * Syncs Live OPD pointer if the currently serving appointment was finished manually in table.
   */
  public static async syncQueueAfterManualStatusFinish(appointment: IAppointment): Promise<void> {
    if (!appointment.tokenNumber) return;
    const dateKey = normalizeDateKey(appointment.appointmentDate);
    const slotKey = appointment.slotKey || inferSlotKeyFromLabel(appointment.timeSlot);
    const counter = await SlotCounter.findOne({
      doctorId: appointment.doctorId,
      dateKey,
      slotKey,
    }).lean();

    if (counter && counter.currentServingToken === appointment.tokenNumber) {
      const nextWaiting = await Appointment.findOne({
        doctorId: appointment.doctorId,
        slotKey,
        appointmentDate: buildDateDayQueryRange(dateKey),
        status: { $in: ["PENDING", "CONFIRMED"] },
        tokenNumber: { $gt: appointment.tokenNumber },
      })
        .sort({ tokenNumber: 1 })
        .select("tokenNumber appointmentDate")
        .lean();

      const nextToken =
        nextWaiting && normalizeDateKey(nextWaiting.appointmentDate) === dateKey
          ? Number(nextWaiting.tokenNumber || 0)
          : 0;

      await SlotCounter.updateOne(
        { _id: counter._id },
        { $set: { currentServingToken: nextToken } }
      );
    }
  }
}
