/**
 * Verifies checkout applies reservation completion, stock decrement,
 * inventory audit, and order creation in one DB transaction.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox, SinonStub } from "sinon";

describe("checkoutReservation transactional stock update", () => {
  const reservationId = "44444444-4444-4444-4444-444444444444";
  const userId = "11111111-1111-1111-1111-111111111111";
  const productId = "22222222-2222-2222-2222-222222222222";
  const quantity = 2;

  let sandbox: SinonSandbox;
  let checkoutReservation: typeof import("../../src/services/checkout.service.js").checkoutReservation;
  let transactionStub: SinonStub;
  let updateReservationStub: SinonStub;
  let updateProductStub: SinonStub;
  let inventoryLogCreateStub: SinonStub;
  let orderCreateStub: SinonStub;
  let operationsInTransaction: string[];

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    operationsInTransaction = [];

    updateReservationStub = sandbox.stub().callsFake(async () => {
      operationsInTransaction.push("reservation.updateMany");
      return { count: 1 };
    });
    updateProductStub = sandbox.stub().callsFake(async () => {
      operationsInTransaction.push("product.updateMany");
      return { count: 1 };
    });
    inventoryLogCreateStub = sandbox.stub().callsFake(async () => {
      operationsInTransaction.push("inventoryLog.create");
      return {};
    });
    orderCreateStub = sandbox.stub().callsFake(async () => {
      operationsInTransaction.push("order.create");
      return {
        orderId: "order-1",
        reservationId,
        orderStatus: "PAID",
      };
    });

    transactionStub = sandbox.stub().callsFake(async (fn) => {
      const tx = {
        reservation: {
          updateMany: updateReservationStub,
        },
        product: {
          updateMany: updateProductStub,
        },
        inventoryLog: {
          create: inventoryLogCreateStub,
        },
        order: {
          create: orderCreateStub,
        },
      };
      return fn(tx as never);
    });

    const module = await esmock("../../src/services/checkout.service.js", {
      "../../src/db.js": {
        prisma: {
          reservation: {
            findUnique: sandbox.stub().resolves({
              reservationId,
              userId,
              productId,
              quantity,
              reservationStatus: "PENDING",
              expiresAt: new Date(Date.now() + 300_000),
            }),
          },
          $transaction: transactionStub,
        },
      },
      "../../src/queues/reservation.queue.js": {
        cancelReservationExpiry: sandbox.stub().resolves(),
        scheduleReservationExpiry: sandbox.stub(),
        reservationExpiryQueue: {},
        closeReservationExpiryQueue: sandbox.stub(),
      },
    });

    checkoutReservation = module.checkoutReservation;
  });

  afterEach(() => {
    sandbox.restore();
    esmock.purge("../../src/services/checkout.service.js");
  });

  it("completes reservation, decrements stock, logs inventory, and creates order in one transaction", async () => {
    const result = await checkoutReservation(userId, reservationId);

    expect(transactionStub.calledOnce).to.equal(true);
    expect(updateReservationStub.calledOnce).to.equal(true);
    expect(updateProductStub.calledOnceWith({
      where: {
        productId,
        productStock: { gte: quantity },
      },
      data: { productStock: { decrement: quantity } },
    })).to.equal(true);
    expect(inventoryLogCreateStub.calledOnceWith({
      data: {
        productId,
        inventoryReason: `Checkout completed: ${reservationId}, quantity ${quantity}`,
      },
    })).to.equal(true);
    expect(orderCreateStub.calledOnce).to.equal(true);
    expect(operationsInTransaction).to.deep.equal([
      "reservation.updateMany",
      "product.updateMany",
      "inventoryLog.create",
      "order.create",
    ]);
    expect(result.orderId).to.equal("order-1");
  });

  it("does not create an order when the transactional stock decrement fails", async () => {
    updateProductStub.callsFake(async () => {
      operationsInTransaction.push("product.updateMany");
      return { count: 0 };
    });

    try {
      await checkoutReservation(userId, reservationId);
      expect.fail("Expected checkout to fail");
    } catch (error) {
      expect((error as { statusCode?: number }).statusCode).to.equal(409);
    }

    expect(orderCreateStub.called).to.equal(false);
    expect(inventoryLogCreateStub.called).to.equal(false);
    expect(operationsInTransaction).to.deep.equal([
      "reservation.updateMany",
      "product.updateMany",
    ]);
  });
});
