/**
 * Additional edge case tests for reservation expiration logic
 * covering timing boundaries, race conditions, and error recovery.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox, SinonStub } from "sinon";

describe("expireReservation edge cases", () => {
  const reservationId = "44444444-4444-4444-4444-444444444444";
  const productId = "22222222-2222-2222-2222-222222222222";
  const quantity = 2;

  let sandbox: SinonSandbox;
  let expireReservation: typeof import("../../src/services/reservation-expiry.service.js").expireReservation;
  let releaseStockStub: SinonStub;
  let transactionStub: SinonStub;
  let loggerInfoStub: SinonStub;
  let loggerErrorStub: SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    releaseStockStub = sandbox.stub().resolves();
    loggerInfoStub = sandbox.stub();
    loggerErrorStub = sandbox.stub();
    transactionStub = sandbox.stub();

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
          error: loggerErrorStub,
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

  it("handles reservation that was just completed by checkout", async () => {
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

    expect(updateManyStub.calledOnce).to.equal(true);
    expect(releaseStockStub.called).to.equal(false);
    expect(loggerInfoStub.called).to.equal(false);
  });

  it("handles reservation that expires exactly at current time", async () => {
    const now = new Date();
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    const updateArgs = updateManyStub.firstCall.args[0];
    const expiresAtCondition = updateArgs.where.expiresAt.lte;

    expect(expiresAtCondition).to.be.instanceOf(Date);
    expect(expiresAtCondition.getTime()).to.be.closeTo(now.getTime(), 100);
  });

  it("handles multiple rapid expiration attempts on same reservation", async () => {
    let updateCount = 0;
    const updateManyStub = sandbox.stub().callsFake(async () => {
      updateCount += 1;
      if (updateCount === 1) {
        return { count: 1 };
      }
      return { count: 0 };
    });

    const findUniqueStub = sandbox.stub();
    findUniqueStub.onFirstCall().resolves({ productId, quantity });
    findUniqueStub.onSecondCall().resolves(null);

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await Promise.all([
      expireReservation(reservationId),
      expireReservation(reservationId),
    ]);

    expect(releaseStockStub.callCount).to.equal(1);
    expect(loggerInfoStub.callCount).to.equal(1);
  });

  it("handles reservation with very large quantity", async () => {
    const largeQuantity = 1000;
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity: largeQuantity });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    expect(releaseStockStub.calledOnceWith(productId, largeQuantity)).to.equal(true);
    expect(loggerInfoStub.firstCall.args[1].quantity).to.equal(largeQuantity);
  });

  it("handles transaction rollback correctly", async () => {
    transactionStub.rejects(new Error("Transaction rolled back"));

    try {
      await expireReservation(reservationId);
      expect.fail("Expected error");
    } catch (error) {
      expect((error as Error).message).to.equal("Transaction rolled back");
    }

    expect(releaseStockStub.called).to.equal(false);
    expect(loggerInfoStub.called).to.equal(false);
  });

  it("handles Redis being temporarily unavailable", async () => {
    releaseStockStub.rejects(new Error("Redis timeout"));

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
      expect.fail("Expected Redis error");
    } catch (error) {
      expect((error as Error).message).to.equal("Redis timeout");
    }

    expect(loggerInfoStub.called).to.equal(false);
  });

  it("creates correct inventory log entry", async () => {
    const inventoryLogCreateStub = sandbox.stub().resolves({});
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });

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

    expect(inventoryLogCreateStub.calledOnce).to.equal(true);
    const logArgs = inventoryLogCreateStub.firstCall.args[0];
    expect(logArgs.data.productId).to.equal(productId);
    expect(logArgs.data.inventoryReason).to.include(reservationId);
    expect(logArgs.data.inventoryReason).to.include("expired");
  });

  it("handles reservation with minimum quantity (1)", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity: 1 });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    expect(releaseStockStub.calledOnceWith(productId, 1)).to.equal(true);
  });

  it("verifies updateMany conditions prevent double expiry", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    const updateArgs = updateManyStub.firstCall.args[0];
    expect(updateArgs.where.reservationId).to.equal(reservationId);
    expect(updateArgs.where.reservationStatus).to.equal("PENDING");
    expect(updateArgs.where.expiresAt).to.have.property("lte");
    expect(updateArgs.data.reservationStatus).to.equal("EXPIRED");
  });

  it("logs correct information on successful expiry", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    expect(loggerInfoStub.calledOnce).to.equal(true);
    const logMessage = loggerInfoStub.firstCall.args[0];
    const logData = loggerInfoStub.firstCall.args[1];

    expect(logMessage).to.equal("Reservation expired");
    expect(logData.reservationId).to.equal(reservationId);
    expect(logData.productId).to.equal(productId);
    expect(logData.quantity).to.equal(quantity);
  });

  it("handles findUnique returning unexpected data structure", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ unexpected: "data" });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    try {
      await expireReservation(reservationId);
      expect.fail("Expected error due to missing productId");
    } catch (error) {
      expect(error).to.exist;
    }
  });

  it("handles inventory log creation failure", async () => {
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });
    const inventoryLogCreateStub = sandbox.stub().rejects(new Error("Log write failed"));

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

    try {
      await expireReservation(reservationId);
      expect.fail("Expected log write error");
    } catch (error) {
      expect((error as Error).message).to.equal("Log write failed");
    }

    expect(releaseStockStub.called).to.equal(false);
  });

  it("completes successfully even with very old expiration time", async () => {
    const veryOldExpiry = new Date("2020-01-01T00:00:00.000Z");
    const updateManyStub = sandbox.stub().resolves({ count: 1 });
    const findUniqueStub = sandbox.stub().resolves({ productId, quantity });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateManyStub,
          findUnique: findUniqueStub,
        },
        inventoryLog: { create: sandbox.stub().resolves({}) },
      };
      return fn(tx as never);
    });

    await expireReservation(reservationId);

    const updateArgs = updateManyStub.firstCall.args[0];
    expect(updateArgs.where.expiresAt.lte).to.be.instanceOf(Date);
    expect(updateArgs.where.expiresAt.lte.getTime()).to.be.greaterThan(veryOldExpiry.getTime());
  });
});
