import type { Worker } from "bullmq";
import { config } from "./config/env.js";
import { prisma } from "./db.js";
import { logger } from "./lib/logger.js";
import { connectRedis, disconnectRedis } from "./redis.js";
import type { ReservationExpiryJobData } from "./queues/reservation.queue.js";

async function start() {
  // Redis must be connected before app routes load — rate limiters init their store on import.
  await connectRedis();

  const { createApp } = await import("./app.js");
  const { closeReservationExpiryQueue } = await import("./queues/reservation.queue.js");
  const {
    startReservationExpiryWorker,
    stopReservationExpiryWorker,
  } = await import("./workers/reservation.worker.js");

  let expiryWorker: Worker<ReservationExpiryJobData> | null = null;
  try {
    expiryWorker = startReservationExpiryWorker();
    logger.info("Reservation expiry worker started.");
  } catch (err) {
    logger.error(
      "Reservation expiry worker failed to start; API will run without it",
      { err },
    );
  }

  const app = createApp();
  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info(`Server running on port ${config.port}`);
  });

  async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info("Express server closed.");
      try {
        if (expiryWorker) {
          await stopReservationExpiryWorker(expiryWorker);
          logger.info("Reservation expiry worker stopped.");
        }
        await closeReservationExpiryQueue();
        logger.info("Reservation expiry queue closed.");
        await disconnectRedis();
        logger.info("Redis client disconnected.");
        await prisma.$disconnect();
        logger.info("Prisma client disconnected.");
        process.exit(0);
      } catch (err) {
        logger.error("Error during shutdown", { err });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error("Forced shutdown due to timeout.");
      process.exit(1);
    }, config.shutdownTimeoutMs);
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

start().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
