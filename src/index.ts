import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { prisma } from "./db.js";
import { connectRedis, disconnectRedis } from "./redis.js";

async function start() {
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });

  async function gracefulShutdown(signal: string) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log("Express server closed.");
      try {
        await disconnectRedis();
        console.log("Redis client disconnected.");
        await prisma.$disconnect();
        console.log("Prisma client disconnected.");
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error("Forced shutdown due to timeout.");
      process.exit(1);
    }, config.shutdownTimeoutMs);
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
