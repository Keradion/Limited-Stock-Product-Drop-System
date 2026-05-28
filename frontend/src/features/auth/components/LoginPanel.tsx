import { FormEvent, useState } from "react";

type LoginPanelProps = {
  isAuthenticating: boolean;
  authError: string | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (email: string, password: string) => Promise<boolean>;
};

export function LoginPanel({ isAuthenticating, authError, onLogin, onRegister }: LoginPanelProps) {
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password123");
  const [mode, setMode] = useState<"login" | "register">("login");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onRegister(email, password);
    }
  }

  return (
    <section className="panel login-panel">
      <h2>Sign in to reserve</h2>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {authError ? <p className="message error">{authError}</p> : null}
        <div className="actions">
          <button type="submit" disabled={isAuthenticating}>
            {isAuthenticating ? "Please wait…" : mode === "login" ? "Log in" : "Register"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            disabled={isAuthenticating}
          >
            {mode === "login" ? "Create account" : "Use existing account"}
          </button>
        </div>
      </form>
    </section>
  );
}
