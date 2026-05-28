/**
 * Simulates races between checkout and expiry on the same reservation.
 * Both paths use status-guarded updateMany — only one transition should win.
 */
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import type { SinonSandbox } from "sinon";
import { ReservationRaceState } from "../helpers/reservationRaceState.js";
import { AppError } from "../../src/lib/errors.js";

describe("checkout vs expiry concurrency simulation", function () {
  this.timeout(10_000);
  const reservationId = "44444444-4444-4444-4444-444444444444";
  const userId = "11111111-1111-1111-1111-111111111111";
  const productId = "22222222-2222-2222-2222-222222222222";
  const quantity = 2;

  let sandbox: SinonSandbox;
  let raceState: ReservationRaceState;
  let checkoutReservation: typeof import("../../src/services/checkout.service.js").checkoutReservation;
  let expireReservation: typeof import("../../src/services/reservation-expiry.service.js").expireReservation;

  function buildCheckoutMocks(state: ReservationRaceState, now: Date) {
    return {
      "../../src/db.js": {
        prisma: {
          reservation: {
            findUnique: sandbox.stub().callsFake(async () => ({
              reservationId,
              userId,
              productId,
              quantity,
              reservationStatus: state.status,
              expiresAt: state.expiresAt,
              createdAt: now,
              updatedAt: now,
            })),
          },
          $transaction: sandbox.stub().callsFake(async (fn) => {
            const tx = {
              reservation: {
                updateMany: sandbox.stub().callsFake(async () => {
                  const won = state.tryCompleteCheckout(now);
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
    };
  }

  function buildExpiryMocks(state: ReservationRaceState, now: Date) {
    return {
      "../../src/db.js": {
        prisma: {
          $transaction: sandbox.stub().callsFake(async (fn) => {
            const tx = {
              reservation: {
                updateMany: sandbox.stub().callsFake(async () => {
                  const won = state.tryExpire(now);
                  return { count: won ? 1 : 0 };
                }),
                findUnique: sandbox.stub().callsFake(async () =>
                  state.status === "EXPIRED"
                    ? { productId, quantity }
                    : null,
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
        logger: { info: sandbox.stub(), error: sandbox.stub(), warn: sandbox.stub() },
        logRequest: sandbox.stub(),
        logRequestError: sandbox.stub(),
      },
    };
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    esmock.purge("../../src/services/checkout.service.js");
    esmock.purge("../../src/services/reservation-expiry.service.js");
  });

  it("lets only checkout win when both race before expiresAt", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300_000);
    raceState = new ReservationRaceState(
      reservationId,
      userId,
      productId,
      quantity,
      expiresAt,
    );

    const checkoutModule = await esmock(
      "../../src/services/checkout.service.js",
      buildCheckoutMocks(raceState, now),
    );
    const expiryModule = await esmock(
      "../../src/services/reservation-expiry.service.js",
      buildExpiryMocks(raceState, now),
    );

    checkoutReservation = checkoutModule.checkoutReservation;
    expireReservation = expiryModule.expireReservation;

    const [checkoutOutcome, expiryOutcome] = await Promise.allSettled([
      checkoutReservation(userId, reservationId),
      expireReservation(reservationId),
    ]);

    expect(checkoutOutcome.status).to.equal("fulfilled");
    expect(expiryOutcome.status).to.equal("fulfilled");
    expect(raceState.status).to.equal("COMPLETED");
  });

  it("lets only expiry win when both race after expiresAt", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1_000);
    raceState = new ReservationRaceState(
      reservationId,
      userId,
      productId,
      quantity,
      expiresAt,
    );

    const checkoutModule = await esmock(
      "../../src/services/checkout.service.js",
      buildCheckoutMocks(raceState, now),
    );
    const expiryModule = await esmock(
      "../../src/services/reservation-expiry.service.js",
      buildExpiryMocks(raceState, now),
    );

    checkoutReservation = checkoutModule.checkoutReservation;
    expireReservation = expiryModule.expireReservation;

    const [checkoutOutcome, expiryOutcome] = await Promise.allSettled([
      checkoutReservation(userId, reservationId),
      expireReservation(reservationId),
    ]);

    expect(checkoutOutcome.status).to.equal("rejected");
    expect((checkoutOutcome as PromiseRejectedResult).reason).to.be.instanceOf(AppError);
    expect((checkoutOutcome as PromiseRejectedResult).reason.statusCode).to.equal(410);
    expect(expiryOutcome.status).to.equal("fulfilled");
    expect(raceState.status).to.equal("EXPIRED");
  });

  it("rejects checkout when expiry won between the read and the transaction", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300_000);
    raceState = new ReservationRaceState(
      reservationId,
      userId,
      productId,
      quantity,
      expiresAt,
    );

    // Expiry finished first; checkout still has a stale PENDING read
    raceState.status = "EXPIRED";

    const checkoutModule = await esmock("../../src/services/checkout.service.js", {
      "../../src/db.js": {
        prisma: {
          reservation: {
            findUnique: sandbox.stub().resolves({
              reservationId,
              userId,
              productId,
              quantity,
              reservationStatus: "PENDING",
              expiresAt: raceState.expiresAt,
              createdAt: now,
              updatedAt: now,
            }),
          },
          $transaction: sandbox.stub().callsFake(async (fn) => {
            const tx = {
              reservation: {
                updateMany: sandbox.stub().callsFake(async () => {
                  const won = raceState.tryCompleteCheckout(now);
                  return { count: won ? 1 : 0 };
                }),
              },
              product: { updateMany: sandbox.stub() },
              order: { create: sandbox.stub() },
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
    checkoutReservation = checkoutModule.checkoutReservation;

    try {
      await checkoutReservation(userId, reservationId);
      expect.fail("Expected checkout to fail after expiry won the race");
    } catch (error) {
      expect(error).to.be.instanceOf(AppError);
      expect((error as AppError).statusCode).to.equal(409);
      expect((error as AppError).message).to.equal("Reservation is no longer available");
    }
  });

  it("runs many checkout attempts in parallel but completes only once", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300_000);
    raceState = new ReservationRaceState(
      reservationId,
      userId,
      productId,
      quantity,
      expiresAt,
    );

    const checkoutModule = await esmock(
      "../../src/services/checkout.service.js",
      buildCheckoutMocks(raceState, now),
    );
    checkoutReservation = checkoutModule.checkoutReservation;

    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, () => checkoutReservation(userId, reservationId)),
    );

    const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const conflicts = outcomes.filter(
      (outcome) =>
        outcome.status === "rejected" &&
        outcome.reason instanceof AppError &&
        outcome.reason.statusCode === 409,
    );

    expect(successes).to.have.length(1);
    expect(conflicts).to.have.length(19);
    expect(raceState.status).to.equal("COMPLETED");
  });
});
