import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { checkoutSchema, type CheckoutInput } from "../schemas/checkout.schema.js";
import { checkoutReservation } from "../services/checkout.service.js";

export const checkoutRouter = Router();

checkoutRouter.post(
  "/",
  validateBody(checkoutSchema),
  asyncHandler(async (req, res) => {
    const { reservationId } = req.body as CheckoutInput;
    const order = await checkoutReservation(req.userId!, reservationId);
    res.status(201).json(order);
  }),
);
