import "dotenv/config";
import type { SignOptions } from "jsonwebtoken";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireIntEnv(key: string): number {
  const value = Number.parseInt(requireEnv(key), 10);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }
  return value;
}

function parseListEnv(key: string): string[] {
  return requireEnv(key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const config = {
  port: requireIntEnv("PORT"),
  nodeEnv: requireEnv("NODE_ENV"),
  logLevel: requireEnv("LOG_LEVEL"),
  serviceName: requireEnv("SERVICE_NAME"),
  requestLogSkipPaths: parseListEnv("REQUEST_LOG_SKIP_PATHS"),
  redis: {
    url: requireEnv("REDIS_URL"),
  },
  jwt: {
    secret: requireEnv("JWT_SECRET"),
    expiresIn: requireEnv("JWT_EXPIRES_IN") as SignOptions["expiresIn"],
  },
  bcryptSaltRounds: requireIntEnv("BCRYPT_SALT_ROUNDS"),
  shutdownTimeoutMs: requireIntEnv("SHUTDOWN_TIMEOUT_MS"),
  reservation: {
    ttlMs: requireIntEnv("RESERVATION_TTL_MS"),
    expiryQueueName: requireEnv("RESERVATION_EXPIRY_QUEUE_NAME"),
  },
  rateLimit: {
    login: {
      windowMs: requireIntEnv("RATE_LIMIT_LOGIN_WINDOW_MS"),
      limit: requireIntEnv("RATE_LIMIT_LOGIN_MAX"),
    },
    register: {
      windowMs: requireIntEnv("RATE_LIMIT_REGISTER_WINDOW_MS"),
      limit: requireIntEnv("RATE_LIMIT_REGISTER_MAX"),
    },
    reserve: {
      windowMs: requireIntEnv("RATE_LIMIT_RESERVE_WINDOW_MS"),
      limit: requireIntEnv("RATE_LIMIT_RESERVE_MAX"),
    },
    checkout: {
      windowMs: requireIntEnv("RATE_LIMIT_CHECKOUT_WINDOW_MS"),
      limit: requireIntEnv("RATE_LIMIT_CHECKOUT_MAX"),
    },
  },
};
