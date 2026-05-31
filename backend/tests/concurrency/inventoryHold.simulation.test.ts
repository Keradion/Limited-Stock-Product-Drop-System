/**
 * Simulates concurrent reservation attempts where multiple users try to
 * reserve stock simultaneously. Tests that the Redis atomic hold operations
 * and DB transaction guards prevent overselling.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox } from "sinon";
import {
  AtomicInventoryStore,
  mapHoldResult,
} from "../helpers/atomicInventoryStore.js";

describe("inventory hold concurrency simulation", function () {
  this.timeout(15_000);

  const productId = "22222222-2222-2222-2222-222222222222";
  const initialStock = 10;

  const product = {
    productId,
    productName: "Limited Drop Sneakers",
    productStock: initialStock,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let sandbox: SinonSandbox;
  let store: AtomicInventoryStore;
  let pendingQuantity: number;
  let createReservation: typeof import("../../src/services/reserve.service.js").createReservation;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    store = new AtomicInventoryStore();
    store.init(productId, initialStock);
    pendingQuantity = 0;

    let reservationCounter = 0;
    const reservationCreateStub = sandbox.stub().callsFake(async ({ data }: { data: { quantity: number } }) => {
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
    });

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
                create: reservationCreateStub,
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

    createReservation = module.createReservation;
  });

  afterEach(() => {
    sandbox.restore();
    esmock.purge("../../src/services/reserve.service.js");
  });

  it("allows exactly 10 reservations of quantity 1 when stock is 10", async () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      createReservation(`user-${i + 1}`, productId, 1),
    );

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes.length).to.equal(10);
    expect(failures.length).to.equal(0);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("prevents overselling when 20 users try to reserve 1 unit each from 10-unit stock", async () => {
    const attempts = Array.from({ length: 20 }, (_, i) =>
      createReservation(`user-${i + 1}`, productId, 1),
    );

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter(
      (r) =>
        r.status === "rejected" &&
        (r.reason as { statusCode?: number }).statusCode === 409,
    );

    expect(successes.length).to.equal(10);
    expect(failures.length).to.equal(10);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("prevents overselling when users request mixed quantities", async () => {
    const requests = [
      { userId: "user-1", quantity: 3 },
      { userId: "user-2", quantity: 2 },
      { userId: "user-3", quantity: 2 },
      { userId: "user-4", quantity: 1 },
      { userId: "user-5", quantity: 3 },
      { userId: "user-6", quantity: 5 },
      { userId: "user-7", quantity: 1 },
      { userId: "user-8", quantity: 2 },
    ];

    const attempts = requests.map(({ userId, quantity }) =>
      createReservation(userId, productId, quantity),
    );

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter(
      (r) =>
        r.status === "rejected" &&
        (r.reason as { statusCode?: number }).statusCode === 409,
    );

    let totalReserved = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        totalReserved += requests[index].quantity;
      }
    });

    expect(totalReserved).to.be.at.most(initialStock);
    expect(successes.length + failures.length).to.equal(attempts.length);
    expect(store.getAvailable(productId)).to.be.gte(0);
  });

  it("allows 5 reservations of 2 units each to consume exactly 10-unit stock", async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      createReservation(`user-${i + 1}`, productId, 2),
    );

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === "fulfilled");

    expect(successes.length).to.equal(5);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("rejects the 11th attempt when 10 units are already held", async () => {
    const first10 = Array.from({ length: 10 }, (_, i) =>
      createReservation(`user-${i + 1}`, productId, 1),
    );

    await Promise.all(first10);

    try {
      await createReservation("user-11", productId, 1);
      expect.fail("Expected 11th reservation to be rejected");
    } catch (error) {
      expect((error as { statusCode?: number }).statusCode).to.equal(409);
      expect((error as Error).message).to.include("Insufficient stock");
    }

    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("handles concurrent large reservation attempts without negative stock", async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      createReservation(`user-${i + 1}`, productId, 8),
    );

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter(
      (r) =>
        r.status === "rejected" &&
        (r.reason as { statusCode?: number }).statusCode === 409,
    );

    expect(successes.length).to.equal(1);
    expect(failures.length).to.equal(4);

    const remaining = store.getAvailable(productId);
    expect(remaining).to.be.gte(0);
    expect(remaining).to.equal(2);
  });

  it("allows sequential reservations after concurrent batch completes", async () => {
    const batch1 = Array.from({ length: 5 }, (_, i) =>
      createReservation(`user-batch1-${i + 1}`, productId, 1),
    );

    await Promise.all(batch1);

    const batch2 = Array.from({ length: 5 }, (_, i) =>
      createReservation(`user-batch2-${i + 1}`, productId, 1),
    );

    const results = await Promise.allSettled(batch2);
    const successes = results.filter((r) => r.status === "fulfilled");

    expect(successes.length).to.equal(5);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("releases stock correctly when reservation creation fails", async () => {
    const releaseStockStub = sandbox.stub();
    const mockWithFailingTransaction = await esmock("../../src/services/reserve.service.js", {
      "../../src/db.js": {
        prisma: {
          product: {
            findUnique: sandbox.stub().resolves(product),
          },
          reservation: {
            updateMany: sandbox.stub().resolves({ count: 1 }),
          },
          $transaction: sandbox.stub().rejects(new Error("Transaction failed")),
        },
      },
      "../../src/lib/inventory.js": {
        ensureProductInventory: sandbox.stub().resolves(),
        holdStock: sandbox.stub().callsFake(async (id: string, quantity: number) =>
          mapHoldResult(store.hold(id, quantity)),
        ),
        releaseStock: releaseStockStub.callsFake(async (id: string, quantity: number) => {
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

    const initialAvailable = store.getAvailable(productId);

    try {
      await mockWithFailingTransaction.createReservation("user-1", productId, 2);
      expect.fail("Expected transaction failure");
    } catch (error) {
      expect((error as Error).message).to.equal("Transaction failed");
    }

    expect(releaseStockStub.calledOnceWith(productId, 2)).to.equal(true);
    expect(store.getAvailable(productId)).to.equal(initialAvailable);
  });

  it("handles 100 concurrent reservation attempts correctly", async () => {
    const attempts = Array.from({ length: 100 }, (_, i) =>
      createReservation(`user-${i + 1}`, productId, 1),
    );

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter(
      (r) =>
        r.status === "rejected" &&
        (r.reason as { statusCode?: number }).statusCode === 409,
    );

    expect(successes.length).to.equal(10);
    expect(failures.length).to.equal(90);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("maintains consistency with interleaved hold and release operations", async () => {
    const operations: Promise<unknown>[] = [];

    for (let i = 0; i < 5; i++) {
      operations.push(createReservation(`user-${i}`, productId, 1));
    }

    await Promise.all(operations);
    expect(store.getAvailable(productId)).to.equal(5);

    store.release(productId, 2);
    expect(store.getAvailable(productId)).to.equal(7);

    const moreAttempts = Array.from({ length: 7 }, (_, i) =>
      createReservation(`user-${i + 5}`, productId, 1),
    );

    const results = await Promise.allSettled(moreAttempts);
    const successes = results.filter((r) => r.status === "fulfilled");

    expect(successes.length).to.equal(7);
    expect(store.getAvailable(productId)).to.equal(0);
  });
});
