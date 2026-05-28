import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { getRedisAvailableStock } from "../lib/inventory.js";
import { buildPaginatedResult, getPaginationParams } from "../lib/pagination.js";
import type { PaginatedResult } from "../lib/pagination.js";
import type { ProductListQuery } from "../schemas/listQuery.schema.js";

export type ProductListItem = {
  productId: string;
  productName: string;
  productStock: number;
  createdAt: string;
};

export type ProductAvailability = {
  productId: string;
  available: number;
  productStock: number;
  soldOut: boolean;
};

export async function getProductById(productId: string): Promise<ProductListItem> {
  const product = await prisma.product.findUnique({
    where: { productId },
    select: {
      productId: true,
      productName: true,
      productStock: true,
      createdAt: true,
    },
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
  };
}

export async function getProductAvailability(productId: string): Promise<ProductAvailability> {
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { productId: true, productStock: true },
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const redisAvailable = await getRedisAvailableStock(productId);

  if (redisAvailable !== null) {
    const available = Math.max(0, redisAvailable);
    return {
      productId,
      available,
      productStock: product.productStock,
      soldOut: available === 0,
    };
  }

  const pending = await prisma.reservation.aggregate({
    where: {
      productId,
      reservationStatus: "PENDING",
      expiresAt: { gt: new Date() },
    },
    _sum: { quantity: true },
  });

  const heldQuantity = pending._sum.quantity ?? 0;
  const available = Math.max(0, product.productStock - heldQuantity);

  return {
    productId,
    available,
    productStock: product.productStock,
    soldOut: available === 0,
  };
}

export async function listProducts(
  query: ProductListQuery,
): Promise<PaginatedResult<ProductListItem>> {
  const { page, limit, sortBy, sortOrder, productName, minStock, maxStock } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = {
    ...(productName && {
      productName: { contains: productName, mode: "insensitive" as const },
    }),
    ...((minStock !== undefined || maxStock !== undefined) && {
      productStock: {
        ...(minStock !== undefined && { gte: minStock }),
        ...(maxStock !== undefined && { lte: maxStock }),
      },
    }),
  };

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        productId: true,
        productName: true,
        productStock: true,
        createdAt: true,
      },
    }),
  ]);

  return buildPaginatedResult(
    products.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  );
}
