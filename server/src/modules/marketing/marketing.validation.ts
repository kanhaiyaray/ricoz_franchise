import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID.");
const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const marketingQuerySchema = z.object({ query: listQuery });
export const campaignParamsSchema = z.object({ params: z.object({ campaignId: objectId }) });
export const contentParamsSchema = z.object({ params: z.object({ contentId: objectId }) });
export const blogParamsSchema = z.object({ params: z.object({ blogId: objectId }) });
export const taskParamsSchema = z.object({ params: z.object({ taskId: objectId }) });
export const socialAccountParamsSchema = z.object({ params: z.object({ accountId: objectId }) });
export const conversationParamsSchema = z.object({ params: z.object({ conversationId: objectId }) });
export const providerParamsSchema = z.object({
  params: z.object({ provider: z.enum(["facebook", "instagram", "linkedin", "x"]) }),
});

export const createCampaignSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160),
    objective: z.string().trim().max(1000).optional(),
    channels: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    budget: z.number().min(0).max(100000000000).default(0),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});
export const updateCampaignSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160).optional(),
    objective: z.string().trim().max(1000).optional(),
    channels: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    budget: z.number().min(0).max(100000000000).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z.enum(["active", "completed"]).optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one campaign field to update.",
  }),
});
export const campaignReviewSchema = z.object({
  body: z.object({
    decision: z.enum(["approved", "rejected"]),
    reviewNote: z.string().trim().max(1000).optional(),
  }),
});
// BUG FIX #10/#22: allow "published" on create so admin can publish content.
export const createContentSchema = z.object({
  body: z.object({
    campaignId: objectId.optional(),
    title: z.string().trim().min(2).max(180),
    type: z.enum(["social", "email", "blog", "video", "design"]).default("social"),
    channel: z.string().trim().max(80).optional(),
    body: z.string().trim().max(10000).optional(),
    status: z.enum(["draft", "scheduled", "needs_review", "published"]).default("draft"),
    scheduledAt: z.coerce.date().optional(),
  }),
});
export const updateContentSchema = z.object({
  body: z.object({
    campaignId: objectId.optional(),
    title: z.string().trim().min(2).max(180).optional(),
    type: z.enum(["social", "email", "blog", "video", "design"]).optional(),
    channel: z.string().trim().max(80).optional(),
    body: z.string().trim().max(10000).optional(),
    status: z.enum(["draft", "scheduled", "published", "needs_review", "rejected"]).optional(),
    scheduledAt: z.coerce.date().optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one content field to update.",
  }),
});
export const createBlogSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(220),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(240),
    excerpt: z.string().trim().max(500).optional(),
    body: z.string().max(50000).optional(),
    status: z.enum(["draft", "published"]).default("draft"),
  }),
});
export const updateBlogSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(220).optional(),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(240).optional(),
    excerpt: z.string().trim().max(500).optional(),
    body: z.string().max(50000).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one blog field to update.",
  }),
});
export const createMarketingTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(2000).optional(),
    dueAt: z.coerce.date().optional(),
    assignedTo: objectId.optional(),
  }),
});
export const createSocialPostSchema = z.object({
  body: z.object({
    contentId: objectId.optional(),
    channel: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(10000),
    scheduledAt: z.coerce.date().optional(),
  }),
});
export const leadHandoffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(200).or(z.literal("")).optional(),
    phone: z.string().trim().max(30).optional(),
    company: z.string().trim().max(180).optional(),
    source: z.string().trim().max(100).default("marketing"),
    notes: z.string().trim().max(5000).optional(),
    ownerId: objectId,
  }),
});
export const socialReplySchema = z.object({
  body: z.object({ message: z.string().trim().min(1).max(5000) }),
});
