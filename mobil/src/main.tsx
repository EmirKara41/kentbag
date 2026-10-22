import React, { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store";
import "./style.css";
import "./civic.css";
import "./nearby.css";
class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="crash-screen">
        <h1>Bir şeyler yolunda gitmedi.</h1>
        <p>
          Kaydettiğin taslaklar silinmedi. Uygulamayı yeniden açmayı
          deneyebilirsin.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Yeniden aç
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </AppBoundary>
  </React.StrictMode>,
);
