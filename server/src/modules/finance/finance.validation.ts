import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID.");
const yearParams = z.object({
  params: z.object({
    fiscalYearStart: z.coerce.number().int().min(2000).max(2200),
  }),
});
const monthAmounts = z.array(z.number().min(0)).length(12);

const revenuePlan = z.object({
  streams: z.array(
    z.object({
      id: z.string().trim().max(80).optional(),
      name: z.string().trim().min(1).max(120),
      category: z.string().trim().max(80).default(""),
      monthlyAmounts: monthAmounts,
      probability: z.number().min(0).max(100).default(100),
    }),
  ).max(100),
});

const resourcePlan = z.object({
  resources: z.array(
    z.object({
      id: z.string().trim().max(80).optional(),
      role: z.string().trim().min(1).max(120),
      headcount: z.number().int().min(0).max(100000),
      monthlyCost: z.number().min(0),
      allocationPercent: z.number().min(0).max(100).default(100),
    }),
  ).max(200),
});

const costPlan = z.object({
  costs: z.array(
    z.object({
      id: z.string().trim().max(80).optional(),
      category: z.string().trim().min(1).max(120),
      description: z.string().trim().max(240).default(""),
      monthlyAmounts: monthAmounts,
    }),
  ).max(200),
});

export const listFinanceQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional(),
    status: z.string().trim().max(40).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    fiscalYearStart: z.coerce.number().int().min(2000).max(2200).optional(),
  }),
});

export const financeYearParamsSchema = yearParams;

export const financePlanBodySchema = (kind: "revenue" | "resource" | "cost") =>
  z.object({
    body:
      kind === "revenue"
        ? revenuePlan
        : kind === "resource"
          ? resourcePlan
          : costPlan,
  });

export const deleteRevenueStreamsSchema = z.object({
  body: z.object({
    streamIds: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
    otp: z.string().trim().min(4).max(12),
  }),
});

export const financeSettingsSchema = z.object({
  body: z.object({
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
    invoicePrefix: z.string().trim().min(1).max(12).optional(),
    nextInvoiceNumber: z.number().int().min(1).optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one setting to update.",
  }),
});

const invoiceCustomer = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200).or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(1000).optional(),
});

const invoiceLineItems = z.array(
  z.object({
    description: z.string().trim().min(1).max(240),
    quantity: z.number().positive().max(100000),
    unitPrice: z.number().min(0).max(100000000000),
    taxRate: z.number().min(0).max(100).default(0),
  }),
).min(1).max(100);

export const createInvoiceSchema = z.object({
  body: z.object({
    franchiseId: objectId.optional(),
    leadId: objectId.optional(),
    customer: invoiceCustomer,
    lineItems: invoiceLineItems,
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).default(""),
  }),
});

export const createLeadInvoiceSchema = z.object({
  body: z.object({
    lineItems: invoiceLineItems,
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).default(""),
  }),
});

export const updateInvoiceSchema = z.object({
  body: z.object({
    customer: invoiceCustomer.optional(),
    lineItems: invoiceLineItems.optional(),
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  }),
});

export const invoiceParamsSchema = z.object({
  params: z.object({ invoiceId: objectId }),
});

export const leadParamsSchema = z.object({
  params: z.object({ leadId: objectId }),
});

export const emailInvoiceSchema = z.object({
  body: z.object({ email: z.string().trim().email().max(200).optional() }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    franchiseId: objectId.optional(),
    invoiceId: objectId.optional(),
    amount: z.number().positive().max(100000000000),
    method: z.enum(["bank_transfer", "cash", "razorpay", "other"]).default("bank_transfer"),
    reference: z.string().trim().max(120).default(""),
    note: z.string().trim().max(1000).default(""),
  }),
});

export const paymentParamsSchema = z.object({
  params: z.object({ paymentId: objectId }),
});

export const rejectPaymentSchema = z.object({
  body: z.object({ reason: z.string().trim().min(3).max(1000) }),
});

export const reversePaymentSchema = z.object({
  body: z.object({ reason: z.string().trim().min(3).max(1000) }),
});

export const refundPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive().max(100000000000),
    reason: z.string().trim().min(3).max(1000),
    reference: z.string().trim().max(120).default(""),
  }),
});

export const creditNoteSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3).max(1000),
    amount: z.number().positive().max(100000000000),
  }),
});

export const journalSchema = z.object({
  body: z.object({
    franchiseId: objectId.optional(),
    entryDate: z.coerce.date(),
    description: z.string().trim().min(3).max(500),
    debitAccount: z.string().trim().min(1).max(120),
    creditAccount: z.string().trim().min(1).max(120),
    amount: z.number().positive().max(100000000000),
    reference: z.string().trim().max(120).default(""),
  }),
});

export const eliminationSchema = z.object({
  body: z.object({
    franchiseId: objectId.optional(),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().max(1000).default(""),
    amount: z.number().positive().max(100000000000),
  }),
});

export const eliminationDecisionSchema = z.object({
  params: z.object({ eliminationId: objectId }),
  body: z.object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(1000).default(""),
  }),
});

export const resourceIdSchema = z.object({
  params: z.object({ invoiceId: objectId }),
});

export type FinanceListQuery = z.infer<typeof listFinanceQuerySchema>["query"];
export type FinanceInvoiceInput = z.infer<typeof createInvoiceSchema>["body"];
export type FinancePlanKind = "revenue" | "resource" | "cost";
