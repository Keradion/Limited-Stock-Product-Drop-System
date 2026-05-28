import { apiRequest } from "./httpClient.js";
import type {
  PaginatedResponse,
  Product,
  ProductAvailability,
} from "../types/api.types.js";

export async function fetchProduct(productId: string): Promise<Product> {
  return apiRequest<Product>(`/api/products/${productId}`);
}

export async function fetchProductAvailability(productId: string): Promise<ProductAvailability> {
  return apiRequest<ProductAvailability>(`/api/products/${productId}/availability`);
}

export async function fetchFirstProduct(): Promise<Product | null> {
  const result = await apiRequest<PaginatedResponse<Product>>("/api/products?limit=1&page=1");
  return result.data[0] ?? null;
}
