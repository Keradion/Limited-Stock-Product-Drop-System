/**
 * Simulates many concurrent reserve attempts against a finite Redis pool.
 * Uses an atomic in-memory store with the same rules as the Lua hold script.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox } from "sinon";
import {
  AtomicInventoryStore,
  mapHoldResult,
} from "../helpers/atomicInventoryStore.js";
import { AppError } from "../../src/lib/errors.js";

describe("inventory hold concurrency simulation", () => {
  const productId = "22222222-2222-2222-2222-222222222222";
  const initialStock = 10;
  let store: AtomicInventoryStore;

  beforeEach(() => {
    store = new AtomicInventoryStore();
    store.init(productId, initialStock);
  });

  it("never oversells when many requests hold 1 unit at once", async () => {
    const attempts = 100;
    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        Promise.resolve(mapHoldResult(store.hold(productId, 1))),
      ),
    );

    const successes = results.filter((result) => result === "SUCCESS").length;
    const rejections = results.filter((result) => result === "INSUFFICIENT").length;

    expect(successes).to.equal(initialStock);
    expect(rejections).to.equal(attempts - initialStock);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("caps successful holds by available quantity for larger order sizes", async () => {
    const burstStore = new AtomicInventoryStore();
    burstStore.init(productId, 15);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        Promise.resolve(mapHoldResult(burstStore.hold(productId, 2))),
      ),
    );

    const successes = results.filter((result) => result === "SUCCESS").length;

    expect(successes).to.equal(7);
    expect(burstStore.getAvailable(productId)).to.equal(1);
  });

  it("restores availability correctly under concurrent releases", async () => {
    store.hold(productId, 6);
    store.hold(productId, 4);
    expect(store.getAvailable(productId)).to.equal(0);

    await Promise.all(
      Array.from({ length: 6 }, () => Promise.resolve(store.release(productId, 1))),
    );

    expect(store.getAvailable(productId)).to.equal(6);
  });

  it("routes holdStock through inventory module without overselling", { timeout: 15_000 }, async () => {
    const sandbox = sinon.createSandbox();
    const localStore = new AtomicInventoryStore();
    localStore.init(productId, 5);

    let module: typeof import("../../src/lib/inventory.js");
    try {
      module = await esmock("../../src/lib/inventory.js", {
      "../../src/redis.js": {
        redis: {
          eval: sandbox.stub().callsFake(async (_script, options: { keys: string[]; arguments: string[] }) => {
            const id = options.keys[0].replace("available:", "");
            return localStore.hold(id, Number(options.arguments[0]));
          }),
        },
      },
      "../../src/db.js": {
        prisma: { reservation: { aggregate: sandbox.stub() } },
      },
    });
    } catch (error) {
      sandbox.restore();
      esmock.purge("../../src/lib/inventory.js");
      throw error;
    }

    const results = await Promise.all(
      Array.from({ length: 20 }, () => module.holdStock(productId, 1)),
    );

    sandbox.restore();
    esmock.purge("../../src/lib/inventory.js");

    expect(results.filter((result) => result === "SUCCESS")).to.have.length(5);
    expect(results.filter((result) => result === "INSUFFICIENT")).to.have.length(15);
    expect(localStore.getAvailable(productId)).to.equal(0);
  });
});

describe("createReservation burst concurrency simulation", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const productId = "22222222-2222-2222-2222-222222222222";
  const productStock = 3;

  let sandbox: SinonSandbox;
  let store: AtomicInventoryStore;
  let pendingQuantity: number;
  let createReservation: typeof import("../../src/services/reserve.service.js").createReservation;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    store = new AtomicInventoryStore();
    store.init(productId, productStock);
    pendingQuantity = 0;

    let reservationCounter = 0;

    const module = await esmock("../../src/services/reserve.service.js", {
      "../../src/db.js": {
        prisma: {
          product: {
            findUnique: sandbox.stub().resolves({
              productId,
              productName: "Drop Item",
              productStock,
            }),
          },
          reservation: {
            updateMany: sandbox.stub().resolves({ count: 1 }),
          },
          $transaction: sandbox.stub().callsFake(async (fn) => {
            const tx = {
              product: {
                findUnique: sandbox.stub().resolves({
                  productId,
                  productName: "Drop Item",
                  productStock,
                }),
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
                    userId,
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

    createReservation = module.createReservation;
  });

  afterEach(() => {
    sandbox.restore();
    esmock.purge("../../src/services/reserve.service.js");
  });

  it("allows at most available stock successes when many users reserve at once", async () => {
    const attempts = 25;
    const outcomes = await Promise.allSettled(
      Array.from({ length: attempts }, (_, index) =>
        createReservation(`user-${index}`, productId, 1),
      ),
    );

    const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const conflicts = outcomes.filter(
      (outcome) =>
        outcome.status === "rejected" &&
        outcome.reason instanceof AppError &&
        outcome.reason.statusCode === 409,
    );

    expect(successes).to.have.length(productStock);
    expect(conflicts).to.have.length(attempts - productStock);
    expect(store.getAvailable(productId)).to.equal(0);
  });
});
