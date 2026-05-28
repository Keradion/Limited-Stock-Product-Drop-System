import { apiRequest } from "./httpClient.js";
import type { AuthResponse } from "../types/api.types.js";

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password },
  });
}
