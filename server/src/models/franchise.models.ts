import { Document, Schema, Types, model } from "mongoose";

export const FRANCHISE_STATUSES = {
  INVITED: "invited",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  TERMINATED: "terminated",
} as const;

export type FranchiseStatus =
  (typeof FRANCHISE_STATUSES)[keyof typeof FRANCHISE_STATUSES];

export interface IFranchise extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  commissionRate: number;
  royaltyRate: number;
  monthlyTarget: number;
  maxStaff: number;
  maxTasks: number;
  territory: string;
  status: FranchiseStatus;
  createdBy: Types.ObjectId;
  adminUserId: Types.ObjectId;
  permissions: {
    viewNetworkRevenue: boolean;
    exportReports: boolean;
    addEmployeesWithoutApproval: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const franchiseSchema = new Schema<IFranchise>(
  {
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    royaltyRate: { type: Number, required: true, min: 0, max: 100 },
    monthlyTarget: { type: Number, required: true, min: 0 },
    maxStaff: { type: Number, required: true, min: 1 },
    maxTasks: { type: Number, required: true, min: 1 },
    territory: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(FRANCHISE_STATUSES),
      default: FRANCHISE_STATUSES.INVITED,
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    permissions: {
      viewNetworkRevenue: { type: Boolean, default: false },
      exportReports: { type: Boolean, default: false },
      addEmployeesWithoutApproval: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

franchiseSchema.index({ status: 1, createdAt: -1 });
franchiseSchema.index({ name: "text", ownerName: "text", email: "text" });

export const Franchise = model<IFranchise>("Franchise", franchiseSchema);
