import {
  rateLimit,
  ipKeyGenerator,
  type RateLimitExceededEventHandler,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request } from "express";
import { redis } from "../redis.js";

function createRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (...args: string[]) => redis.sendCommand(args),
    prefix,
  });
}

const rateLimitHandler: RateLimitExceededEventHandler = (
  _req,
  res,
  _next,
  options,
) => {
  res.status(options.statusCode).json({
    error: "Too many requests",
    retryAfter: Math.ceil(options.windowMs / 1000),
  });
};

const baseOptions = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler: rateLimitHandler,
};

function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? "unknown");
}

export const loginLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: ipKey,
  store: createRedisStore("rl:login:"),
});

export const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
  store: createRedisStore("rl:register:"),
});

export const reserveLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 3,
  keyGenerator: (req: Request) => `user:${req.userId ?? ipKey(req)}`,
  store: createRedisStore("rl:reserve:"),
});

export const checkoutLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req: Request) => `user:${req.userId ?? ipKey(req)}`,
  store: createRedisStore("rl:checkout:"),
});
