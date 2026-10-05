import mongoose, { Document, Schema, Model } from "mongoose";
import { WebsiteType } from "@/types";

export interface ITemplate extends Document {
  templateId: string;
  name: string;
  description: string;
  supportedTypes: WebsiteType[];
  defaultThemeConfig: Record<string, unknown>;
  previewImageUrl?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    supportedTypes: [
      {
        type: String,
        enum: Object.values(WebsiteType),
      },
    ],
    defaultThemeConfig: {
      type: Schema.Types.Mixed,
      default: {},
    },
    previewImageUrl: {
      type: String,
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>("Template", TemplateSchema);
