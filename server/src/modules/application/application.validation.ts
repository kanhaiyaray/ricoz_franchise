import { z } from "zod";
import { emailSchema } from "../auth/auth.validation.js";

const investmentRanges = [
  "Below ₹5 Lakhs",
  "₹5-10 Lakhs",
  "₹10-25 Lakhs",
  "₹25-50 Lakhs",
  "Above ₹50 Lakhs",
] as const;

const formNumber = z
  .union([z.number(), z.string().trim().min(1).regex(/^\d+(\.\d+)?$/)])
  .transform(Number);

export const submitApplicationSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(120),
    mobile: z.string().trim().regex(/^\d{10,15}$/),
    email: emailSchema,
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    occupation: z.enum([
      "Business Owner",
      "Working Professional",
      "Entrepreneur",
      "Retired",
      "Other",
    ]),
    investment: z.enum(investmentRanges),
    reason: z.string().trim().max(3000).default(""),
    termsAccepted: z.enum(["on", "true"]),
    verificationConsent: z.enum(["on", "true"]),
    aadhaarNumber: z.string().regex(/^\d{12}$/),
    panNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/),
    accountHolder: z.string().trim().min(2).max(120),
    bankName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().regex(/^\d{6,18}$/),
    ifscCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  }),
});

export const listApplicationsSchema = z.object({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    status: z
      .enum(["pending_review", "approved", "rejected"])
      .optional(),
  }),
});

export const rejectApplicationSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(500).default(""),
  }),
});

export const approveApplicationSchema = z.object({
  body: z.object({
    franchiseName: z.string().trim().min(2).max(120),
    adminName: z.string().trim().min(2).max(120),
    adminEmail: emailSchema,
    address: z.string().trim().min(3).max(300),
    pincode: z.string().trim().min(4).max(12),
    commissionRate: formNumber.pipe(z.number().min(0).max(100)),
    royaltyRate: formNumber.pipe(z.number().min(0).max(100)),
    monthlyTarget: formNumber.pipe(z.number().min(0)),
    maxStaff: formNumber.pipe(z.number().int().min(1).max(100000)),
    maxTasks: formNumber.pipe(z.number().int().min(1).max(1000000)),
    territory: z.string().trim().max(120).default(""),
  }),
});

export type SubmitApplicationDto =
  z.infer<typeof submitApplicationSchema>["body"];
export type ListApplicationsQuery =
  z.infer<typeof listApplicationsSchema>["query"];
export type ApproveApplicationDto =
  z.infer<typeof approveApplicationSchema>["body"];
