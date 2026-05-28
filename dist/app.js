import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import { prisma } from "./db.js";
import { redis } from "./redis.js";
import { reserveRouter } from "./routes/reserve.routes.js";
import { checkoutRouter } from "./routes/checkout.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { productRouter } from "./routes/products.routes.js";
import { reservationListRouter } from "./routes/reservations.routes.js";
import { orderRouter } from "./routes/orders.routes.js";
import { metricsRouter } from "./routes/metrics.routes.js";
import { authenticate } from "./middleware/auth.js";
import { handleInvalidJson, errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { checkoutLimiter, reserveLimiter } from "./middleware/rateLimit.js";
export function createApp() {
    const app = express();
    app.use(cors({
        origin: config.corsOrigin,
        credentials: true,
    }));
    app.use(express.json());
    app.use(handleInvalidJson);
    app.use(requestLogger);
    app.get("/health", async (_req, res) => {
        let dbStatus = "unknown";
        let redisStatus = "unknown";
        try {
            await prisma.$queryRaw `SELECT 1`;
            dbStatus = "connected";
        }
        catch {
            dbStatus = "disconnected";
        }
        try {
            const pong = await redis.ping();
            redisStatus = pong === "PONG" ? "connected" : "disconnected";
        }
        catch {
            redisStatus = "disconnected";
        }
        const overallStatus = dbStatus === "connected" && redisStatus === "connected" ? "ok" : "degraded";
        const statusCode = overallStatus === "ok" ? 200 : 503;
        res.status(statusCode).json({
            status: overallStatus,
            database: dbStatus,
            redis: redisStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });
    // Process metrics for monitoring tools
    app.use("/metrics", metricsRouter);
    app.use("/api/auth", authRouter);
    app.use("/api/products", productRouter);
    app.use("/api/reservations", authenticate, reservationListRouter);
    app.use("/api/orders", authenticate, orderRouter);
    app.use("/api/reserve", authenticate, reserveLimiter, reserveRouter);
    app.use("/api/checkout", authenticate, checkoutLimiter, checkoutRouter);
    app.use(errorHandler);
    return app;
}
