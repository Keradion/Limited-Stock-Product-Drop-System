import { createClient } from "redis";
import "dotenv/config";
function createRedisClient() {
    const client = createClient({
        url: process.env.REDIS_URL,
    });
    client.on("error", (error) => {
        console.error("Redis client error:", error);
    });
    return client;
}
export const redis = global.redis ?? createRedisClient();
if (process.env.NODE_ENV !== "production") {
    global.redis = redis;
}
export async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}
export async function disconnectRedis() {
    if (redis.isOpen) {
        await redis.quit();
    }
}
