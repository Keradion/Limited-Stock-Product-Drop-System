import { Worker } from "bullmq";
import { config } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { expireReservation } from "../services/reservation-expiry.service.js";
export { expireReservation } from "../services/reservation-expiry.service.js";
export function startReservationExpiryWorker() {
    const worker = new Worker(config.reservation.expiryQueueName, async (job) => {
        await expireReservation(job.data.reservationId);
    }, {
        connection: { url: config.redis.url },
    });
    worker.on("failed", (job, error) => {
        logger.error("Reservation expiry job failed", {
            reservationId: job?.data.reservationId,
            message: error.message,
        });
    });
    return worker;
}
export async function stopReservationExpiryWorker(worker) {
    await worker.close();
}
