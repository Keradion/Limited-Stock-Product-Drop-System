import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { reserveSchema, type ReserveInput } from "../schemas/reserve.schema.js";
import { createReservation } from "../services/reserve.service.js";

export const reserveRouter = Router();

reserveRouter.post(
  "/",
  validateBody(reserveSchema),
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body as ReserveInput;

    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const reservation = await createReservation(req.userId, productId, quantity);

    res.status(201).json(reservation);
  }),
);
