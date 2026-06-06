import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";

const TARGET_STOCK = 100;
const INVENTORY_KEY_PREFIX = "available:";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

async function main() {
  const products = await prisma.product.findMany({
    select: { productId: true, productName: true, productStock: true },
  });

  if (products.length === 0) {
    console.log("No products found.");
    return;
  }

  await prisma.product.updateMany({
    data: { productStock: TARGET_STOCK },
  });

  let redisSynced = false;

  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL not set — database updated but Redis was not synced.");
  } else {
    try {
      await redis.connect();
      redisSynced = true;
    } catch (error) {
      console.warn("Could not connect to Redis — database updated but Redis was not synced.");
      console.warn(error);
    }
  }

  for (const product of products) {
    const pending = await prisma.reservation.aggregate({
      where: {
        productId: product.productId,
        reservationStatus: "PENDING",
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });

    const heldQuantity = pending._sum.quantity ?? 0;
    const available = Math.max(0, TARGET_STOCK - heldQuantity);

    if (redisSynced) {
      const key = `${INVENTORY_KEY_PREFIX}${product.productId}`;
      await redis.set(key, String(available));
    }

    console.log(
      `${product.productName}: ${product.productStock} -> ${TARGET_STOCK} (${available} available, ${heldQuantity} held)`,
    );
  }

  console.log(`Reset stock to ${TARGET_STOCK} for ${products.length} product(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (redis.isOpen) {
      await redis.quit();
    }
    await prisma.$disconnect();
  });
