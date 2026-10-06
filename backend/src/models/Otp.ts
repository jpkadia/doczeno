import mongoose, { Document, Schema, Model } from "mongoose";

export interface IOtp extends Document {
  email: string;
  otp: string;
  purpose: "ONBOARDING" | "PASSWORD_RESET";
  attempts: number;
  isVerified: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["ONBOARDING", "PASSWORD_RESET"],
      default: "ONBOARDING",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL automatic expiry
    },
  },
  {
    timestamps: true,
  }
);

export const Otp: Model<IOtp> =
  mongoose.models.Otp || mongoose.model<IOtp>("Otp", OtpSchema);
