import type { RedisOptions } from "ioredis";

/** Use the URL exactly as Redis Cloud / Render provides it (redis:// vs rediss://). */
export function resolveRedisUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("REDIS_URL is empty");
  }
  return trimmed;
}

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    useTls: parsed.protocol === "rediss:",
  };
}

/** BullMQ / ioredis — host/port + tls when URL uses `rediss://` (no duplicate TLS layers). */
export function getBullMqConnection(): RedisOptions {
  const { host, port, username, password, useTls } = parseRedisUrl(
    resolveRedisUrl(process.env.REDIS_URL ?? ""),
  );

  return {
    host,
    port,
    username,
    password,
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/** node-redis — pass URL only; do not add socket.tls when using `rediss://` (causes SSL errors). */
export function getNodeRedisClientOptions(rawUrl: string) {
  return {
    url: resolveRedisUrl(rawUrl),
  };
}

export function isRedisTlsUrl(rawUrl: string): boolean {
  return parseRedisUrl(resolveRedisUrl(rawUrl)).useTls;
}
