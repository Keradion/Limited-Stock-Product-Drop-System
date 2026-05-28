import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const [alice, bob, carol] = await Promise.all([
    prisma.user.create({
      data: { email: "alice@example.com", password: "password123" },
    }),
    prisma.user.create({
      data: { email: "bob@example.com", password: "password123" },
    }),
    prisma.user.create({
      data: { email: "carol@example.com", password: "password123" },
    }),
  ]);

  const products = await Promise.all([
    prisma.product.create({
      data: { productName: "Nike Air Drop Exclusive", productStock: 10 },
    }),
    prisma.product.create({
      data: { productName: "Supreme Box Logo Tee", productStock: 25 },
    }),
    prisma.product.create({
      data: { productName: "PlayStation 5 Pro Drop", productStock: 5 },
    }),
    prisma.product.create({
      data: { productName: "Travis Scott Jordan 1", productStock: 8 },
    }),
    prisma.product.create({
      data: { productName: "Vintage Rolex Submariner", productStock: 2 },
    }),
  ]);

  await prisma.inventoryLog.createMany({
    data: products.map((product) => ({
      productId: product.productId,
      inventoryReason: "Initial stock load",
    })),
  });

  const [aliceReservation, bobReservation] = await Promise.all([
    prisma.reservation.create({
      data: {
        reservationStatus: "PENDING",
        userId: alice.userId,
        productId: products[0].productId,
      },
    }),
    prisma.reservation.create({
      data: {
        reservationStatus: "COMPLETED",
        userId: bob.userId,
        productId: products[2].productId,
      },
    }),
  ]);

  await prisma.reservation.create({
    data: {
      reservationStatus: "EXPIRED",
      userId: carol.userId,
      productId: products[4].productId,
    },
  });

  await prisma.order.create({
    data: {
      orderStatus: "PAID",
      userId: bob.userId,
      productId: products[2].productId,
      reservationId: bobReservation.reservationId,
    },
  });

  console.log(`Seeded ${products.length} products, 3 users, 5 inventory logs, 3 reservations, 1 order`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
