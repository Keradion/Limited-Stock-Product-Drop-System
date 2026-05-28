import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./httpClient.js";

vi.mock("../config/env.js", () => ({
  appConfig: {
    apiTimeoutMs: 100,
    stockPollMs: 5_000,
    defaultProductId: "",
  },
}));

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 409 ? "Conflict" : "OK",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("apiRequest", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns parsed JSON on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse(200, { token: "abc" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "a@b.com", password: "secret" },
    });

    expect(result.token).to.equal("abc");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).to.equal("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Accept: "application/json",
    });
  });

  it("throws API error body on non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse(409, { error: "Insufficient stock", statusCode: 409 }),
      ),
    );

    try {
      await apiRequest("/api/reserve", { method: "POST", body: { productId: "x", quantity: 1 } });
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({ error: "Insufficient stock", statusCode: 409 });
    }
  });

  it("throws when auth is required but token is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      await apiRequest("/api/reserve", { auth: true });
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({ error: "Not authenticated", statusCode: 401 });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Authorization header when token exists", async () => {
    localStorage.setItem("limited_drop_token", "jwt-token");
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/reservations", { auth: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer jwt-token",
    });
  });

  it("aborts the request when the timeout elapses", async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const pending = apiRequest("/api/products").catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(100);

    const result = await pending;
    expect(result).to.be.instanceOf(DOMException);
    expect((result as DOMException).name).to.equal("AbortError");
  });
});
