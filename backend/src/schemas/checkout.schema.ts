import { z } from "zod";
import { uuidField } from "./common.schema.js";

export const checkoutSchema = z
  .object({
    reservationId: uuidField("reservationId"),
  })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutSchema>;
