import { config } from "../config/env.js";
import { logRequest } from "../lib/logger.js";
export function requestLogger(req, res, next) {
    // Skip noisy paths like health checks
    if (config.requestLogSkipPaths.includes(req.path)) {
        next();
        return;
    }
    const start = Date.now();
    // Log after response is sent so status code and duration are accurate
    res.on("finish", () => {
        logRequest({
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            userId: req.userId,
            ip: req.ip,
        });
    });
    next();
}
