import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAppointmentCounter extends Document {
  scopeType: "DOCTOR" | "ORGANIZATION";
  scopeId: mongoose.Types.ObjectId;
  dateKey: string;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentCounterSchema = new Schema<IAppointmentCounter>(
  {
    scopeType: {
      type: String,
      enum: ["DOCTOR", "ORGANIZATION"],
      required: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

AppointmentCounterSchema.index({ scopeType: 1, scopeId: 1, dateKey: 1 }, { unique: true });

export const AppointmentCounter: Model<IAppointmentCounter> =
  mongoose.models.AppointmentCounter ||
  mongoose.model<IAppointmentCounter>("AppointmentCounter", AppointmentCounterSchema);

/**
 * Formats a Date or date string to DDMMYYYY format (e.g. 15 Nov 2026 -> "15112026")
 */
export function formatDateToDDMMYYYY(dateInput?: Date | string | null): string {
  if (!dateInput) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    // Match YYYY-MM-DD or YYYY/MM/DD
    const ymd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd && ymd[1] && ymd[2] && ymd[3]) {
      const yyyy = ymd[1];
      const mm = ymd[2].padStart(2, "0");
      const dd = ymd[3].padStart(2, "0");
      return `${dd}${mm}${yyyy}`;
    }
    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy && dmy[1] && dmy[2] && dmy[3]) {
      const dd = dmy[1].padStart(2, "0");
      const mm = dmy[2].padStart(2, "0");
      const yyyy = dmy[3];
      return `${dd}${mm}${yyyy}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      dateInput = parsed;
    } else {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = String(now.getFullYear());
      return `${dd}${mm}${yyyy}`;
    }
  }

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    // If UTC time is midnight, use UTC date parts to avoid timezone shifting
    if (
      dateInput.getUTCHours() === 0 &&
      dateInput.getUTCMinutes() === 0 &&
      dateInput.getUTCSeconds() === 0
    ) {
      const dd = String(dateInput.getUTCDate()).padStart(2, "0");
      const mm = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = String(dateInput.getUTCFullYear());
      return `${dd}${mm}${yyyy}`;
    }
    const dd = String(dateInput.getDate()).padStart(2, "0");
    const mm = String(dateInput.getMonth() + 1).padStart(2, "0");
    const yyyy = String(dateInput.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

/**
 * Atomically increments and returns the next scoped appointment ID in DDMMYYYY(Count) format.
 * E.g. for 15 Nov 2026: 151120261, 151120262, 151120263...
 * - For ONLY_DOCTOR: scoped per doctorId and dateKey.
 * - For HOSPITAL: scoped per organizationId and dateKey (shared across all hospital doctors).
 */
export async function getNextAppointmentId(scope: {
  scopeType: "DOCTOR" | "ORGANIZATION";
  scopeId: mongoose.Types.ObjectId | string;
  date?: Date | string | null;
}): Promise<string> {
  const dateKey = formatDateToDDMMYYYY(scope.date);
  const counter = await AppointmentCounter.findOneAndUpdate(
    {
      scopeType: scope.scopeType,
      scopeId: new mongoose.Types.ObjectId(scope.scopeId),
      dateKey,
    },
    {
      $inc: { seq: 1 },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
  return `${dateKey}${counter.seq}`;
}
