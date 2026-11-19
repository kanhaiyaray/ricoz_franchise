import { Schema, model, Document, Types } from "mongoose";

export const USER_ROLES = {
  ADMIN: "admin",
  FRANCHISE: "franchise",
  INVESTOR: "investor",
  CUSTOMER: "customer",
  EMPLOYEE: "employee",
  INTERN: "intern",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phoneNumber?: string;
  email: string;
  password: string;
  role: UserRole;
  franchiseId?: Types.ObjectId;
  franchiseRole?: "franchise_admin" | "manager" | "staff";
  accountStatus: "active" | "invited" | "disabled";
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
  profile_pic?: string;
  about: string;
  lastSeen: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.FRANCHISE,
      required: true,
    },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise" },
    franchiseRole: {
      type: String,
      enum: ["franchise_admin", "manager", "staff"],
    },
    accountStatus: {
      type: String,
      enum: ["active", "invited", "disabled"],
      default: "active",
      required: true,
    },
    inviteTokenHash: { type: String, select: false },
    inviteExpiresAt: { type: Date, select: false },
    profile_pic: { type: String, default: "" },
    // BUG FIX #13: was "Hey there! I am using WhatsApp Clone." (copy-paste leftover).
    about: { type: String, default: "" },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

UserSchema.index({ franchiseId: 1, role: 1 });
UserSchema.index({ inviteTokenHash: 1 }, { sparse: true });

export const User = model<IUser>("User", UserSchema);
