import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateQuery } from "../middleware/validate.js";
import { reservationListQuerySchema, } from "../schemas/listQuery.schema.js";
import { listReservations } from "../services/reservation.service.js";
export const reservationListRouter = Router();
reservationListRouter.get("/", validateQuery(reservationListQuerySchema), asyncHandler(async (req, res) => {
    const query = req.validatedQuery;
    const result = await listReservations(req.userId, query);
    res.status(200).json(result);
}));
