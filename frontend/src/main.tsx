import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import { ErrorBoundary } from "./features/drop/components/ErrorBoundary.js";
import "./styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
