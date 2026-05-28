/**
 * Expiry logic extracted for Bull worker and unit tests.
 */
import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";
import { releaseStock } from "../lib/inventory.js";

export async function expireReservation(reservationId: string): Promise<void> {
  // Stage 1: Expire the reservation if still pending (safe under concurrency with checkout)
  const expired = await prisma.$transaction(async (tx) => {
    const result = await tx.reservation.updateMany({
      where: {
        reservationId,
        reservationStatus: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { reservationStatus: "EXPIRED" },
    });

    if (result.count === 0) {
      return null;
    }

    const reservation = await tx.reservation.findUnique({
      where: { reservationId },
      select: { productId: true, quantity: true },
    });

    if (!reservation) {
      return null;
    }

    // Stage 3: Log expiration event in the inventory audit trail
    await tx.inventoryLog.create({
      data: {
        productId: reservation.productId,
        inventoryReason: `Reservation expired: ${reservationId}`,
      },
    });

    return reservation;
  });

  if (!expired) {
    return;
  }

  // Stage 2: Restore held units back to the Redis available pool
  await releaseStock(expired.productId, expired.quantity);

  logger.info("Reservation expired", {
    reservationId,
    productId: expired.productId,
    quantity: expired.quantity,
  });
}
