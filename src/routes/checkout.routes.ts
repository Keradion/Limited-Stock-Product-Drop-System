import { Router } from "express";
import { validateBody } from "../middleware/validate.js";
import { checkoutSchema } from "../schemas/checkout.schema.js";

export const checkoutRouter = Router();

checkoutRouter.post("/", validateBody(checkoutSchema), (_req, res) => {
  res.sendStatus(200);
});
