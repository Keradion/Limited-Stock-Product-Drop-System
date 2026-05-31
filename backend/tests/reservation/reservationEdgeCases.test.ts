/**
 * Additional edge case tests for reservation creation logic
 * covering boundary conditions, timing edge cases, and error scenarios.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox, SinonStub } from "sinon";
import { AppError } from "../../src/lib/errors.js";

describe("createReservation edge cases", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const productId = "22222222-2222-2222-2222-222222222222";

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
    updateManyStub = sandbox.stub().resolves({ count: 1 });

    findProductStub = sandbox.stub().resolves({
      productId,
      productName: "Test Product",
      productStock: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    transactionStub = sandbox.stub().callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: findProductStub,
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: 0 } }),
          create: sandbox.stub().resolves({
            reservationId: "33333333-3333-3333-3333-333333333333",
            userId,
            productId,
            quantity: 1,
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

  it("reserves the last available unit successfully", async () => {
    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves({
            productId,
            productStock: 10,
          }),
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: 9 } }),
          create: sandbox.stub().resolves({
            reservationId: "last-unit-res",
            userId,
            productId,
            quantity: 1,
            reservationStatus: "PENDING",
            expiresAt: new Date(Date.now() + 300_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };
      return fn(tx as never);
    });

    const result = await createReservation(userId, productId, 1);

    expect(result.reservationId).to.equal("last-unit-res");
    expect(holdStockStub.calledOnceWith(productId, 1)).to.equal(true);
  });

  it("rejects reservation when exactly stock limit is already held", async () => {
    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves({
            productId,
            productStock: 10,
          }),
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: 10 } }),
          create: sandbox.stub(),
        },
      };
      return fn(tx as never);
    });

    try {
      await createReservation(userId, productId, 1);
      expect.fail("Expected AppError");
    } catch (error) {
      expect((error as AppError).statusCode).to.equal(409);
      expect((error as AppError).message).to.include("Insufficient stock");
    }

    expect(releaseStockStub.calledOnceWith(productId, 1)).to.equal(true);
  });

  it("handles zero stock product correctly", async () => {
    findProductStub.resolves({
      productId,
      productName: "Sold Out Product",
      productStock: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    holdStockStub.resolves("INSUFFICIENT");

    try {
      await createReservation(userId, productId, 1);
      expect.fail("Expected AppError");
    } catch (error) {
      expect((error as AppError).statusCode).to.equal(409);
      expect((error as AppError).message).to.equal("Insufficient stock");
    }
  });

  it("handles large quantity reservations", async () => {
    const largeQuantity = 100;

    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves({
            productId,
            productStock: 1000,
          }),
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: 0 } }),
          create: sandbox.stub().resolves({
            reservationId: "large-res",
            userId,
            productId,
            quantity: largeQuantity,
            reservationStatus: "PENDING",
            expiresAt: new Date(Date.now() + 300_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };
      return fn(tx as never);
    });

    const result = await createReservation(userId, productId, largeQuantity);

    expect(result.reservationId).to.equal("large-res");
    expect(holdStockStub.calledOnceWith(productId, largeQuantity)).to.equal(true);
  });

  it("handles product that disappears between checks", async () => {
    findProductStub.onFirstCall().resolves({
      productId,
      productStock: 10,
    });

    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves(null),
        },
        reservation: {
          aggregate: sandbox.stub(),
          create: sandbox.stub(),
        },
      };
      return fn(tx as never);
    });

    try {
      await createReservation(userId, productId, 1);
      expect.fail("Expected AppError");
    } catch (error) {
      expect((error as AppError).statusCode).to.equal(404);
    }

    expect(releaseStockStub.calledOnceWith(productId, 1)).to.equal(true);
  });

  it("releases stock when ensureInventory fails", async () => {
    ensureInventoryStub.rejects(new Error("Redis connection failed"));

    try {
      await createReservation(userId, productId, 1);
      expect.fail("Expected error");
    } catch (error) {
      expect((error as Error).message).to.equal("Redis connection failed");
    }

    expect(holdStockStub.called).to.equal(false);
  });

  it("handles pending _sum.quantity being null", async () => {
    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves({
            productId,
            productStock: 10,
          }),
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: null } }),
          create: sandbox.stub().resolves({
            reservationId: "null-sum-res",
            userId,
            productId,
            quantity: 1,
            reservationStatus: "PENDING",
            expiresAt: new Date(Date.now() + 300_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };
      return fn(tx as never);
    });

    const result = await createReservation(userId, productId, 1);

    expect(result.reservationId).to.equal("null-sum-res");
  });

  it("cancels reservation in DB when scheduling expiry fails", async () => {
    scheduleExpiryStub.rejects(new Error("Bull queue unavailable"));

    try {
      await createReservation(userId, productId, 1);
      expect.fail("Expected error");
    } catch (error) {
      expect((error as Error).message).to.equal("Bull queue unavailable");
    }

    expect(releaseStockStub.calledOnce).to.equal(true);
    expect(updateManyStub.calledOnce).to.equal(true);

    const updateArgs = updateManyStub.firstCall.args[0];
    expect(updateArgs.data.reservationStatus).to.equal("CANCELLED");
  });

  it("handles concurrent transaction conflicts gracefully", async () => {
    transactionStub.rejects(new Error("Transaction conflict - retry"));

    try {
      await createReservation(userId, productId, 1);
      expect.fail("Expected error");
    } catch (error) {
      expect((error as Error).message).to.include("Transaction conflict");
    }

    expect(releaseStockStub.calledOnceWith(productId, 1)).to.equal(true);
  });

  it("validates expiration time is in the future", async () => {
    let capturedExpiresAt: Date | null = null;

    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves({
            productId,
            productStock: 10,
          }),
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: 0 } }),
          create: sandbox.stub().callsFake(async ({ data }) => {
            capturedExpiresAt = data.expiresAt;
            return {
              reservationId: "time-check-res",
              userId,
              productId,
              quantity: 1,
              reservationStatus: "PENDING",
              expiresAt: data.expiresAt,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }),
        },
      };
      return fn(tx as never);
    });

    await createReservation(userId, productId, 1);

    expect(capturedExpiresAt).to.not.be.null;
    expect(capturedExpiresAt!.getTime()).to.be.greaterThan(Date.now());
  });

  it("includes correct userId in reservation", async () => {
    const specificUserId = "specific-user-99";
    let capturedUserId: string | null = null;

    transactionStub.callsFake(async (fn) => {
      const tx = {
        product: {
          findUnique: sandbox.stub().resolves({
            productId,
            productStock: 10,
          }),
        },
        reservation: {
          aggregate: sandbox.stub().resolves({ _sum: { quantity: 0 } }),
          create: sandbox.stub().callsFake(async ({ data }) => {
            capturedUserId = data.userId;
            return {
              reservationId: "user-check-res",
              userId: data.userId,
              productId,
              quantity: 1,
              reservationStatus: "PENDING",
              expiresAt: new Date(Date.now() + 300_000),
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }),
        },
      };
      return fn(tx as never);
    });

    await createReservation(specificUserId, productId, 1);

    expect(capturedUserId).to.equal(specificUserId);
  });

  it("returns ISO formatted expiration date", async () => {
    const result = await createReservation(userId, productId, 1);

    expect(result.expiresAt).to.be.a("string");
    expect(() => new Date(result.expiresAt)).to.not.throw();

    const expiresDate = new Date(result.expiresAt);
    expect(expiresDate.toISOString()).to.equal(result.expiresAt);
  });
});
