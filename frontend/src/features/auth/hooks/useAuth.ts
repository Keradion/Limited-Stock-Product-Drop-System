import { useCallback, useState } from "react";
import { login, register } from "../../../api/authApi.js";
import { parseApiError } from "../../../lib/parseApiError.js";
import { clearStoredToken, getStoredToken, setStoredToken } from "../../../lib/storage.js";

type AuthState = {
  token: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  loginUser: (email: string, password: string) => Promise<boolean>;
  registerUser: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
};

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const authenticate = useCallback(async (action: "login" | "register", email: string, password: string) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response =
        action === "login" ? await login(email, password) : await register(email, password);
      setStoredToken(response.token);
      setToken(response.token);
      return true;
    } catch (caught) {
      setAuthError(parseApiError(caught).message);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const loginUser = useCallback(
    (email: string, password: string) => authenticate("login", email, password),
    [authenticate],
  );

  const registerUser = useCallback(
    (email: string, password: string) => authenticate("register", email, password),
    [authenticate],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
  }, []);

  return { token, isAuthenticating, authError, loginUser, registerUser, logout };
}
