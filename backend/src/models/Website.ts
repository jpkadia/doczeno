import mongoose, { Document, Schema, Model } from "mongoose";
import { WebsiteType } from "@/types";

export interface IWebsite extends Document {
  websiteType: WebsiteType;
  ownerType: "DOCTOR" | "ORGANIZATION";
  ownerId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  slug: string;
  templateId: string;
  publishStatus: "DRAFT" | "GENERATING" | "REVIEW" | "PUBLISHED" | "SUSPENDED";
  deactivatedByRole?: "SUPERADMIN" | "HOSPITAL_ADMIN" | null;
  seoMetadata: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
  aiContentStatus: "NONE" | "PENDING" | "APPROVED";
  customDomain?: string;
  customDomainStatus?: "NONE" | "PENDING" | "VERIFIED" | "FAILED";
  customDomainRedirect?: boolean;
  customDomainVerification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason?: string;
  }>;
  customDomainVerifiedAt?: Date | null;
  customDomainLastCheckedAt?: Date | null;
  customDomainLastError?: string | null;
  faviconUrl?: string;
  browserTabTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteSchema = new Schema<IWebsite>(
  {
    websiteType: {
      type: String,
      enum: Object.values(WebsiteType),
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ["DOCTOR", "ORGANIZATION"],
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
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
      default: null,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    templateId: {
      type: String,
      required: true,
      default: "hospital-classic",
    },
    publishStatus: {
      type: String,
      enum: ["DRAFT", "GENERATING", "REVIEW", "PUBLISHED", "SUSPENDED"],
      default: "DRAFT",
      index: true,
    },
    deactivatedByRole: {
      type: String,
      enum: ["SUPERADMIN", "HOSPITAL_ADMIN"],
      default: null,
    },
    seoMetadata: {
      title: { type: String, trim: true },
      description: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
      ogImage: { type: String },
    },
    aiContentStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED"],
      default: "NONE",
    },
    customDomain: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    customDomainStatus: {
      type: String,
      enum: ["NONE", "PENDING", "VERIFIED", "FAILED"],
      default: "NONE",
      index: true,
    },
    customDomainRedirect: {
      type: Boolean,
      default: true,
    },
    customDomainVerification: [
      {
        type: { type: String },
        domain: { type: String },
        value: { type: String },
        reason: { type: String },
      },
    ],
    customDomainVerifiedAt: {
      type: Date,
      default: null,
    },
    customDomainLastCheckedAt: {
      type: Date,
      default: null,
    },
    customDomainLastError: {
      type: String,
      default: null,
    },
    faviconUrl: {
      type: String,
      trim: true,
    },
    browserTabTitle: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

WebsiteSchema.index({ ownerId: 1, ownerType: 1 });
WebsiteSchema.index({ organizationId: 1, slug: 1 });
WebsiteSchema.index({ slug: 1, publishStatus: 1 });
WebsiteSchema.index({ doctorId: 1, organizationId: 1, publishStatus: 1 });

export const Website: Model<IWebsite> =
  mongoose.models.Website || mongoose.model<IWebsite>("Website", WebsiteSchema);
