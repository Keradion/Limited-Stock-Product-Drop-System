/**
 * Advanced concurrency simulation tests covering complex scenarios:
 * - Multiple users racing for limited stock
 * - Checkout vs expiry timing edge cases
 * - Stock release and re-reservation patterns
 * - High-load stress scenarios
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox } from "sinon";
import { ReservationRaceState } from "../helpers/reservationRaceState.js";
import { AtomicInventoryStore, mapHoldResult } from "../helpers/atomicInventoryStore.js";
import { AppError } from "../../src/lib/errors.js";

describe("advanced concurrency scenarios", function () {
  this.timeout(20_000);

  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    esmock.purge("../../src/services/checkout.service.js");
    esmock.purge("../../src/services/reservation-expiry.service.js");
    esmock.purge("../../src/services/reserve.service.js");
  });

  describe("flash sale burst scenarios", () => {
    const productId = "flash-sale-product";
    const initialStock = 3;

    it("handles 50 concurrent users racing for 3 units", async () => {
      const store = new AtomicInventoryStore();
      store.init(productId, initialStock);
      let pendingQuantity = 0;

      const product = {
        productId,
        productName: "Flash Sale Item",
        productStock: initialStock,
      };

      let reservationCounter = 0;
      const module = await esmock("../../src/services/reserve.service.js", {
        "../../src/db.js": {
          prisma: {
            product: {
              findUnique: sandbox.stub().resolves(product),
            },
            reservation: {
              updateMany: sandbox.stub().resolves({ count: 1 }),
            },
            $transaction: sandbox.stub().callsFake(async (fn) => {
              const currentPending = pendingQuantity;
              const tx = {
                product: {
                  findUnique: sandbox.stub().resolves(product),
                },
                reservation: {
                  aggregate: sandbox.stub().resolves({
                    _sum: { quantity: currentPending },
                  }),
                  create: sandbox.stub().callsFake(async ({ data }: { data: { quantity: number } }) => {
                    pendingQuantity += data.quantity;
                    reservationCounter += 1;
                    return {
                      reservationId: `flash-res-${reservationCounter}`,
                      userId: data.userId,
                      productId,
                      quantity: data.quantity,
                      reservationStatus: "PENDING",
                      expiresAt: new Date(Date.now() + 300_000),
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  }),
                },
              };
              return fn(tx as never);
            }),
          },
        },
        "../../src/lib/inventory.js": {
          ensureProductInventory: sandbox.stub().resolves(),
          holdStock: sandbox.stub().callsFake(async (id: string, quantity: number) =>
            mapHoldResult(store.hold(id, quantity)),
          ),
          releaseStock: sandbox.stub().callsFake(async (id: string, quantity: number) => {
            store.release(id, quantity);
          }),
        },
        "../../src/queues/reservation.queue.js": {
          scheduleReservationExpiry: sandbox.stub().resolves(),
          reservationExpiryQueue: {},
          cancelReservationExpiry: sandbox.stub(),
          closeReservationExpiryQueue: sandbox.stub(),
        },
      });

      const createReservation = module.createReservation;

      const attempts = Array.from({ length: 50 }, (_, i) =>
        createReservation(`flash-user-${i + 1}`, productId, 1),
      );

      const results = await Promise.allSettled(attempts);
      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter(
        (r) =>
          r.status === "rejected" &&
          (r.reason as { statusCode?: number }).statusCode === 409,
      );

      expect(successes.length).to.equal(3);
      expect(failures.length).to.equal(47);
      expect(store.getAvailable(productId)).to.equal(0);
    }).timeout(30000);

    it("allows re-reservation after expiry releases stock", async () => {
      const store = new AtomicInventoryStore();
      store.init(productId, initialStock);
      let pendingQuantity = 0;

      const product = {
        productId,
        productStock: initialStock,
      };

      let reservationCounter = 0;
      const reserveModule = await esmock("../../src/services/reserve.service.js", {
        "../../src/db.js": {
          prisma: {
            product: {
              findUnique: sandbox.stub().resolves(product),
            },
            reservation: {
              updateMany: sandbox.stub().resolves({ count: 1 }),
            },
            $transaction: sandbox.stub().callsFake(async (fn) => {
              const tx = {
                product: {
                  findUnique: sandbox.stub().resolves(product),
                },
                reservation: {
                  aggregate: sandbox.stub().callsFake(async () => ({
                    _sum: { quantity: pendingQuantity },
                  })),
                  create: sandbox.stub().callsFake(async ({ data }: { data: { quantity: number } }) => {
                    pendingQuantity += data.quantity;
                    reservationCounter += 1;
                    return {
                      reservationId: `res-${reservationCounter}`,
                      userId: data.userId,
                      productId,
                      quantity: data.quantity,
                      reservationStatus: "PENDING",
                      expiresAt: new Date(Date.now() + 300_000),
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  }),
                },
              };
              return fn(tx as never);
            }),
          },
        },
        "../../src/lib/inventory.js": {
          ensureProductInventory: sandbox.stub().resolves(),
          holdStock: sandbox.stub().callsFake(async (id: string, quantity: number) =>
            mapHoldResult(store.hold(id, quantity)),
          ),
          releaseStock: sandbox.stub().callsFake(async (id: string, quantity: number) => {
            store.release(id, quantity);
          }),
        },
        "../../src/queues/reservation.queue.js": {
          scheduleReservationExpiry: sandbox.stub().resolves(),
          reservationExpiryQueue: {},
          cancelReservationExpiry: sandbox.stub(),
          closeReservationExpiryQueue: sandbox.stub(),
        },
      });

      const createReservation = reserveModule.createReservation;

      await createReservation("user-1", productId, 2);
      await createReservation("user-2", productId, 1);

      expect(store.getAvailable(productId)).to.equal(0);

      store.release(productId, 2);
      pendingQuantity -= 2;

      expect(store.getAvailable(productId)).to.equal(2);

      const newReservation = await createReservation("user-3", productId, 2);

      expect(newReservation.reservationId).to.equal("res-3");
      expect(store.getAvailable(productId)).to.equal(0);
    });
  });

  describe("checkout and expiry race timing", () => {
    const reservationId = "race-res-1";
    const userId = "race-user-1";
    const productId = "race-product-1";
    const quantity = 2;

    it("handles checkout attempt after expiry marked it EXPIRED", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() - 1000);

      const raceState = new ReservationRaceState(
        reservationId,
        userId,
        productId,
        quantity,
        expiresAt,
      );

      const expiryModule = await esmock("../../src/services/reservation-expiry.service.js", {
        "../../src/db.js": {
          prisma: {
            $transaction: sandbox.stub().callsFake(async (fn) => {
              const tx = {
                reservation: {
                  updateMany: sandbox.stub().callsFake(async () => {
                    const won = raceState.tryExpire(now);
                    return { count: won ? 1 : 0 };
                  }),
                  findUnique: sandbox.stub().callsFake(async () =>
                    raceState.status === "EXPIRED" ? { productId, quantity } : null,
                  ),
                },
                inventoryLog: {
                  create: sandbox.stub().resolves({}),
                },
              };
              return fn(tx as never);
            }),
          },
        },
        "../../src/lib/inventory.js": {
          releaseStock: sandbox.stub().resolves(),
          ensureProductInventory: sandbox.stub(),
          holdStock: sandbox.stub(),
        },
        "../../src/lib/logger.js": {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
          logRequest: sandbox.stub(),
          logRequestError: sandbox.stub(),
        },
      });

      await expiryModule.expireReservation(reservationId);

      expect(raceState.status).to.equal("EXPIRED");

      const checkoutModule = await esmock("../../src/services/checkout.service.js", {
        "../../src/db.js": {
          prisma: {
            reservation: {
              findUnique: sandbox.stub().resolves({
                reservationId,
                userId,
                productId,
                quantity,
                reservationStatus: "EXPIRED",
                expiresAt,
              }),
            },
            $transaction: sandbox.stub(),
          },
        },
        "../../src/queues/reservation.queue.js": {
          cancelReservationExpiry: sandbox.stub().resolves(),
          scheduleReservationExpiry: sandbox.stub(),
          reservationExpiryQueue: {},
          closeReservationExpiryQueue: sandbox.stub(),
        },
      });

      try {
        await checkoutModule.checkoutReservation(userId, reservationId);
        expect.fail("Checkout should fail after expiry");
      } catch (error) {
        expect(error).to.be.instanceOf(AppError);
        expect((error as AppError).statusCode).to.equal(410);
        expect((error as AppError).message).to.include("expired");
      }
    });

    it("handles simultaneous checkout by same user on different devices", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 300_000);

      const raceState = new ReservationRaceState(
        reservationId,
        userId,
        productId,
        quantity,
        expiresAt,
      );

      const checkoutModule = await esmock("../../src/services/checkout.service.js", {
        "../../src/db.js": {
          prisma: {
            reservation: {
              findUnique: sandbox.stub().callsFake(async () => ({
                reservationId,
                userId,
                productId,
                quantity,
                reservationStatus: raceState.status,
                expiresAt: raceState.expiresAt,
                createdAt: now,
                updatedAt: now,
              })),
            },
            $transaction: sandbox.stub().callsFake(async (fn) => {
              const tx = {
                reservation: {
                  updateMany: sandbox.stub().callsFake(async () => {
                    const won = raceState.tryCompleteCheckout(now);
                    return { count: won ? 1 : 0 };
                  }),
                },
                product: {
                  updateMany: sandbox.stub().resolves({ count: 1 }),
                },
                inventoryLog: {
                  create: sandbox.stub().resolves({}),
                },
                order: {
                  create: sandbox.stub().resolves({
                    orderId: "order-1",
                    reservationId,
                    orderStatus: "PAID",
                  }),
                },
              };
              return fn(tx as never);
            }),
          },
        },
        "../../src/queues/reservation.queue.js": {
          cancelReservationExpiry: sandbox.stub().resolves(),
          scheduleReservationExpiry: sandbox.stub(),
          reservationExpiryQueue: {},
          closeReservationExpiryQueue: sandbox.stub(),
        },
      });

      const results = await Promise.allSettled([
        checkoutModule.checkoutReservation(userId, reservationId),
        checkoutModule.checkoutReservation(userId, reservationId),
        checkoutModule.checkoutReservation(userId, reservationId),
      ]);

      const successes = results.filter((r) => r.status === "fulfilled");
      const conflicts = results.filter(
        (r) =>
          r.status === "rejected" &&
          (r.reason as AppError).statusCode === 409,
      );

      expect(successes.length).to.equal(1);
      expect(conflicts.length).to.equal(2);
      expect(raceState.status).to.equal("COMPLETED");
    });
  });

  describe("stress test scenarios", () => {
    it("handles 200 concurrent mixed operations without data corruption", async () => {
      const productId = "stress-product";
      const initialStock = 20;
      const store = new AtomicInventoryStore();
      store.init(productId, initialStock);
      let pendingQuantity = 0;

      const product = {
        productId,
        productStock: initialStock,
      };

      let reservationCounter = 0;
      const module = await esmock("../../src/services/reserve.service.js", {
        "../../src/db.js": {
          prisma: {
            product: {
              findUnique: sandbox.stub().resolves(product),
            },
            reservation: {
              updateMany: sandbox.stub().resolves({ count: 1 }),
            },
            $transaction: sandbox.stub().callsFake(async (fn) => {
              const tx = {
                product: {
                  findUnique: sandbox.stub().resolves(product),
                },
                reservation: {
                  aggregate: sandbox.stub().callsFake(async () => ({
                    _sum: { quantity: pendingQuantity },
                  })),
                  create: sandbox.stub().callsFake(async ({ data }: { data: { quantity: number } }) => {
                    pendingQuantity += data.quantity;
                    reservationCounter += 1;
                    return {
                      reservationId: `stress-res-${reservationCounter}`,
                      userId: data.userId,
                      productId,
                      quantity: data.quantity,
                      reservationStatus: "PENDING",
                      expiresAt: new Date(Date.now() + 300_000),
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  }),
                },
              };
              return fn(tx as never);
            }),
          },
        },
        "../../src/lib/inventory.js": {
          ensureProductInventory: sandbox.stub().resolves(),
          holdStock: sandbox.stub().callsFake(async (id: string, quantity: number) =>
            mapHoldResult(store.hold(id, quantity)),
          ),
          releaseStock: sandbox.stub().callsFake(async (id: string, quantity: number) => {
            store.release(id, quantity);
          }),
        },
        "../../src/queues/reservation.queue.js": {
          scheduleReservationExpiry: sandbox.stub().resolves(),
          reservationExpiryQueue: {},
          cancelReservationExpiry: sandbox.stub(),
          closeReservationExpiryQueue: sandbox.stub(),
        },
      });

      const createReservation = module.createReservation;

      const attempts = Array.from({ length: 200 }, (_, i) => {
        const quantity = (i % 3) + 1;
        return createReservation(`stress-user-${i + 1}`, productId, quantity);
      });

      const results = await Promise.allSettled(attempts);
      const successes = results.filter((r) => r.status === "fulfilled");

      const totalReserved = successes.length;
      const remaining = store.getAvailable(productId);

      expect(remaining).to.be.gte(0);
      expect(totalReserved).to.be.lte(initialStock);
      expect(remaining + pendingQuantity).to.equal(initialStock);
    });
  });

  describe("partial reservation scenarios", () => {
    it("handles user requesting more than available but less than total stock", async () => {
      const productId = "partial-product";
      const totalStock = 10;
      const alreadyHeld = 8;
      const requestedQuantity = 5;

      const store = new AtomicInventoryStore();
      store.init(productId, totalStock - alreadyHeld);

      const product = {
        productId,
        productStock: totalStock,
      };

      const module = await esmock("../../src/services/reserve.service.js", {
        "../../src/db.js": {
          prisma: {
            product: {
              findUnique: sandbox.stub().resolves(product),
            },
            reservation: {
              updateMany: sandbox.stub().resolves({ count: 1 }),
            },
            $transaction: sandbox.stub().callsFake(async (fn) => {
              const tx = {
                product: {
                  findUnique: sandbox.stub().resolves(product),
                },
                reservation: {
                  aggregate: sandbox.stub().resolves({ _sum: { quantity: alreadyHeld } }),
                  create: sandbox.stub(),
                },
              };
              return fn(tx as never);
            }),
          },
        },
        "../../src/lib/inventory.js": {
          ensureProductInventory: sandbox.stub().resolves(),
          holdStock: sandbox.stub().callsFake(async (id: string, quantity: number) =>
            mapHoldResult(store.hold(id, quantity)),
          ),
          releaseStock: sandbox.stub().callsFake(async (id: string, quantity: number) => {
            store.release(id, quantity);
          }),
        },
        "../../src/queues/reservation.queue.js": {
          scheduleReservationExpiry: sandbox.stub().resolves(),
          reservationExpiryQueue: {},
          cancelReservationExpiry: sandbox.stub(),
          closeReservationExpiryQueue: sandbox.stub(),
        },
      });

      try {
        await module.createReservation("user-1", productId, requestedQuantity);
        expect.fail("Should reject request exceeding available stock");
      } catch (error) {
        expect((error as AppError).statusCode).to.equal(409);
        expect((error as AppError).message).to.include("Insufficient stock");
      }

      expect(store.getAvailable(productId)).to.equal(2);
    });
  });
});
