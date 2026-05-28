import express, { type Express } from "express";
import { prisma } from "./db.js";
import { redis } from "./redis.js";
import { reserveRouter } from "./routes/reserve.routes.js";
import { checkoutRouter } from "./routes/checkout.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { authenticate } from "./middleware/auth.js";
import { handleInvalidJson } from "./middleware/error.js";
import { errorLogger } from "./middleware/errorLogger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { checkoutLimiter, reserveLimiter } from "./middleware/rateLimit.js";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(handleInvalidJson);
  app.use(requestLogger);

  app.get("/health", async (_req, res) => {
    let dbStatus = "unknown";
    let redisStatus = "unknown";

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }

    try {
      const pong = await redis.ping();
      redisStatus = pong === "PONG" ? "connected" : "disconnected";
    } catch {
      redisStatus = "disconnected";
    }

    const overallStatus =
      dbStatus === "connected" && redisStatus === "connected" ? "ok" : "degraded";
    const statusCode = overallStatus === "ok" ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/reserve", authenticate, reserveLimiter, reserveRouter);
  app.use("/api/checkout", authenticate, checkoutLimiter, checkoutRouter);

  app.use(errorLogger);

  return app;
}
