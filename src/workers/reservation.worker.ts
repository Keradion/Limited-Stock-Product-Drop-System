import { Worker } from "bullmq";
import { config } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { releaseStock } from "../lib/inventory.js";
import { prisma } from "../db.js";
import type { ReservationExpiryJobData } from "../queues/reservation.queue.js";

async function expireReservation(reservationId: string): Promise<void> {
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

export function startReservationExpiryWorker(): Worker<ReservationExpiryJobData> {
  const worker = new Worker<ReservationExpiryJobData>(
    config.reservation.expiryQueueName,
    async (job) => {
      await expireReservation(job.data.reservationId);
    },
    {
      connection: { url: config.redis.url },
    },
  );

  worker.on("failed", (job, error) => {
    logger.error("Reservation expiry job failed", {
      reservationId: job?.data.reservationId,
      message: error.message,
    });
  });

  return worker;
}

export async function stopReservationExpiryWorker(
  worker: Worker<ReservationExpiryJobData>,
): Promise<void> {
  await worker.close();
}
