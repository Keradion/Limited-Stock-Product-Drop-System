import { z } from "zod";
export const uuidField = (field) => z.string().uuid({ message: `${field} must be a valid UUID` });
export const emailField = z.string().email({ message: "email must be valid" });
export const passwordField = z
    .string()
    .min(6, { message: "password must be at least 6 characters" });
export const positiveIntField = (field) => z.coerce
    .number({ message: `${field} must be a number` })
    .int({ message: `${field} must be an integer` })
    .positive({ message: `${field} must be greater than 0` });
