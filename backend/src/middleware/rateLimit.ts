import {
  rateLimit,
  ipKeyGenerator,
  type RateLimitExceededEventHandler,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request } from "express";
import { config } from "../config/env.js";
import { connectRedis, redis } from "../redis.js";

function createRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: async (...args: string[]) => {
      if (!redis.isOpen) {
        await connectRedis();
      }
      return redis.sendCommand(args);
    },
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
  windowMs: config.rateLimit.login.windowMs,
  limit: config.rateLimit.login.limit,
  keyGenerator: ipKey,
  store: createRedisStore("rl:login:"),
});

export const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.rateLimit.register.windowMs,
  limit: config.rateLimit.register.limit,
  keyGenerator: ipKey,
  store: createRedisStore("rl:register:"),
});

export const reserveLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.rateLimit.reserve.windowMs,
  limit: config.rateLimit.reserve.limit,
  keyGenerator: (req: Request) => `user:${req.userId ?? ipKey(req)}`,
  store: createRedisStore("rl:reserve:"),
});

export const checkoutLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.rateLimit.checkout.windowMs,
  limit: config.rateLimit.checkout.limit,
  keyGenerator: (req: Request) => `user:${req.userId ?? ipKey(req)}`,
  store: createRedisStore("rl:checkout:"),
});
