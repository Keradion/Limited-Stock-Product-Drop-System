import { describe, expect, it } from "vitest";
import { parseApiError } from "./parseApiError.js";

describe("parseApiError", () => {
  it("detects API error bodies", () => {
    const parsed = parseApiError({ error: "Insufficient stock", statusCode: 409 });
    expect(parsed.message).to.equal("Insufficient stock");
    expect(parsed.statusCode).to.equal(409);
  });

  it("detects timeout abort errors", () => {
    const parsed = parseApiError(new DOMException("Aborted", "AbortError"));
    expect(parsed.isTimeout).to.equal(true);
    expect(parsed.message).to.contain("timed out");
  });

  it("detects network failures", () => {
    const parsed = parseApiError(new TypeError("Failed to fetch"));
    expect(parsed.isNetworkError).to.equal(true);
  });
});
