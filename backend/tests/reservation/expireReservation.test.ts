/**
 * Tests for expireReservation — Bull worker expiry logic.
 * Sinon stubs DB/inventory/logger; esmock replaces ESM module bindings.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox, SinonStub } from "sinon";

describe("expireReservation", () => {
  const reservationId = "44444444-4444-4444-4444-444444444444";
  const productId = "22222222-2222-2222-2222-222222222222";
  const quantity = 2;

  let sandbox: SinonSandbox;
  let expireReservation: typeof import("../../src/services/reservation-expiry.service.js").expireReservation;
  let releaseStockStub: SinonStub;
  let transactionStub: SinonStub;
  let loggerInfoStub: SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    releaseStockStub = sandbox.stub().resolves();
    transactionStub = sandbox.stub();
    loggerInfoStub = sandbox.stub();

    const module = await esmock("../../src/services/reservation-expiry.service.js", {
      "../../src/db.js": {
        prisma: { $transaction: transactionStub },
      },
      "../../src/lib/inventory.js": {
        releaseStock: releaseStockStub,
        ensureProductInventory: sandbox.stub(),
        holdStock: sandbox.stub(),
      },
      "../../src/lib/logger.js": {
        logger: {
          info: loggerInfoStub,
          error: sandbox.stub(),
          warn: sandbox.stub(),
        },
        logRequest: sandbox.stub(),
        logRequestError: sandbox.stub(),
      },
    });

    expireReservation = module.expireReservation;
  });

  afterEach(() => {
    sandbox.restore();
    esmock.purge("../../src/services/reservation-expiry.service.js");
  });

  it("does nothing when no pending expired reservation matches", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 0 });
    const inventoryLogCreateStub = sandbox.stub();

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: sandbox.stub(),
        },
        inventoryLog: { create: inventoryLogCreateStub },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    expect(updateManyStub.calledOnce).to.equal(true);
    expect(inventoryLogCreateStub.called).to.equal(false);
    expect(releaseStockStub.called).to.equal(false);
    expect(loggerInfoStub.called).to.equal(false);
  });

  it("updates only pending reservations whose expiresAt is in the past", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 0 });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: sandbox.stub(),
        },
        inventoryLog: { create: sandbox.stub() },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    const updateArgs = updateManyStub.firstCall.args[0];
    expect(updateArgs.where.reservationId).to.equal(reservationId);
    expect(updateArgs.where.reservationStatus).to.equal("PENDING");
    expect(updateArgs.where.expiresAt.lte).to.be.instanceOf(Date);
    expect(updateArgs.data.reservationStatus).to.equal("EXPIRED");
  });

  it("does not restore Redis stock when the reservation row is missing after update", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves(null);
    const inventoryLogCreateStub = sandbox.stub();

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: inventoryLogCreateStub },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    expect(findUniqueStub.calledOnceWith({ where: { reservationId }, select: { productId: true, quantity: true } })).to.equal(true);
    expect(inventoryLogCreateStub.called).to.equal(false);
    expect(releaseStockStub.called).to.equal(false);
    expect(loggerInfoStub.called).to.equal(false);
  });

  it("marks reservation expired, logs event, restores Redis stock, and logs success", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });
    const inventoryLogCreateStub = sandbox.stub().resolves({});

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: inventoryLogCreateStub },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    expect(updateManyStub.calledOnce).to.equal(true);
    expect(inventoryLogCreateStub.calledOnceWith({
      data: {
        productId,
        inventoryReason: `Reservation expired: ${reservationId}`,
      },
    })).to.equal(true);
    expect(releaseStockStub.calledOnceWith(productId, quantity)).to.equal(true);
    expect(loggerInfoStub.calledOnceWith("Reservation expired", {
      reservationId,
      productId,
      quantity,
    })).to.equal(true);
  });

  it("propagates errors when Redis stock release fails", async () => {
    const releaseError = new Error("Redis unavailable");
    releaseStockStub.rejects(releaseError);

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: sandbox.stub().resolves({ count: 1 }),
          findUnique: sandbox.stub().resolves({ productId, quantity }),
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    try {
      await expireReservation(reservationId);
      expect.fail("Expected releaseStock error");
    } catch (error) {
      expect(error).to.equal(releaseError);
    }

    expect(loggerInfoStub.called).to.equal(false);
  });
});
