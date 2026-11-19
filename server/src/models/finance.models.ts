import { Document, Schema, Types, model } from "mongoose";

export const FINANCE_PLAN_KINDS = {
  REVENUE: "revenue",
  RESOURCE: "resource",
  COST: "cost",
} as const;

export const INVOICE_STATUSES = {
  DRAFT: "draft",
  ISSUED: "issued",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

export const PAYMENT_STATUSES = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  REVERSED: "reversed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
} as const;

const financePlanSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    kind: { type: String, enum: Object.values(FINANCE_PLAN_KINDS), required: true },
    fiscalYearStart: { type: Number, required: true, min: 2000, max: 2200 },
    data: { type: Schema.Types.Mixed, required: true, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
financePlanSchema.index(
  { franchiseId: 1, kind: 1, fiscalYearStart: 1 },
  { unique: true },
);

const financeSettingsSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true, unique: true },
    currency: { type: String, default: "INR", trim: true },
    taxRate: { type: Number, default: 18, min: 0, max: 100 },
    paymentTermsDays: { type: Number, default: 30, min: 0, max: 365 },
    invoicePrefix: { type: String, default: "INV", trim: true, maxlength: 12 },
    nextInvoiceNumber: { type: Number, default: 1, min: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 240 },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    leadId: { type: Schema.Types.ObjectId, ref: "SalesLead" },
    invoiceNumber: { type: String, required: true, trim: true },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, default: "", lowercase: true, trim: true },
      phone: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
    },
    lineItems: { type: [invoiceItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    creditedAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR", trim: true },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.DRAFT,
      required: true,
    },
    dueDate: { type: Date },
    notes: { type: String, default: "", trim: true, maxlength: 2000 },
    issuedAt: { type: Date },
    cancelledAt: { type: Date },
    paymentLinkUrl: { type: String, default: "" },
    paymentLinkId: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
invoiceSchema.index({ franchiseId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ franchiseId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ leadId: 1, createdAt: -1 });

const paymentSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "FinanceInvoice" },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: "INR", trim: true },
    method: { type: String, enum: ["bank_transfer", "cash", "razorpay", "other"], default: "bank_transfer" },
    reference: { type: String, default: "", trim: true, maxlength: 120 },
    // BUG FIX #1: never default to "" — an empty string defeats `sparse: true`
    // and triggers E11000 on the 2nd manual payment. Use a partial unique index below.
    providerPaymentId: { type: String },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.PENDING,
      required: true,
    },
    proof: {
      fileName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      ciphertext: { type: String, select: false },
      iv: { type: String, select: false },
      authTag: { type: String, select: false },
      uploadedAt: { type: Date },
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    note: { type: String, default: "", trim: true, maxlength: 1000 },
    rejectionReason: { type: String, default: "", trim: true, maxlength: 1000 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    refunds: [{
      amount: { type: Number, required: true, min: 0.01 },
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
      reference: { type: String, default: "" },
      createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    reversals: [{
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
      createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
paymentSchema.index({ franchiseId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ invoiceId: 1, createdAt: -1 });
// BUG FIX #1: partial unique index on real (non-empty string) provider IDs only.
paymentSchema.index(
  { providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerPaymentId: { $type: "string", $gt: "" },
    },
  },
);

const creditNoteSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "FinanceInvoice", required: true },
    number: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    amount: { type: Number, required: true, min: 0.01 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
creditNoteSchema.index({ franchiseId: 1, number: 1 }, { unique: true });

const journalSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    entryDate: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    debitAccount: { type: String, required: true, trim: true, maxlength: 120 },
    creditAccount: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0.01 },
    reference: { type: String, default: "", trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
journalSchema.index({ franchiseId: 1, entryDate: -1 });

const eliminationSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    amount: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    decisionNote: { type: String, default: "", trim: true, maxlength: 1000 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
eliminationSchema.index({ franchiseId: 1, status: 1, createdAt: -1 });

const financeSequenceSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    nextInvoiceNumber: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
financeSequenceSchema.index({ franchiseId: 1 }, { unique: true });

const financeDeletionOtpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
financeDeletionOtpSchema.index({ userId: 1, franchiseId: 1 }, { unique: true });
financeDeletionOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FinancePlan = model("FinancePlan", financePlanSchema);
export const FinanceSettings = model("FinanceSettings", financeSettingsSchema);
export const FinanceInvoice = model("FinanceInvoice", invoiceSchema);
export const FinancePayment = model("FinancePayment", paymentSchema);
export const FinanceCreditNote = model("FinanceCreditNote", creditNoteSchema);
export const FinanceJournal = model("FinanceJournal", journalSchema);
export const FinanceElimination = model("FinanceElimination", eliminationSchema);
export const FinanceSequence = model("FinanceSequence", financeSequenceSchema);
export const FinanceDeletionOtp = model(
  "FinanceDeletionOtp",
  financeDeletionOtpSchema,
);

export type FinanceActorId = Types.ObjectId;
export type FinanceInvoiceStatus =
  (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];
export type FinancePaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
