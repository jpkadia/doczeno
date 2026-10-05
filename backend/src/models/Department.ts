import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDepartment extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  icon?: string;
  headDoctorId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
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
      trim: true,
    },
    icon: {
      type: String,
    },
    headDoctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Department: Model<IDepartment> =
  mongoose.models.Department ||
  mongoose.model<IDepartment>("Department", DepartmentSchema);
