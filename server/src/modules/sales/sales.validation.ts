import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID.");

// BUG FIX #17: z.coerce.boolean() treats the string "false" as true.
const booleanQuery = z.preprocess(
  (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  },
  z.boolean().default(false),
);

const pageQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  pipelineKey: z.string().trim().max(80).optional(),
  stage: z.string().trim().max(80).optional(),
  source: z.string().trim().max(100).optional(),
  ownerId: objectId.optional(),
  archived: booleanQuery,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const leadFields = {
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200).or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(180).optional(),
  source: z.string().trim().max(100).optional(),
  status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).optional(),
  pipelineKey: z.string().trim().min(1).max(80).optional(),
  stage: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(5000).optional(),
};

export const salesQuerySchema = z.object({ query: pageQuery });
export const salesIdParamsSchema = z.object({
  params: z.object({ leadId: objectId }),
});
export const salesActivityParamsSchema = z.object({
  params: z.object({ leadId: objectId, activityId: objectId }),
});
export const salesTaskParamsSchema = z.object({
  params: z.object({ taskId: objectId }),
});
export const salesAccountabilityParamsSchema = z.object({
  params: z.object({ id: objectId }),
});
export const salesPipelineParamsSchema = z.object({
  params: z.object({ key: z.string().trim().min(1).max(80) }),
});
export const salesLeadCreateSchema = z.object({
  body: z.object(leadFields),
});
export const salesLeadUpdateSchema = z.object({
  body: z.object(leadFields).partial().refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  }),
});
export const salesAssignSchema = z.object({
  body: z.object({ ownerId: objectId }),
});
export const salesActivitySchema = z.object({
  body: z.object({
    type: z.enum(["call", "email", "meeting", "note", "follow_up"]),
    subject: z.string().trim().min(2).max(180),
    note: z.string().trim().max(2000).optional(),
    dueAt: z.coerce.date().optional(),
  }),
});
export const salesActivityRescheduleSchema = z.object({
  body: z.object({ dueAt: z.coerce.date() }),
});
export const salesImportSchema = z.object({
  body: z.object({
    leads: z.array(z.object({
      name: z.string().trim().min(2).max(160),
      email: z.string().trim().email().max(200).or(z.literal("")).optional(),
      phone: z.string().trim().max(30).optional(),
      company: z.string().trim().max(180).optional(),
      source: z.string().trim().max(100).default("import"),
    })).min(1).max(500),
  }),
});
export const salesBulkUpdateSchema = z.object({
  body: z.object({
    leadIds: z.array(objectId).min(1).max(500),
    status: leadFields.status,
    pipelineKey: leadFields.pipelineKey,
    stage: leadFields.stage,
    source: leadFields.source,
  }).refine((value) => Object.keys(value).some((key) => key !== "leadIds"), {
    message: "Provide at least one field to update.",
  }),
});
export const salesDeletionOtpSchema = z.object({
  body: z.object({ leadIds: z.array(objectId).min(1).max(500) }),
});
export const salesDeleteSchema = z.object({
  body: z.object({
    leadIds: z.array(objectId).min(1).max(500),
    otp: z.string().trim().min(4).max(12),
  }),
});
export const salesPipelineUpdateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    stages: z.array(z.string().trim().min(1).max(80)).min(1).max(30).optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Provide a pipeline name or stages.",
  }),
});
export const salesCampaignParamsSchema = z.object({
  params: z.object({ campaignId: objectId }),
});
export const salesLeadInvoiceUpdateSchema = z.object({
  body: z.object({
    invoiceId: objectId.optional(),
    customer: z.object({
      name: z.string().trim().min(2).max(160),
      email: z.string().trim().email().max(200).or(z.literal("")).optional(),
      phone: z.string().trim().max(30).optional(),
      address: z.string().trim().max(1000).optional(),
    }).optional(),
    lineItems: z.array(z.object({
      description: z.string().trim().min(1).max(240),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(100).default(0),
    })).min(1).max(100).optional(),
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
  }).refine((value) => Object.keys(value).some((key) => key !== "invoiceId"), {
    message: "Provide at least one invoice field to update.",
  }),
});
export const salesLeadPaymentSchema = z.object({
  body: z.object({
    invoiceId: objectId.optional(),
    amount: z.number().positive().max(100000000000),
    method: z.enum(["bank_transfer", "cash", "razorpay", "other"]).default("bank_transfer"),
    reference: z.string().trim().max(120).default(""),
    note: z.string().trim().max(1000).default(""),
  }),
});
export const salesTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(2000).optional(),
    leadId: objectId.optional(),
    assignedTo: objectId.optional(),
    dueAt: z.coerce.date().optional(),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    accountability: z.boolean().default(false),
  }),
});
export const salesReportSchema = z.object({
  body: z.object({ report: z.string().trim().min(2).max(3000) }),
});
export const salesReviewSchema = z.object({
  body: z.object({
    reviewStatus: z.enum(["approved", "rejected"]),
    reviewNote: z.string().trim().max(1000).optional(),
  }),
});
export const salesCommentSchema = z.object({
  body: z.object({ text: z.string().trim().min(1).max(1000) }),
});

export type SalesListQuery = z.infer<typeof pageQuery>;
export type SalesLeadCreateInput = z.infer<typeof salesLeadCreateSchema>["body"];
