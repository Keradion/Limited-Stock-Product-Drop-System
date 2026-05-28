import { prisma } from "../db.js";
import { redis } from "../redis.js";
const INVENTORY_KEY_PREFIX = "available:";
function inventoryKey(productId) {
    return `${INVENTORY_KEY_PREFIX}${productId}`;
}
// Atomically deduct stock only when enough units are available
const HOLD_STOCK_SCRIPT = `
  local available = tonumber(redis.call("GET", KEYS[1]))
  if available == nil then
    return -2
  end
  local quantity = tonumber(ARGV[1])
  if available < quantity then
    return -1
  end
  return redis.call("DECRBY", KEYS[1], quantity)
`;
// Return held units back to the available pool
const RELEASE_STOCK_SCRIPT = `
  return redis.call("INCRBY", KEYS[1], tonumber(ARGV[1]))
`;
export async function ensureProductInventory(productId, totalStock) {
    const key = inventoryKey(productId);
    const exists = await redis.exists(key);
    if (exists) {
        return;
    }
    // Sync Redis counter from DB: total stock minus active pending reservations
    const pending = await prisma.reservation.aggregate({
        where: {
            productId,
            reservationStatus: "PENDING",
            expiresAt: { gt: new Date() },
        },
        _sum: { quantity: true },
    });
    const heldQuantity = pending._sum.quantity ?? 0;
    const available = Math.max(0, totalStock - heldQuantity);
    // NX avoids overwriting a counter another request already initialized
    await redis.set(key, available, { NX: true });
}
export async function holdStock(productId, quantity) {
    const rawResult = await redis.eval(HOLD_STOCK_SCRIPT, {
        keys: [inventoryKey(productId)],
        arguments: [String(quantity)],
    });
    const result = Number(rawResult);
    if (result === -2) {
        return "NOT_INITIALIZED";
    }
    if (result === -1) {
        return "INSUFFICIENT";
    }
    return "SUCCESS";
}
export async function releaseStock(productId, quantity) {
    await redis.eval(RELEASE_STOCK_SCRIPT, {
        keys: [inventoryKey(productId)],
        arguments: [String(quantity)],
    });
}
/** Read live available units from Redis (null if the counter was never initialized). */
export async function getRedisAvailableStock(productId) {
    const raw = await redis.get(inventoryKey(productId));
    if (raw === null) {
        return null;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
}
