import mongoose, { Document, Schema, Model } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  type: "HOSPITAL" | "CLINIC";
  slug: string;
  about?: string;
  phone: string;
  whatsApp?: string;
  email: string;
  address: {
    street?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  workingHours?: string;
  weeklyOff?: string;
  appointmentRequired: boolean;
  specialties?: string[];
  departments?: string[];
  logo?: {
    url: string;
    publicId?: string;
  };
  buildingPhoto?: {
    url: string;
    publicId?: string;
  };
  galleryPhotos: Array<{
    url: string;
    publicId?: string;
    caption?: string;
  }>;
  selectedTheme: string;
  faviconUrl?: string;
  browserTabTitle: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["HOSPITAL", "CLINIC"],
      required: true,
      default: "HOSPITAL",
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    about: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
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
    address: {
      street: { type: String, trim: true },
      city: { type: String, required: true, trim: true, index: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, required: true, default: "India", trim: true },
    },
    workingHours: {
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
    specialties: {
      type: [String],
      default: [],
    },
    departments: {
      type: [String],
      default: [],
    },
    logo: {
      url: { type: String },
      publicId: { type: String },
    },
    buildingPhoto: {
      url: { type: String },
      publicId: { type: String },
    },
    galleryPhotos: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        caption: { type: String },
      },
    ],
    selectedTheme: {
      type: String,
      required: true,
      default: "hospital-classic",
    },
    faviconUrl: {
      type: String,
    },
    browserTabTitle: {
      type: String,
      required: true,
      default: "Hospital & Healthcare Center",
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

OrganizationSchema.index({ name: "text", about: "text" });
OrganizationSchema.index({ status: 1, type: 1 });

export const Organization: Model<IOrganization> =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);
