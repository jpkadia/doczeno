import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAppointment extends Document {
  appointmentId: string;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId: mongoose.Types.ObjectId;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  patientEmail?: string;
  appointmentDate: Date;
  timeSlot: string;
  slotKey?: string;
  tokenNumber?: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "PATIENT_NOT_COME";
  notes: string;
  source?: string;
  cancelledByRole?: string | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    appointmentId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientAge: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },
    patientPhone: {
      type: String,
      required: true,
      trim: true,
    },
    patientEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    slotKey: {
      type: String,
      trim: true,
      index: true,
    },
    tokenNumber: {
      type: Number,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "PATIENT_NOT_COME"],
      default: "PENDING",
      index: true,
    },
    notes: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["WEBSITE_FORM", "AI_CHATBOT", "SLUG_ADMIN", "WALK_IN"],
      default: "WEBSITE_FORM",
      index: true,
    },
    cancelledByRole: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

AppointmentSchema.index({ appointmentId: 1, doctorId: 1 });
AppointmentSchema.index({ appointmentId: 1, organizationId: 1 });
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, timeSlot: 1 });
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, slotKey: 1, tokenNumber: 1 });
AppointmentSchema.index({ organizationId: 1, appointmentDate: 1 });
AppointmentSchema.index({ doctorId: 1, status: 1 });
AppointmentSchema.index({ organizationId: 1, status: 1 });
AppointmentSchema.index({ doctorId: 1, createdAt: -1 });
AppointmentSchema.index({ organizationId: 1, createdAt: -1 });

export const Appointment: Model<IAppointment> =
  mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);
