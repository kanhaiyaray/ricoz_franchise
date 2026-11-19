import { Document, Schema, Types, model } from "mongoose";

export const APPLICATION_STATUSES = {
  PENDING: "pending_review",
  APPROVING: "approving",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];

export type ApplicationDocumentKind = "aadhaar" | "pan" | "bank_statement";

export type EncryptedApplicationValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export type ApplicationDocument = {
  kind: ApplicationDocumentKind;
  gridFsId: Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  iv: string;
  authTag: string;
};

export interface IFranchiseApplication extends Document {
  _id: Types.ObjectId;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  occupation: string;
  investment: string;
  reason: EncryptedApplicationValue;
  termsAccepted: boolean;
  aadhaarNumber: EncryptedApplicationValue;
  panNumber: EncryptedApplicationValue;
  accountHolder: EncryptedApplicationValue;
  bankName: EncryptedApplicationValue;
  accountNumber: EncryptedApplicationValue;
  ifscCode: EncryptedApplicationValue;
  documents: ApplicationDocument[];
  status: ApplicationStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  approvedFranchiseId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const encryptedValueSchema = new Schema<EncryptedApplicationValue>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false },
);

const applicationDocumentSchema = new Schema<ApplicationDocument>(
  {
    kind: {
      type: String,
      enum: ["aadhaar", "pan", "bank_statement"],
      required: true,
    },
    gridFsId: { type: Schema.Types.ObjectId, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false },
);

const franchiseApplicationSchema = new Schema<IFranchiseApplication>(
  {
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    occupation: { type: String, required: true, trim: true },
    investment: { type: String, required: true, trim: true },
    reason: { type: encryptedValueSchema, required: true },
    termsAccepted: { type: Boolean, required: true },
    aadhaarNumber: { type: encryptedValueSchema, required: true },
    panNumber: { type: encryptedValueSchema, required: true },
    accountHolder: { type: encryptedValueSchema, required: true },
    bankName: { type: encryptedValueSchema, required: true },
    accountNumber: { type: encryptedValueSchema, required: true },
    ifscCode: { type: encryptedValueSchema, required: true },
    documents: { type: [applicationDocumentSchema], required: true },
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUSES),
      default: APPLICATION_STATUSES.PENDING,
      required: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    approvedFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise" },
  },
  { timestamps: true },
);

franchiseApplicationSchema.index({ status: 1, createdAt: -1 });
franchiseApplicationSchema.index({ fullName: 1, email: 1, city: 1 });

export const FranchiseApplication = model<IFranchiseApplication>(
  "FranchiseApplication",
  franchiseApplicationSchema,
);
