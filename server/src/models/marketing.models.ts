import { Schema, Types, model } from "mongoose";

const marketingCampaignSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    objective: { type: String, default: "", trim: true, maxlength: 1000 },
    channels: [{ type: String, trim: true, maxlength: 40 }],
    budget: { type: Number, default: 0, min: 0 },
    spent: { type: Number, default: 0, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ["draft", "pending_review", "approved", "rejected", "active", "completed"], default: "draft" },
    reviewNote: { type: String, default: "", trim: true, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
marketingCampaignSchema.index({ franchiseId: 1, status: 1, startDate: 1 });

const marketingContentSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "MarketingCampaign" },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    type: { type: String, enum: ["social", "email", "blog", "video", "design"], default: "social" },
    channel: { type: String, default: "", trim: true, maxlength: 80 },
    body: { type: String, default: "", trim: true, maxlength: 10000 },
    status: { type: String, enum: ["draft", "scheduled", "published", "needs_review", "rejected"], default: "draft" },
    scheduledAt: { type: Date },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
marketingContentSchema.index({ franchiseId: 1, status: 1, scheduledAt: 1 });

const marketingBlogSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 240 },
    excerpt: { type: String, default: "", trim: true, maxlength: 500 },
    body: { type: String, default: "", maxlength: 50000 },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
marketingBlogSchema.index({ franchiseId: 1, slug: 1 }, { unique: true });
marketingBlogSchema.index({ status: 1, publishedAt: -1 });

const marketingTaskSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    dueAt: { type: Date },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["open", "completed"], default: "open" },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
marketingTaskSchema.index({ franchiseId: 1, assignedTo: 1, status: 1, dueAt: 1 });

const socialPostSchema = new Schema(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true },
    contentId: { type: Schema.Types.ObjectId, ref: "MarketingContent" },
    channel: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    scheduledAt: { type: Date },
    status: { type: String, enum: ["draft", "waiting_for_provider"], default: "draft" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const MarketingCampaign = model("MarketingCampaign", marketingCampaignSchema);
export const MarketingContent = model("MarketingContent", marketingContentSchema);
export const MarketingBlog = model("MarketingBlog", marketingBlogSchema);
export const MarketingTask = model("MarketingTask", marketingTaskSchema);
export const MarketingSocialPost = model("MarketingSocialPost", socialPostSchema);

export type MarketingActorId = Types.ObjectId;
