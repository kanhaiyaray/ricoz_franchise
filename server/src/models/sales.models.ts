import { Schema, Types, model } from "mongoose";

export const SALES_LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;

const leadActivitySchema = new Schema(
  {
    type: { type: String, enum: ["call", "email", "meeting", "note", "follow_up"], required: true },
    subject: { type: String, required: true, trim: true, maxlength: 180 },
    note: { type: String, default: "", trim: true, maxlength: 2000 },
    dueAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const salesLeadSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    company: { type: String, default: "", trim: true, maxlength: 180 },
    source: { type: String, default: "manual", trim: true, maxlength: 100 },
    status: { type: String, enum: SALES_LEAD_STATUSES, default: "new" },
    pipelineKey: { type: String, default: "default", trim: true, maxlength: 80 },
    stage: { type: String, default: "New", trim: true, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "", trim: true, maxlength: 5000 },
    archivedAt: { type: Date },
    imported: { type: Boolean, default: false },
    activities: { type: [leadActivitySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
salesLeadSchema.index({ franchiseId: 1, archivedAt: 1, status: 1, updatedAt: -1 });
salesLeadSchema.index({ franchiseId: 1, ownerId: 1, status: 1 });
salesLeadSchema.index({ franchiseId: 1, email: 1 });

const salesPipelineSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    key: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    stages: { type: [String], required: true, validate: (stages: string[]) => stages.length > 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
salesPipelineSchema.index({ franchiseId: 1, key: 1 }, { unique: true });

const salesTaskSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    leadId: { type: Schema.Types.ObjectId, ref: "SalesLead" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueAt: { type: Date },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    status: { type: String, enum: ["open", "completed", "cancelled"], default: "open" },
    accountability: { type: Boolean, default: false },
    report: { type: String, default: "", trim: true, maxlength: 3000 },
    reviewStatus: { type: String, enum: ["not_submitted", "pending", "approved", "rejected"], default: "not_submitted" },
    reviewNote: { type: String, default: "", trim: true, maxlength: 1000 },
    comments: [{
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      text: { type: String, required: true, trim: true, maxlength: 1000 },
      createdAt: { type: Date, default: Date.now },
    }],
    completedAt: { type: Date },
  },
  { timestamps: true },
);
salesTaskSchema.index({ franchiseId: 1, assignedTo: 1, status: 1, dueAt: 1 });

const salesCampaignSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    channel: { type: String, enum: ["email", "whatsapp"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    templateId: { type: String, default: "" },
    status: { type: String, enum: ["queued", "sending", "sent", "failed"], default: "queued" },
    recipientLeadIds: [{ type: Schema.Types.ObjectId, ref: "SalesLead" }],
    externalId: { type: String, default: "" },
    error: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
salesCampaignSchema.index({ franchiseId: 1, createdAt: -1 });

const salesDeletionOtpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
salesDeletionOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SalesLead = model("SalesLead", salesLeadSchema);
export const SalesPipeline = model("SalesPipeline", salesPipelineSchema);
export const SalesTask = model("SalesTask", salesTaskSchema);
export const SalesCampaign = model("SalesCampaign", salesCampaignSchema);
export const SalesDeletionOtp = model("SalesDeletionOtp", salesDeletionOtpSchema);

export type SalesActorId = Types.ObjectId;
