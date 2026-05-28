import { Queue } from "bullmq";
import { config } from "../config/env.js";
export const reservationExpiryQueue = new Queue(config.reservation.expiryQueueName, {
    connection: { url: config.redis.url },
});
export async function scheduleReservationExpiry(reservationId, delayMs) {
    await reservationExpiryQueue.add("expire-reservation", { reservationId }, {
        delay: delayMs,
        jobId: reservationId,
        removeOnComplete: true,
        removeOnFail: false,
    });
}
export async function cancelReservationExpiry(reservationId) {
    const job = await reservationExpiryQueue.getJob(reservationId);
    if (job) {
        await job.remove();
    }
}
export async function closeReservationExpiryQueue() {
    await reservationExpiryQueue.close();
}
