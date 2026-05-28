import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateQuery } from "../middleware/validate.js";
import { productListQuerySchema, type ProductListQuery } from "../schemas/listQuery.schema.js";
import {
  getProductAvailability,
  getProductById,
  listProducts,
} from "../services/product.service.js";

export const productRouter = Router();

productRouter.get(
  "/",
  validateQuery(productListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ProductListQuery;
    const result = await listProducts(query);
    res.status(200).json(result);
  }),
);

productRouter.get(
  "/:productId/availability",
  asyncHandler(async (req, res) => {
    const availability = await getProductAvailability(req.params.productId);
    res.status(200).json(availability);
  }),
);

productRouter.get(
  "/:productId",
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.productId);
    res.status(200).json(product);
  }),
);
