import mongoose, { Document, Schema, Model } from "mongoose";

export interface IPlatformConfig extends Document {
  platformDomain: string;
  platformName: string;
  supportEmail?: string;
  deletedDoctorsCount: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformConfigSchema = new Schema<IPlatformConfig>(
  {
    platformDomain: {
      type: String,
      required: true,
      default: "doczeno.vercel.app",
      trim: true,
      lowercase: true,
    },
    platformName: {
      type: String,
      required: true,
      default: "Doczeno",
      trim: true,
    },
    supportEmail: {
      type: String,
      default: "support@doczeno.vercel.app",
      trim: true,
      lowercase: true,
    },
    deletedDoctorsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformConfig: Model<IPlatformConfig> =
  mongoose.models.PlatformConfig ||
  mongoose.model<IPlatformConfig>("PlatformConfig", PlatformConfigSchema);
