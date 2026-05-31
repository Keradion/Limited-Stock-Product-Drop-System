import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProduct, fetchProductAvailability, fetchFirstProduct } from "./productsApi.js";
import * as httpClient from "./httpClient.js";
import type { Product, ProductAvailability } from "../types/api.types.js";

vi.mock("./httpClient.js", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(httpClient.apiRequest);

describe("productsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchProduct", () => {
    it("successfully fetches product by id", async () => {
      const product: Product = {
        productId: "prod-123",
        name: "Limited Edition Sneakers",
        totalStock: 100,
        dropStartsAt: new Date().toISOString(),
      };

      apiRequestMock.mockResolvedValue(product);

      const result = await fetchProduct("prod-123");

      expect(result).to.deep.equal(product);
      expect(apiRequestMock).toHaveBeenCalledWith("/api/products/prod-123");
    });

    it("handles product not found error", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Product not found",
        statusCode: 404,
      });

      try {
        await fetchProduct("invalid-id");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Product not found",
          statusCode: 404,
        });
      }
    });

    it("handles server errors", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Internal server error",
        statusCode: 500,
      });

      try {
        await fetchProduct("prod-123");
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
        await fetchProduct("prod-123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError);
      }
    });

    it("handles timeout errors", async () => {
      apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      try {
        await fetchProduct("prod-123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(DOMException);
        expect((error as DOMException).name).to.equal("AbortError");
      }
    });
  });

  describe("fetchProductAvailability", () => {
    it("successfully fetches product availability", async () => {
      const availability: ProductAvailability = {
        productId: "prod-123",
        totalStock: 100,
        availableStock: 75,
        dropStartsAt: new Date().toISOString(),
      };

      apiRequestMock.mockResolvedValue(availability);

      const result = await fetchProductAvailability("prod-123");

      expect(result).to.deep.equal(availability);
      expect(apiRequestMock).toHaveBeenCalledWith("/api/products/prod-123/availability");
    });

    it("handles product not found error", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Product not found",
        statusCode: 404,
      });

      try {
        await fetchProductAvailability("invalid-id");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Product not found",
          statusCode: 404,
        });
      }
    });

    it("handles zero available stock", async () => {
      const availability: ProductAvailability = {
        productId: "prod-123",
        totalStock: 100,
        availableStock: 0,
        dropStartsAt: new Date().toISOString(),
      };

      apiRequestMock.mockResolvedValue(availability);

      const result = await fetchProductAvailability("prod-123");

      expect(result.availableStock).to.equal(0);
    });

    it("handles server errors", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Service temporarily unavailable",
        statusCode: 503,
      });

      try {
        await fetchProductAvailability("prod-123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Service temporarily unavailable",
          statusCode: 503,
        });
      }
    });

    it("handles network errors", async () => {
      apiRequestMock.mockRejectedValue(new TypeError("Failed to fetch"));

      try {
        await fetchProductAvailability("prod-123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError);
      }
    });

    it("handles timeout errors", async () => {
      apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      try {
        await fetchProductAvailability("prod-123");
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(DOMException);
        expect((error as DOMException).name).to.equal("AbortError");
      }
    });
  });

  describe("fetchFirstProduct", () => {
    it("returns first product when available", async () => {
      const product: Product = {
        productId: "prod-first",
        name: "First Product",
        totalStock: 50,
        dropStartsAt: new Date().toISOString(),
      };

      apiRequestMock.mockResolvedValue({
        data: [product],
        pagination: {
          page: 1,
          limit: 1,
          total: 5,
          totalPages: 5,
        },
      });

      const result = await fetchFirstProduct();

      expect(result).to.deep.equal(product);
      expect(apiRequestMock).toHaveBeenCalledWith("/api/products?limit=1&page=1");
    });

    it("returns null when no products exist", async () => {
      apiRequestMock.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 1,
          total: 0,
          totalPages: 0,
        },
      });

      const result = await fetchFirstProduct();

      expect(result).to.equal(null);
    });

    it("handles empty product list", async () => {
      apiRequestMock.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 1,
          total: 0,
          totalPages: 0,
        },
      });

      const result = await fetchFirstProduct();

      expect(result).to.be.null;
      expect(apiRequestMock).toHaveBeenCalledWith("/api/products?limit=1&page=1");
    });

    it("handles server errors", async () => {
      apiRequestMock.mockRejectedValue({
        error: "Database connection failed",
        statusCode: 500,
      });

      try {
        await fetchFirstProduct();
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.deep.equal({
          error: "Database connection failed",
          statusCode: 500,
        });
      }
    });

    it("handles network errors", async () => {
      apiRequestMock.mockRejectedValue(new TypeError("Failed to fetch"));

      try {
        await fetchFirstProduct();
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError);
      }
    });

    it("handles timeout errors", async () => {
      apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      try {
        await fetchFirstProduct();
        expect.fail("Expected error");
      } catch (error) {
        expect(error).to.be.instanceOf(DOMException);
        expect((error as DOMException).name).to.equal("AbortError");
      }
    });

    it("uses correct query parameters", async () => {
      apiRequestMock.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 1,
          total: 0,
          totalPages: 0,
        },
      });

      await fetchFirstProduct();

      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.stringContaining("limit=1"),
      );
      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
      );
    });
  });
});
