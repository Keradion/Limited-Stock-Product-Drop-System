import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { cancelReservationExpiry } from "../queues/reservation.queue.js";

export type CheckoutResult = {
  orderId: string;
  reservationId: string;
  orderStatus: string;
};

export async function checkoutReservation(
  userId: string,
  reservationId: string,
): Promise<CheckoutResult> {
  // Stage 1: Load reservation and validate ownership and state
  const reservation = await prisma.reservation.findUnique({
    where: { reservationId },
  });

  if (!reservation || reservation.userId !== userId) {
    throw new AppError("Reservation not found", 404);
  }

  if (reservation.reservationStatus === "COMPLETED") {
    throw new AppError("Reservation already completed", 409);
  }

  if (reservation.reservationStatus === "EXPIRED") {
    throw new AppError("Reservation expired", 410);
  }

  if (reservation.reservationStatus !== "PENDING") {
    throw new AppError("Reservation is not active", 409);
  }

  if (reservation.expiresAt <= new Date()) {
    throw new AppError("Reservation expired", 410);
  }

  // Stage 2: Atomically complete reservation, deduct stock, and create order
  const order = await prisma.$transaction(async (tx) => {
    const completed = await tx.reservation.updateMany({
      where: {
        reservationId,
        userId,
        reservationStatus: "PENDING",
        expiresAt: { gt: new Date() },
      },
      data: { reservationStatus: "COMPLETED" },
    });

    if (completed.count === 0) {
      throw new AppError("Reservation is no longer available", 409);
    }

    const stockUpdated = await tx.product.updateMany({
      where: {
        productId: reservation.productId,
        productStock: { gte: reservation.quantity },
      },
      data: { productStock: { decrement: reservation.quantity } },
    });

    if (stockUpdated.count === 0) {
      throw new AppError("Insufficient stock", 409);
    }

    await tx.inventoryLog.create({
      data: {
        productId: reservation.productId,
        inventoryReason: `Checkout completed: ${reservationId}, quantity ${reservation.quantity}`,
      },
    });

    return tx.order.create({
      data: {
        userId: reservation.userId,
        productId: reservation.productId,
        reservationId,
        orderStatus: "PAID",
      },
    });
  });

  // Stage 3: Remove pending expiry job — stock is permanently sold
  await cancelReservationExpiry(reservationId);

  return {
    orderId: order.orderId,
    reservationId: order.reservationId,
    orderStatus: order.orderStatus,
  };
}
