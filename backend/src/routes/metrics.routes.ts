import { Router } from "express";

export const metricsRouter = Router();

metricsRouter.get("/", (_req, res) => {
  const memory = process.memoryUsage();

  // Basic runtime stats — extend with request/error counters later
  res.status(200).json({
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
    },
  });
});
