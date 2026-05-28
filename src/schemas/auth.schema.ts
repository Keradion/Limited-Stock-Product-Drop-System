import { z } from "zod";
import { emailField, passwordField } from "./common.schema.js";

export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailField,
    password: z.string().min(1, { message: "password is required" }),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
