import { Queue } from "bullmq";
import { config } from "../config/env.js";

export type ReservationExpiryJobData = {
  reservationId: string;
};

export const reservationExpiryQueue = new Queue<ReservationExpiryJobData>(
  config.reservation.expiryQueueName,
  {
    connection: { url: config.redis.url },
  },
);

export async function scheduleReservationExpiry(
  reservationId: string,
  delayMs: number,
): Promise<void> {
  await reservationExpiryQueue.add(
    "expire-reservation",
    { reservationId },
    {
      delay: delayMs,
      jobId: reservationId,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}

export async function cancelReservationExpiry(reservationId: string): Promise<void> {
  const job = await reservationExpiryQueue.getJob(reservationId);
  if (job) {
    await job.remove();
  }
}

export async function closeReservationExpiryQueue(): Promise<void> {
  await reservationExpiryQueue.close();
}
