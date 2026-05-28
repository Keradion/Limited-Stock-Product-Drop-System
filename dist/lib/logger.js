import winston from "winston";
import { config } from "../config/env.js";
const { combine, timestamp, errors, json, colorize, simple } = winston.format;
const consoleFormat = config.nodeEnv === "production"
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(colorize(), timestamp(), errors({ stack: true }), simple());
export const logger = winston.createLogger({
    level: config.logLevel,
    defaultMeta: { service: config.serviceName },
    transports: [new winston.transports.Console({ format: consoleFormat })],
});
export function logRequest(context) {
    logger.info("HTTP request", context);
}
export function logRequestError(err, context) {
    logger.error("Request error", {
        ...context,
        message: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined,
    });
}
