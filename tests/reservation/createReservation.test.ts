/**
 * Tests for createReservation — the POST /api/reserve business logic.
 * Sinon stubs external dependencies; esmock replaces ESM module bindings.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox, SinonStub } from "sinon";
import { AppError } from "../../src/lib/errors.js";

describe("createReservation", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const productId = "22222222-2222-2222-2222-222222222222";
  const quantity = 2;

  const product = {
    productId,
    productName: "Test Product",
    productStock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let sandbox: SinonSandbox;
  let createReservation: typeof import("../../src/services/reserve.service.js").createReservation;
  let ensureInventoryStub: SinonStub;
  let holdStockStub: SinonStub;
  let releaseStockStub: SinonStub;
  let scheduleExpiryStub: SinonStub;
  let findProductStub: SinonStub;
  let updateManyStub: SinonStub;
  let transactionStub: SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    ensureInventoryStub = sandbox.stub().resolves();
    holdStockStub = sandbox.stub().resolves("SUCCESS");
    releaseStockStub = sandbox.stub().resolves();
    scheduleExpiryStub = sandbox.stub().resolves();
    findProductStub = sandbox.stub().resolves(product);
    updateManyStub = sandbox.stub().resolves({ count: 1 });
    transactionStub = sandbox.stub().callsFake(async (fn) => {
      const tx = {
        reservation: {
          create: sandbox.stub().resolves({
            reservationId: "33333333-3333-3333-3333-333333333333",
            userId,
            productId,
            quantity,
            reservationStatus: "PENDING",
            expiresAt: new Date(Date.now() + 300_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };
      return fn(tx as never);
    });

    const module = await esmock("../../src/services/reserve.service.js", {
      "../../src/db.js": {
        prisma: {
          product: { findUnique: findProductStub },
          reservation: { updateMany: updateManyStub },
          $transaction: transactionStub,
        },
      },
      "../../src/lib/inventory.js": {
        ensureProductInventory: ensureInventoryStub,
        holdStock: holdStockStub,
        releaseStock: releaseStockStub,
      },
      "../../src/queues/reservation.queue.js": {
        scheduleReservationExpiry: scheduleExpiryStub,
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

  it("throws 404 when the product does not exist", async () => {
    findProductStub.resolves(null);

    try {
      await createReservation(userId, productId, quantity);
      expect.fail("Expected AppError");
    } catch (error) {
      expect(error).to.be.instanceOf(AppError);
      expect((error as AppError).statusCode).to.equal(404);
    }

    expect(ensureInventoryStub.called).to.equal(false);
  });

  it("throws 503 when Redis inventory is not initialized", async () => {
    holdStockStub.resolves("NOT_INITIALIZED");

    try {
      await createReservation(userId, productId, quantity);
      expect.fail("Expected AppError");
    } catch (error) {
      expect((error as AppError).statusCode).to.equal(503);
    }
  });

  it("throws 409 when there is insufficient stock", async () => {
    holdStockStub.resolves("INSUFFICIENT");

    try {
      await createReservation(userId, productId, quantity);
      expect.fail("Expected AppError");
    } catch (error) {
      expect((error as AppError).statusCode).to.equal(409);
    }
  });

  it("creates a reservation and schedules expiry on success", async () => {
    const result = await createReservation(userId, productId, quantity);

    expect(ensureInventoryStub.calledOnceWith(productId, product.productStock)).to.equal(true);
    expect(holdStockStub.calledOnceWith(productId, quantity)).to.equal(true);
    expect(scheduleExpiryStub.calledOnce).to.equal(true);
    expect(result.reservationId).to.equal("33333333-3333-3333-3333-333333333333");
    expect(releaseStockStub.called).to.equal(false);
  });

  it("releases Redis stock when queue scheduling fails", async () => {
    scheduleExpiryStub.rejects(new Error("Queue unavailable"));

    try {
      await createReservation(userId, productId, quantity);
      expect.fail("Expected error");
    } catch (error) {
      expect((error as Error).message).to.equal("Queue unavailable");
    }

    expect(releaseStockStub.calledOnceWith(productId, quantity)).to.equal(true);
    expect(updateManyStub.calledOnce).to.equal(true);
  });
});
