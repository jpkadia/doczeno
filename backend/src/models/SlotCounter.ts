import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * Atomic per-(doctor, date, slot) reservation counter & Live OPD Queue state.
 * Prevents concurrent overbooking across website forms, chatbots, and admin panels.
 */
export interface ISlotCounter extends Document {
  doctorId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId | null;
  dateKey: string; // YYYY-MM-DD (IST)
  slotKey: string; // Normalized e.g. "09:00-13:00" or "REGULAR"
  slotLabel: string; // Human-readable e.g. "09:00 AM - 01:00 PM"
  activeCount: number; // Non-cancelled bookings holding seats in this slot
  lastTokenNumber: number; // Monotonically increasing issued token # for this slot/day
  currentServingToken: number; // Live OPD token currently being served
  createdAt: Date;
  updatedAt: Date;
}

const SlotCounterSchema = new Schema<ISlotCounter>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slotKey: {
      type: String,
      required: true,
      trim: true,
    },
    slotLabel: {
      type: String,
      required: true,
      trim: true,
    },
    activeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastTokenNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentServingToken: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

SlotCounterSchema.index({ doctorId: 1, dateKey: 1, slotKey: 1 }, { unique: true });
SlotCounterSchema.index({ organizationId: 1, dateKey: 1 });

export const SlotCounter: Model<ISlotCounter> =
  mongoose.models.SlotCounter ||
  mongoose.model<ISlotCounter>("SlotCounter", SlotCounterSchema);
