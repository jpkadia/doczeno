import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDoctor extends Document {
  organizationId?: mongoose.Types.ObjectId | string | null;
  userId?: mongoose.Types.ObjectId | string | null;
  websiteId?: mongoose.Types.ObjectId | string | null;
  doctorName: string;
  gender: "MALE" | "FEMALE";
  degree: string;
  specialization: string;
  yearsOfExperience: number;
  whatsApp?: string;
  email: string;
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired: boolean;
  newCaseFee?: number;
  oldCaseFee?: number;
  doctorPhoto?: {
    url: string;
    publicId?: string;
  };
  clinicName?: string;
  address?: {
    street?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  clinicLogo?: {
    url: string;
    publicId?: string;
  };
  clinicPhotos?: Array<{
    url: string;
    publicId?: string;
    caption?: string;
  }>;
  bio?: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    websiteId: {
      type: Schema.Types.ObjectId,
      ref: "Website",
      default: null,
      index: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE"],
      required: true,
      default: "MALE",
    },
    degree: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    yearsOfExperience: {
      type: Number,
      required: true,
      min: 0,
    },
    whatsApp: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    consultationHours: {
      type: String,
      trim: true,
    },
    weeklyOff: {
      type: String,
      trim: true,
    },
    appointmentRequired: {
      type: Boolean,
      default: true,
    },
    newCaseFee: {
      type: Number,
      min: 0,
    },
    oldCaseFee: {
      type: Number,
      min: 0,
    },
    doctorPhoto: {
      url: { type: String },
      publicId: { type: String },
    },
    clinicName: {
      type: String,
      trim: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      country: { type: String, default: "India", trim: true },
    },
    clinicLogo: {
      url: { type: String },
      publicId: { type: String },
    },
    clinicPhotos: [
      {
        url: { type: String },
        publicId: { type: String },
        caption: { type: String },
      },
    ],
    bio: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

DoctorSchema.index({ organizationId: 1, status: 1 });
DoctorSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
DoctorSchema.index({ doctorName: "text", specialization: "text" });

export const Doctor: Model<IDoctor> =
  mongoose.models.Doctor || mongoose.model<IDoctor>("Doctor", DoctorSchema);
