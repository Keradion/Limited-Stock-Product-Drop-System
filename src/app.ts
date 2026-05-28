import express, { type Express } from "express";
import { prisma } from "./db.js";

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", async (_req, res) => {
    let dbStatus = "unknown";
    try {
      // Execute a simple raw query to verify PostgreSQL connectivity
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch (error) {
      dbStatus = "disconnected";
    }

    const overallStatus = dbStatus === "connected" ? "ok" : "degraded";
    const statusCode = overallStatus === "ok" ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  return app;
}
