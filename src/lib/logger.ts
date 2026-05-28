import winston from "winston";
import { config } from "../config/env.js";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const consoleFormat =
  config.nodeEnv === "production"
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(colorize(), timestamp(), errors({ stack: true }), simple());

export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: { service: config.serviceName },
  transports: [new winston.transports.Console({ format: consoleFormat })],
});

export type ErrorLogContext = {
  method: string;
  path: string;
  userId?: string;
  statusCode: number;
};

export type RequestLogContext = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  ip?: string;
};

export function logRequest(context: RequestLogContext): void {
  logger.info("HTTP request", context);
}

export function logRequestError(err: unknown, context: ErrorLogContext): void {
  logger.error("Request error", {
    ...context,
    message: err instanceof Error ? err.message : "Unknown error",
    stack: err instanceof Error ? err.stack : undefined,
  });
}
