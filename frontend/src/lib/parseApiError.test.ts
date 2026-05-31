import { describe, expect, it } from "vitest";
import { parseApiError } from "./parseApiError.js";

describe("parseApiError", () => {
  it("detects API error bodies from the backend", () => {
    const parsed = parseApiError({ error: "Insufficient stock", statusCode: 409 });
    expect(parsed.message).to.equal("Insufficient stock");
    expect(parsed.statusCode).to.equal(409);
    expect(parsed.isTimeout).to.equal(false);
    expect(parsed.isNetworkError).to.equal(false);
  });

  it("detects timeout abort errors", () => {
    const parsed = parseApiError(new DOMException("Aborted", "AbortError"));
    expect(parsed.isTimeout).to.equal(true);
    expect(parsed.isNetworkError).to.equal(false);
    expect(parsed.message).to.contain("timed out");
    expect(parsed.statusCode).to.equal(null);
  });

  it("detects network failures", () => {
    const parsed = parseApiError(new TypeError("Failed to fetch"));
    expect(parsed.isNetworkError).to.equal(true);
    expect(parsed.isTimeout).to.equal(false);
    expect(parsed.message).to.contain("Network error");
  });

  it("uses Error.message for generic errors", () => {
    const parsed = parseApiError(new Error("Unexpected failure"));
    expect(parsed.message).to.equal("Unexpected failure");
    expect(parsed.statusCode).to.equal(null);
  });

  it("returns a fallback for unknown values", () => {
    const parsed = parseApiError({ foo: "bar" });
    expect(parsed.message).to.equal("Something went wrong.");
    expect(parsed.statusCode).to.equal(null);
  });

  it("ignores malformed API bodies missing statusCode", () => {
    const parsed = parseApiError({ error: "Only message" });
    expect(parsed.message).to.equal("Something went wrong.");
  });

  it("handles null errors", () => {
    const parsed = parseApiError(null);
    expect(parsed.message).to.equal("Something went wrong.");
    expect(parsed.statusCode).to.equal(null);
    expect(parsed.isTimeout).to.equal(false);
    expect(parsed.isNetworkError).to.equal(false);
  });

  it("handles undefined errors", () => {
    const parsed = parseApiError(undefined);
    expect(parsed.message).to.equal("Something went wrong.");
    expect(parsed.statusCode).to.equal(null);
  });

  it("handles empty string errors", () => {
    const parsed = parseApiError("");
    expect(parsed.message).to.equal("Something went wrong.");
  });

  it("handles number errors", () => {
    const parsed = parseApiError(42);
    expect(parsed.message).to.equal("Something went wrong.");
  });

  it("handles API error with 400 status code", () => {
    const parsed = parseApiError({ error: "Invalid input", statusCode: 400 });
    expect(parsed.message).to.equal("Invalid input");
    expect(parsed.statusCode).to.equal(400);
    expect(parsed.isTimeout).to.equal(false);
    expect(parsed.isNetworkError).to.equal(false);
  });

  it("handles API error with 500 status code", () => {
    const parsed = parseApiError({ error: "Internal server error", statusCode: 500 });
    expect(parsed.message).to.equal("Internal server error");
    expect(parsed.statusCode).to.equal(500);
  });

  it("handles API error with 503 status code", () => {
    const parsed = parseApiError({ error: "Service unavailable", statusCode: 503 });
    expect(parsed.message).to.equal("Service unavailable");
    expect(parsed.statusCode).to.equal(503);
  });

  it("handles complex Error objects with stack traces", () => {
    const error = new Error("Complex error");
    error.stack = "Error: Complex error\n  at test.js:10:5";
    const parsed = parseApiError(error);
    expect(parsed.message).to.equal("Complex error");
    expect(parsed.isTimeout).to.equal(false);
    expect(parsed.isNetworkError).to.equal(false);
  });

  it("distinguishes between AbortError and other DOMExceptions", () => {
    const otherException = new DOMException("Not found", "NotFoundError");
    const parsed = parseApiError(otherException);
    expect(parsed.isTimeout).to.equal(false);
    expect(parsed.message).to.equal("Something went wrong.");
  });

  it("handles arrays as error input", () => {
    const parsed = parseApiError([1, 2, 3]);
    expect(parsed.message).to.equal("Something went wrong.");
  });

  it("handles boolean as error input", () => {
    const parsed = parseApiError(true);
    expect(parsed.message).to.equal("Something went wrong.");
  });

  it("preserves exact error messages from backend", () => {
    const parsed = parseApiError({
      error: "Insufficient stock for product",
      statusCode: 409,
    });
    expect(parsed.message).to.equal("Insufficient stock for product");
    expect(parsed.statusCode).to.equal(409);
  });
});
