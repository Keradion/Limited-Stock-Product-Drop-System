import "dotenv/config";
function requireEnv(key) {
    const value = process.env[key];
    if (!value?.trim()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
function requireIntEnv(key) {
    const value = Number.parseInt(requireEnv(key), 10);
    if (Number.isNaN(value)) {
        throw new Error(`Environment variable ${key} must be a valid integer`);
    }
    return value;
}
function parseListEnv(key) {
    return requireEnv(key)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}
function optionalEnv(key, fallback) {
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : fallback;
}
export const config = {
    port: requireIntEnv("PORT"),
    nodeEnv: requireEnv("NODE_ENV"),
    corsOrigin: optionalEnv("CORS_ORIGIN", "http://localhost:5173"),
    logLevel: requireEnv("LOG_LEVEL"),
    serviceName: requireEnv("SERVICE_NAME"),
    requestLogSkipPaths: parseListEnv("REQUEST_LOG_SKIP_PATHS"),
    redis: {
        url: requireEnv("REDIS_URL"),
    },
    jwt: {
        secret: requireEnv("JWT_SECRET"),
        expiresIn: requireEnv("JWT_EXPIRES_IN"),
    },
    bcryptSaltRounds: requireIntEnv("BCRYPT_SALT_ROUNDS"),
    shutdownTimeoutMs: requireIntEnv("SHUTDOWN_TIMEOUT_MS"),
    reservation: {
        ttlMs: requireIntEnv("RESERVATION_TTL_MS"),
        expiryQueueName: requireEnv("RESERVATION_EXPIRY_QUEUE_NAME"),
    },
    pagination: {
        defaultPageSize: requireIntEnv("DEFAULT_PAGE_SIZE"),
        maxPageSize: requireIntEnv("MAX_PAGE_SIZE"),
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
