import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutReservation } from "./checkoutApi.js";
import * as httpClient from "./httpClient.js";

vi.mock("./httpClient.js", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(httpClient.apiRequest);

describe("checkoutReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully completes checkout", async () => {
    const checkoutResponse = {
      orderId: "order-123",
      status: "CONFIRMED",
      message: "Order confirmed",
    };

    apiRequestMock.mockResolvedValue(checkoutResponse);

    const result = await checkoutReservation("res-456");

    expect(result).to.deep.equal(checkoutResponse);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/checkout",
      {
        method: "POST",
        auth: true,
        body: { reservationId: "res-456" },
      },
    );
  });

  it("handles reservation not found error", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Reservation not found",
      statusCode: 404,
    });

    try {
      await checkoutReservation("invalid-res");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Reservation not found",
        statusCode: 404,
      });
    }
  });

  it("handles expired reservation error", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Reservation has expired",
      statusCode: 400,
    });

    try {
      await checkoutReservation("expired-res");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Reservation has expired",
        statusCode: 400,
      });
    }
  });

  it("handles authentication errors", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Not authenticated",
      statusCode: 401,
    });

    try {
      await checkoutReservation("res-123");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Not authenticated",
        statusCode: 401,
      });
    }
  });

  it("handles conflict errors when reservation already checked out", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Reservation already processed",
      statusCode: 409,
    });

    try {
      await checkoutReservation("res-123");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Reservation already processed",
        statusCode: 409,
      });
    }
  });

  it("handles server errors", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Internal server error",
      statusCode: 500,
    });

    try {
      await checkoutReservation("res-123");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Internal server error",
        statusCode: 500,
      });
    }
  });

  it("handles network errors", async () => {
    apiRequestMock.mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await checkoutReservation("res-123");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.be.instanceOf(TypeError);
    }
  });

  it("handles timeout errors", async () => {
    apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    try {
      await checkoutReservation("res-123");
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.be.instanceOf(DOMException);
      expect((error as DOMException).name).to.equal("AbortError");
    }
  });

  it("requires authentication", async () => {
    apiRequestMock.mockResolvedValue({
      orderId: "order-123",
      status: "CONFIRMED",
      message: "Order confirmed",
    });

    await checkoutReservation("res-123");

    const callArgs = apiRequestMock.mock.calls[0];
    expect(callArgs[1]).to.have.property("auth", true);
  });

  it("sends correct request method", async () => {
    apiRequestMock.mockResolvedValue({
      orderId: "order-123",
      status: "CONFIRMED",
      message: "Order confirmed",
    });

    await checkoutReservation("res-123");

    const callArgs = apiRequestMock.mock.calls[0];
    expect(callArgs[1]).to.have.property("method", "POST");
  });
});
