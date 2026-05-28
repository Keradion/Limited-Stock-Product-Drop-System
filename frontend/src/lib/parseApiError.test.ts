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
});
