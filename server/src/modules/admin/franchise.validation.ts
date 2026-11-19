import { z } from "zod";
import { emailSchema } from "../auth/auth.validation.js";

const franchiseFields = z.object({
  name: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().min(7).max(20),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().min(4).max(12),
  commissionRate: z.number().min(0).max(100),
  royaltyRate: z.number().min(0).max(100),
  monthlyTarget: z.number().min(0),
  maxStaff: z.number().int().min(1).max(100000),
  maxTasks: z.number().int().min(1).max(1000000),
  territory: z.string().trim().max(120).default(""),
});

export const listFranchisesSchema = z.object({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(["invited", "active", "suspended", "terminated"]).optional(),
  }),
});

export const createFranchiseSchema = z.object({
  body: franchiseFields.extend({
    adminName: z.string().trim().min(2).max(120),
    adminEmail: emailSchema,
    sendInvitation: z.boolean().default(true),
  }),
});

export const updateFranchiseSchema = z.object({
  body: franchiseFields
    .partial()
    .extend({
      territory: z.string().trim().max(120).optional(),
      permissions: z
        .object({
          viewNetworkRevenue: z.boolean().optional(),
          exportReports: z.boolean().optional(),
          addEmployeesWithoutApproval: z.boolean().optional(),
        })
        .optional(),
    }),
});

export const updateFranchiseStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "suspended", "terminated"]),
  }),
});

export const createFranchiseUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    franchiseRole: z.enum(["franchise_admin", "manager", "staff"]),
  }),
});

export const attachFranchiseUserSchema = z.object({
  body: z.object({
    email: emailSchema,
    franchiseRole: z.enum(["franchise_admin", "manager", "staff"]),
  }),
});

export const updateFranchiseUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    franchiseRole: z.enum(["franchise_admin", "manager", "staff"]).optional(),
  }).refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update.",
  }),
});

export type CreateFranchiseDto = z.infer<typeof createFranchiseSchema>["body"];
export type ListFranchisesQuery =
  z.infer<typeof listFranchisesSchema>["query"];
export type UpdateFranchiseDto = z.infer<typeof updateFranchiseSchema>["body"];
export type CreateFranchiseUserDto =
  z.infer<typeof createFranchiseUserSchema>["body"];
export type AttachFranchiseUserDto =
  z.infer<typeof attachFranchiseUserSchema>["body"];
export type UpdateFranchiseUserDto =
  z.infer<typeof updateFranchiseUserSchema>["body"];
