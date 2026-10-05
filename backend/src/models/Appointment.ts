import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAppointment extends Document {
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId: mongoose.Types.ObjectId;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  appointmentDate: Date;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
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
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, timeSlot: 1 });
AppointmentSchema.index({ organizationId: 1, appointmentDate: 1 });

export const Appointment: Model<IAppointment> =
  mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);
