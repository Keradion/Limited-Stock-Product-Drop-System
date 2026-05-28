import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import {
  ensureProductInventory,
  holdStock,
  releaseStock,
} from "../lib/inventory.js";
import { scheduleReservationExpiry } from "../queues/reservation.queue.js";
import { config } from "../config/env.js";

export type CreateReservationResult = {
  reservationId: string;
  expiresAt: string;
};

export async function createReservation(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CreateReservationResult> {
  // Stage 1: Confirm the product exists in the database
  const product = await prisma.product.findUnique({
    where: { productId },
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  // Stage 2: Ensure Redis available-stock counter is initialized from DB state
  await ensureProductInventory(productId, product.productStock);

  // Stage 3: Atomically hold stock in Redis to prevent overselling under concurrency
  const holdResult = await holdStock(productId, quantity);

  if (holdResult === "NOT_INITIALIZED") {
    throw new AppError("Inventory not available", 503);
  }

  if (holdResult === "INSUFFICIENT") {
    throw new AppError("Insufficient stock", 409);
  }

  const expiresAt = new Date(Date.now() + config.reservation.ttlMs);
  let reservationId: string | null = null;

  try {
    // Stage 4: Persist the reservation inside a DB transaction
    const reservation = await prisma.$transaction(async (tx) => {
      return tx.reservation.create({
        data: {
          userId,
          productId,
          quantity,
          reservationStatus: "PENDING",
          expiresAt,
        },
      });
    });

    reservationId = reservation.reservationId;

    // Stage 5: Schedule automatic expiry via Bull after the hold window
    await scheduleReservationExpiry(reservation.reservationId, config.reservation.ttlMs);

    return {
      reservationId: reservation.reservationId,
      expiresAt: reservation.expiresAt.toISOString(),
    };
  } catch (error) {
    // Compensating action: release the Redis hold if DB or queue scheduling fails
    await releaseStock(productId, quantity);

    if (reservationId) {
      await prisma.reservation.updateMany({
        where: { reservationId, reservationStatus: "PENDING" },
        data: { reservationStatus: "CANCELLED" },
      });
    }

    throw error;
  }
}
