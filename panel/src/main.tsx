import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PanelProvider } from "./store";
import App from "./App";
import { InstitutionApp } from "./Institutions";
import { StaffLogin } from "./Staff";
import "./style.css";
import "./styles.css";
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="crash-page">
        <h1>Çalışma alanı açılamadı.</h1>
        <p>
          Kaydedilmiş örnek veriler silinmedi. Sayfayı yeniden açmayı
          deneyebilirsin.
        </p>
        <button onClick={() => location.reload()}>Yeniden aç</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      {location.pathname.startsWith("/giris") ? (
        <StaffLogin />
      ) : location.pathname.startsWith("/kurumlar") ? (
        <InstitutionApp />
      ) : (
        <PanelProvider>
          <App />
        </PanelProvider>
      )}
    </Boundary>
  </StrictMode>,
);
