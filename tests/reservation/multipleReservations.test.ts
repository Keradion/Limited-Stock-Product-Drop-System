/**
 * Verifies one user can hold multiple active reservations and that each
 * reservation consumes from the shared product stock pool inside a transaction.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox, SinonStub } from "sinon";
import {
  AtomicInventoryStore,
  mapHoldResult,
} from "../helpers/atomicInventoryStore.js";

describe("multiple reservations per user", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const productId = "22222222-2222-2222-2222-222222222222";
  const productStock = 5;

  const product = {
    productId,
    productName: "Drop Item",
    productStock,
  };

  let sandbox: SinonSandbox;
  let store: AtomicInventoryStore;
  let pendingQuantity: number;
  let createReservation: typeof import("../../src/services/reserve.service.js").createReservation;
  let reservationCreateStub: SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    store = new AtomicInventoryStore();
    store.init(productId, productStock);
    pendingQuantity = 0;

    let reservationCounter = 0;
    reservationCreateStub = sandbox.stub().callsFake(async ({ data }: { data: { quantity: number } }) => {
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

  it("allows the same user to create multiple reservations for one product", async () => {
    const first = await createReservation(userId, productId, 2);
    const second = await createReservation(userId, productId, 1);
    const third = await createReservation(userId, productId, 2);

    expect(first.reservationId).to.equal("res-1");
    expect(second.reservationId).to.equal("res-2");
    expect(third.reservationId).to.equal("res-3");
    expect(reservationCreateStub.callCount).to.equal(3);
    expect(pendingQuantity).to.equal(5);
    expect(store.getAvailable(productId)).to.equal(0);
  });

  it("rejects a new reservation once DB pending quantity reaches product stock", async () => {
    pendingQuantity = 4;

    await expectRejectedWith409(createReservation(userId, productId, 2));
    expect(reservationCreateStub.called).to.equal(false);
  });
});

async function expectRejectedWith409(action: Promise<unknown>): Promise<void> {
  try {
    await action;
    expect.fail("Expected AppError 409");
  } catch (error) {
    expect((error as { statusCode?: number }).statusCode).to.equal(409);
  }
}
