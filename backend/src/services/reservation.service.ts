import { prisma } from "../db.js";
import { buildPaginatedResult, getPaginationParams } from "../lib/pagination.js";
import type { PaginatedResult } from "../lib/pagination.js";
import type { ReservationListQuery } from "../schemas/listQuery.schema.js";

export type ReservationListItem = {
  reservationId: string;
  reservationStatus: string;
  productId: string;
  quantity: number;
  expiresAt: string;
  createdAt: string;
};

export async function listReservations(
  userId: string,
  query: ReservationListQuery,
): Promise<PaginatedResult<ReservationListItem>> {
  const { page, limit, sortBy, sortOrder, status, productId } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = {
    userId,
    ...(status && { reservationStatus: status }),
    ...(productId && { productId }),
  };

  const [total, reservations] = await prisma.$transaction([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        reservationId: true,
        reservationStatus: true,
        productId: true,
        quantity: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ]);

  return buildPaginatedResult(
    reservations.map((reservation) => ({
      reservationId: reservation.reservationId,
      reservationStatus: reservation.reservationStatus,
      productId: reservation.productId,
      quantity: reservation.quantity,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  );
}
