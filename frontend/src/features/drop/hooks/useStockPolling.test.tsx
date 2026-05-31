import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStockPolling } from "./useStockPolling.js";
import * as productsApi from "../../../api/productsApi.js";
import type { ProductAvailability } from "../../../types/api.types.js";

vi.mock("../../../api/productsApi.js", () => ({
  fetchProductAvailability: vi.fn(),
}));

vi.mock("../../../config/env.js", () => ({
  appConfig: {
    apiTimeoutMs: 5_000,
    stockPollMs: 2_000,
    defaultProductId: "",
  },
}));

const fetchProductAvailabilityMock = vi.mocked(productsApi.fetchProductAvailability);

describe("useStockPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with loading state", () => {
    fetchProductAvailabilityMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useStockPolling("prod-1"));

    expect(result.current.isLoading).to.equal(true);
    expect(result.current.availability).to.equal(null);
    expect(result.current.error).to.equal(null);
  });

  it("fetches product availability on mount", async () => {
    const availability: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    };

    fetchProductAvailabilityMock.mockResolvedValue(availability);

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await waitFor(() => {
      expect(result.current.isLoading).to.equal(false);
    }, { timeout: 1000 });

    expect(result.current.availability).to.deep.equal(availability);
    expect(result.current.error).to.equal(null);
    expect(fetchProductAvailabilityMock).toHaveBeenCalledWith("prod-1");
    expect(fetchProductAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it("polls for updates at the configured interval", async () => {
    vi.useFakeTimers();

    const availability1: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    };

    const availability2: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 50,
      dropStartsAt: new Date().toISOString(),
    };

    let resolveFirst: (value: ProductAvailability) => void;
    let resolveSecond: (value: ProductAvailability) => void;

    fetchProductAvailabilityMock
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveSecond = resolve;
      }));

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await act(async () => {
      resolveFirst!(availability1);
      await Promise.resolve();
    });

    expect(result.current.availability).to.deep.equal(availability1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      resolveSecond!(availability2);
      await Promise.resolve();
    });

    expect(result.current.availability).to.deep.equal(availability2);
    expect(fetchProductAvailabilityMock).toHaveBeenCalledTimes(2);
  }, 15000);

  it("handles API errors and displays error message", async () => {
    fetchProductAvailabilityMock.mockRejectedValue({
      error: "Product not found",
      statusCode: 404,
    });

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await waitFor(() => {
      expect(result.current.isLoading).to.equal(false);
    }, { timeout: 1000 });

    expect(result.current.error).to.equal("Product not found");
    expect(result.current.availability).to.equal(null);
  });

  it("handles network errors gracefully", async () => {
    fetchProductAvailabilityMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await waitFor(() => {
      expect(result.current.isLoading).to.equal(false);
    }, { timeout: 1000 });

    expect(result.current.error).to.contain("Network error");
    expect(result.current.availability).to.equal(null);
  });

  it("handles timeout errors", async () => {
    fetchProductAvailabilityMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await waitFor(() => {
      expect(result.current.isLoading).to.equal(false);
    }, { timeout: 1000 });

    expect(result.current.error).to.contain("timed out");
    expect(result.current.availability).to.equal(null);
  });

  it("clears error on successful refresh after error", async () => {
    vi.useFakeTimers();

    let resolveFirst: (value: never) => void;
    let resolveSecond: (value: ProductAvailability) => void;

    fetchProductAvailabilityMock
      .mockImplementationOnce(() => new Promise((_, reject) => {
        resolveFirst = reject;
      }))
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveSecond = resolve;
      }));

    const availability: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    };

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await act(async () => {
      resolveFirst!({ error: "Server error", statusCode: 500 });
      await Promise.resolve();
    });

    expect(result.current.error).to.equal("Server error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      resolveSecond!(availability);
      await Promise.resolve();
    });

    expect(result.current.error).to.equal(null);
    expect(result.current.availability).to.deep.equal(availability);
  }, 15000);

  it("does not fetch when productId is null", async () => {
    const { result } = renderHook(() => useStockPolling(null));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(fetchProductAvailabilityMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).to.equal(true);
    expect(result.current.availability).to.equal(null);
  });

  it("manual refresh updates availability immediately", async () => {
    const availability1: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    };

    const availability2: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 60,
      dropStartsAt: new Date().toISOString(),
    };

    fetchProductAvailabilityMock
      .mockResolvedValueOnce(availability1)
      .mockResolvedValueOnce(availability2);

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await waitFor(() => {
      expect(result.current.availability).to.deep.equal(availability1);
    }, { timeout: 1000 });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.availability).to.deep.equal(availability2);
    expect(fetchProductAvailabilityMock).toHaveBeenCalledTimes(2);
  });

  it("cleans up interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    fetchProductAvailabilityMock.mockResolvedValue({
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    });

    const { unmount } = renderHook(() => useStockPolling("prod-1"));

    await waitFor(() => {
      expect(fetchProductAvailabilityMock).toHaveBeenCalled();
    }, { timeout: 1000 });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("restarts polling when productId changes", async () => {
    const availability1: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    };

    const availability2: ProductAvailability = {
      productId: "prod-2",
      totalStock: 50,
      availableStock: 25,
      dropStartsAt: new Date().toISOString(),
    };

    fetchProductAvailabilityMock
      .mockResolvedValueOnce(availability1)
      .mockResolvedValueOnce(availability2);

    const { result, rerender } = renderHook(
      ({ id }) => useStockPolling(id),
      { initialProps: { id: "prod-1" } },
    );

    await waitFor(() => {
      expect(result.current.availability?.productId).to.equal("prod-1");
    }, { timeout: 1000 });

    rerender({ id: "prod-2" });

    await waitFor(() => {
      expect(result.current.availability?.productId).to.equal("prod-2");
    }, { timeout: 1000 });

    expect(fetchProductAvailabilityMock).toHaveBeenCalledWith("prod-1");
    expect(fetchProductAvailabilityMock).toHaveBeenCalledWith("prod-2");
  });

  it("continues polling after a failed request", async () => {
    vi.useFakeTimers();

    let resolveFirst: (value: never) => void;
    let resolveSecond: (value: ProductAvailability) => void;

    const availability: ProductAvailability = {
      productId: "prod-1",
      totalStock: 100,
      availableStock: 75,
      dropStartsAt: new Date().toISOString(),
    };

    fetchProductAvailabilityMock
      .mockImplementationOnce(() => new Promise((_, reject) => {
        resolveFirst = reject;
      }))
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveSecond = resolve;
      }));

    const { result } = renderHook(() => useStockPolling("prod-1"));

    await act(async () => {
      resolveFirst!({ error: "Server error", statusCode: 500 });
      await Promise.resolve();
    });

    expect(result.current.error).to.equal("Server error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      resolveSecond!(availability);
      await Promise.resolve();
    });

    expect(result.current.availability).to.deep.equal(availability);
    expect(result.current.error).to.equal(null);
  }, 15000);
});
