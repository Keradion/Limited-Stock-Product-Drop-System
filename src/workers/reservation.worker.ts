import { Worker } from "bullmq";
import { config } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { releaseStock } from "../lib/inventory.js";
import { prisma } from "../db.js";
import type { ReservationExpiryJobData } from "../queues/reservation.queue.js";

async function expireReservation(reservationId: string): Promise<void> {
  // Stage 1: Mark reservation expired only if it is still pending (safe under concurrency)
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

    return tx.reservation.findUnique({
      where: { reservationId },
      select: { productId: true, quantity: true },
    });
  });

  if (!expired) {
    return;
  }

  // Stage 2: Return held units to the Redis available pool
  await releaseStock(expired.productId, expired.quantity);

  logger.info("Reservation expired", { reservationId });
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
