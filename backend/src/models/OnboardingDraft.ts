import mongoose, { Document, Schema, Model } from "mongoose";

export interface IOnboardingDraft extends Document {
  formType: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  currentStep: number;
  formData: Record<string, any>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingDraftSchema = new Schema<IOnboardingDraft>(
  {
    formType: {
      type: String,
      enum: ["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"],
      required: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    currentStep: {
      type: Number,
      required: true,
      default: 1,
    },
    formData: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatic TTL cleanup after expiry date
    },
  },
  {
    timestamps: true,
  }
);

export const OnboardingDraft: Model<IOnboardingDraft> =
  mongoose.models.OnboardingDraft ||
  mongoose.model<IOnboardingDraft>("OnboardingDraft", OnboardingDraftSchema);
