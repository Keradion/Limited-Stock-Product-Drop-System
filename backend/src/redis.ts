import { createClient, type RedisClientType } from "redis";
import "dotenv/config";

declare global {
  // eslint-disable-next-line no-var
  var redis: RedisClientType | undefined;
}

function createRedisClient(): RedisClientType {
  const client = createClient({
    url: process.env.REDIS_URL,
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
