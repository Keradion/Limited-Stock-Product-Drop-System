import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { prisma } from "./db.js";
import { logger } from "./lib/logger.js";
import { connectRedis, disconnectRedis } from "./redis.js";

async function start() {
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
  });

  async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info("Express server closed.");
      try {
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
