import { createClient, type RedisClientType } from "redis";
import "dotenv/config";

declare global {
  var redis: RedisClientType | undefined;
}

function createRedisClient(): RedisClientType {
  const url = process.env.REDIS_URL;
  const client = createClient({
    url,
    socket: url?.startsWith("rediss://")
      ? { tls: true, rejectUnauthorized: true }
      : undefined,
  });

  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  return client as RedisClientType;
}

export const redis = global.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) {
    await redis.quit();
  }
}
