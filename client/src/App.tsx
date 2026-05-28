import { DropPage } from "./components/DropPage.js";
import { useAuth } from "./hooks/useAuth.js";

export function App() {
  const auth = useAuth();

  return (
    <main className="app">
      <DropPage
        isAuthenticated={auth.token !== null}
        isAuthenticating={auth.isAuthenticating}
        authError={auth.authError}
        onLogin={auth.loginUser}
        onRegister={auth.registerUser}
        onLogout={auth.logout}
      />
    </main>
  );
}
