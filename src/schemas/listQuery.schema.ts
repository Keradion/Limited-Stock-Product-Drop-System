import { z } from "zod";
import { config } from "../config/env.js";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive({ message: "page must be a positive integer" }).default(1),
  limit: z.coerce
    .number()
    .int()
    .positive({ message: "limit must be a positive integer" })
    .max(config.pagination.maxPageSize, {
      message: `limit must be at most ${config.pagination.maxPageSize}`,
    })
    .default(config.pagination.defaultPageSize),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const productListQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(["productName", "productStock", "createdAt"]).default("createdAt"),
  productName: z.string().trim().min(1).optional(),
  minStock: z.coerce.number().int().nonnegative().optional(),
  maxStock: z.coerce.number().int().nonnegative().optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const reservationListQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(["createdAt", "expiresAt", "quantity"]).default("createdAt"),
  status: z.enum(["PENDING", "COMPLETED", "EXPIRED", "CANCELLED"]).optional(),
  productId: z.string().uuid({ message: "productId must be a valid UUID" }).optional(),
});

export type ReservationListQuery = z.infer<typeof reservationListQuerySchema>;

export const orderListQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(["createdAt", "orderStatus"]).default("createdAt"),
  status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
  productId: z.string().uuid({ message: "productId must be a valid UUID" }).optional(),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
