import { z } from "zod";

// Email Schema
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid Email Address");

// Password Schema
export const passwordSchema = z
  .string()
  .trim()
  .min(8, "Password must contain 8 characters")
  // .regex(/[a-z]/, "Password must contain lowercase char")
  // .regex(/[A-Z]/, "Password must contain uppercase char")
  // .regex(/[0-9]/, "Password must contain a Number");

// OTP Schema
export const otpSchema = z
  .string()
  .trim()
  .length(6, "Otp must be of 6 chars")
  .regex(/^\d+$/, "OTP must be numeric");

// Register Schema
const registerBodySchema = z
  .object({
    name: z.string().trim().min(3, "Name must be of at least 3 characters"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
    otp: otpSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const registerSchema = z.object({
  body: registerBodySchema,
});

// Login Schema
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    portal: z.enum(["franchise", "admin"]).default("franchise"),
  }),
});

// Verify Email Schema
export const verifyEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const acceptInvitationSchema = z.object({
  body: z
    .object({
      token: z.string().trim().min(32).max(256),
      password: passwordSchema,
      confirmPassword: passwordSchema,
    })
    .refine((input) => input.password === input.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match",
    }),
});

export type RegisterDto = z.infer<typeof registerSchema>["body"];
export type LoginDto = z.infer<typeof loginSchema>["body"];
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>["body"];
