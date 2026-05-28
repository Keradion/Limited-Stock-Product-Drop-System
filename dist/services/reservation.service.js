import { prisma } from "../db.js";
import { buildPaginatedResult, getPaginationParams } from "../lib/pagination.js";
export async function listReservations(userId, query) {
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
    return buildPaginatedResult(reservations.map((reservation) => ({
        reservationId: reservation.reservationId,
        reservationStatus: reservation.reservationStatus,
        productId: reservation.productId,
        quantity: reservation.quantity,
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
    })), total, page, limit);
}
