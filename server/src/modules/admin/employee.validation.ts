import { z } from "zod";

const employeeStatuses = ["available", "on_task", "unavailable"] as const;
const employeeCategories = [
  "DBA",
  "DevOps",
  "Network",
  "Frontend",
  "Cloud",
  "Backend",
] as const;

const skillList = z
  .array(z.string().trim().min(1).max(50))
  .max(20);

export const listEmployeesSchema = z.object({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    category: z.enum(employeeCategories).optional(),
  }),
});

export const employeeParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid employee ID."),
  }),
});

export const createEmployeeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    designation: z.string().trim().min(2).max(120),
    city: z.string().trim().max(100).default(""),
    status: z.enum(employeeStatuses).default("available"),
    skills: skillList.default([]),
    rating: z.number().min(1).max(5),
  }),
});

export const updateEmployeeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      designation: z.string().trim().min(2).max(120).optional(),
      city: z.string().trim().max(100).optional(),
      status: z.enum(employeeStatuses).optional(),
      skills: skillList.optional(),
      rating: z.number().min(1).max(5).optional(),
    })
    .refine((input) => Object.keys(input).length > 0, {
      message: "Provide at least one field to update.",
    }),
});

export type ListEmployeesQuery =
  z.infer<typeof listEmployeesSchema>["query"];
export type CreateEmployeeDto =
  z.infer<typeof createEmployeeSchema>["body"];
export type UpdateEmployeeDto =
  z.infer<typeof updateEmployeeSchema>["body"];
