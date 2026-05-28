import { prisma } from "../db.js";
import { buildPaginatedResult, getPaginationParams } from "../lib/pagination.js";
export async function listOrders(userId, query) {
    const { page, limit, sortBy, sortOrder, status, productId } = query;
    const { skip, take } = getPaginationParams(page, limit);
    const where = {
        userId,
        ...(status && { orderStatus: status }),
        ...(productId && { productId }),
    };
    const [total, orders] = await prisma.$transaction([
        prisma.order.count({ where }),
        prisma.order.findMany({
            where,
            skip,
            take,
            orderBy: { [sortBy]: sortOrder },
            select: {
                orderId: true,
                orderStatus: true,
                productId: true,
                reservationId: true,
                createdAt: true,
            },
        }),
    ]);
    return buildPaginatedResult(orders.map((order) => ({
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        productId: order.productId,
        reservationId: order.reservationId,
        createdAt: order.createdAt.toISOString(),
    })), total, page, limit);
}
