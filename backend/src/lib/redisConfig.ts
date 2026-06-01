import type { RedisOptions } from "ioredis";

/** Redis Cloud and similar hosts require TLS (`rediss://`). */
export function normalizeRedisUrl(raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.startsWith("redis://") &&
    (trimmed.includes(".redis.io") || trimmed.includes("redns.redis"))
  ) {
    return `rediss://${trimmed.slice("redis://".length)}`;
  }
  return trimmed;
}

export function resolveRedisUrl(raw: string): string {
  const normalized = normalizeRedisUrl(raw);
  if (!normalized) {
    throw new Error("REDIS_URL is empty");
  }
  return normalized;
}

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  const useTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    useTls,
  };
}

/** BullMQ / ioredis — `url` alone often skips TLS for `rediss://`. */
export function getBullMqConnection(): RedisOptions {
  const { host, port, username, password, useTls } = parseRedisUrl(
    resolveRedisUrl(process.env.REDIS_URL ?? ""),
  );

  return {
    host,
    port,
    username,
    password,
    ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function getNodeRedisClientOptions(url: string) {
  const resolved = resolveRedisUrl(url);
  const { useTls } = parseRedisUrl(resolved);
  if (!useTls) {
    return { url: resolved };
  }
  return {
    url: resolved,
    socket: {
      tls: true as const,
      rejectUnauthorized: false,
    },
  };
}
