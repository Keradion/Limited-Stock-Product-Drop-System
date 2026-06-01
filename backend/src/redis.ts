import { createClient, type RedisClientType } from "redis";
import "dotenv/config";
import { getNodeRedisClientOptions } from "./lib/redisConfig.js";

declare global {
  var redis: RedisClientType | undefined;
}

function createRedisClient(): RedisClientType {
  const rawUrl = process.env.REDIS_URL ?? "";
  const client = createClient(getNodeRedisClientOptions(rawUrl));

  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  return client as RedisClientType;
}

export const redis = global.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectRedis(maxAttempts = 10): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      return;
    } catch (err) {
      lastError = err;
      console.error(
        `Redis connect attempt ${attempt}/${maxAttempts} failed:`,
        err,
      );
      if (redis.isOpen) {
        try {
          await redis.quit();
        } catch {
          /* reconnect with fresh socket */
        }
      }
      if (attempt < maxAttempts) {
        await sleep(2000);
      }
    }
  }

  throw lastError;
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) {
    await redis.quit();
  }
}
