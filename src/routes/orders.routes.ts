import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateQuery } from "../middleware/validate.js";
import { orderListQuerySchema, type OrderListQuery } from "../schemas/listQuery.schema.js";
import { listOrders } from "../services/order.service.js";

export const orderRouter = Router();

orderRouter.get(
  "/",
  validateQuery(orderListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as OrderListQuery;
    const result = await listOrders(req.userId!, query);
    res.status(200).json(result);
  }),
);
