import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, register } from "./authApi.js";
import * as httpClient from "./httpClient.js";

vi.mock("./httpClient.js", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(httpClient.apiRequest);

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("successfully logs in and returns auth response", async () => {
      const authResponse = {
        token: "jwt-token-123",
        userId: "user-456",
      };

      apiRequestMock.mockResolvedValue(authResponse);

      const result = await login("test@example.com", "password123");

      expect(result).to.deep.equal(authResponse);
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/auth/login",
        {
          method: "POST",
          body: { email: "test@example.com", password: "password123" },
        },
      );
    });

    it("handles invalid credentials error", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Invalid email or password",
        statusCode: 401,
      });

      try {
        await login("wrong@example.com", "wrongpass");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Invalid email or password",
          statusCode: 401,
        });
      }
    });

    it("handles validation errors", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Invalid email format",
        statusCode: 400,
      });

      try {
        await login("invalid-email", "pass");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Invalid email format",
          statusCode: 400,
        });
      }
    });

    it("handles server errors", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Internal server error",
        statusCode: 500,
      });

      try {
        await login("test@example.com", "password123");
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
        await login("test@example.com", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError);
      }
    });

    it("handles timeout errors", async () => {
      apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      try {
        await login("test@example.com", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(DOMException);
        expect((error as DOMException).name).to.equal("AbortError");
      }
    });

    it("does not require authentication", async () => {
      apiRequestMock.mockResolvedValue({
        token: "jwt-token-123",
        userId: "user-456",
      });

      await login("test@example.com", "password123");

      const callArgs = apiRequestMock.mock.calls[0];
      expect(callArgs[1]?.auth).to.be.undefined;
    });
  });

  describe("register", () => {
    it("successfully registers and returns auth response", async () => {
      const authResponse = {
        token: "jwt-token-789",
        userId: "user-new-001",
      };

      apiRequestMock.mockResolvedValue(authResponse);

      const result = await register("newuser@example.com", "securepass123");

      expect(result).to.deep.equal(authResponse);
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/auth/register",
        {
          method: "POST",
          body: { email: "newuser@example.com", password: "securepass123" },
        },
      );
    });

    it("handles duplicate email error", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Email already registered",
        statusCode: 409,
      });

      try {
        await register("existing@example.com", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Email already registered",
          statusCode: 409,
        });
      }
    });

    it("handles weak password error", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Password must be at least 8 characters",
        statusCode: 400,
      });

      try {
        await register("test@example.com", "short");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Password must be at least 8 characters",
          statusCode: 400,
        });
      }
    });

    it("handles invalid email format error", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Invalid email format",
        statusCode: 400,
      });

      try {
        await register("not-an-email", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Invalid email format",
          statusCode: 400,
        });
      }
    });

    it("handles server errors", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Database unavailable",
        statusCode: 503,
      });

      try {
        await register("test@example.com", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Database unavailable",
          statusCode: 503,
        });
      }
    });

    it("handles network errors", async () => {
      apiRequestMock.mockRejectedValue(new TypeError("Failed to fetch"));

      try {
        await register("test@example.com", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError);
      }
    });

    it("handles timeout errors", async () => {
      apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      try {
        await register("test@example.com", "password123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(DOMException);
        expect((error as DOMException).name).to.equal("AbortError");
      }
    });

    it("sends POST request to register endpoint", async () => {
      apiRequestMock.mockResolvedValue({
        token: "jwt-token-123",
        userId: "user-456",
      });

      await register("test@example.com", "password123");

      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("does not require authentication", async () => {
      apiRequestMock.mockResolvedValue({
        token: "jwt-token-123",
        userId: "user-456",
      });

      await register("test@example.com", "password123");

      const callArgs = apiRequestMock.mock.calls[0];
      expect(callArgs[1]?.auth).to.be.undefined;
    });
  });
});
