import { z } from "zod";
import { positiveIntField, uuidField } from "./common.schema.js";

export const reserveSchema = z
  .object({
    productId: uuidField("productId"),
    quantity: positiveIntField("quantity"),
  })
  .strict();

export type ReserveInput = z.infer<typeof reserveSchema>;
