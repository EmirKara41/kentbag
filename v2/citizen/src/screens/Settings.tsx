import { useState } from "react";
import { api } from "../app.ts";
import { pushAvailable } from "../../../shared/client/native.ts";
import { Apply } from "./Apply.tsx";

export function Settings({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  const [on, setOn] = useState(localStorage.getItem("kb.push") !== "off");
  const [error, setError] = useState("");

  async function toggle() {
    const next = !on;
    setError("");
    try {
      const token = localStorage.getItem("kb.push.token");
      if (token) await api.call("/api/push/token", { body: { token, enabled: next } });
      localStorage.setItem("kb.push", next ? "on" : "off");
      setOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ayar kaydedilemedi.");
    }
  }

  return (
    <main className="screen">
      <header className="spread">
        <button className="link" onClick={onBack}>
          Geri
        </button>
        <h1 className="title">Ayarlar</h1>
        <span />
      </header>
      <section className="panel stack">
        <div className="spread">
          <div>
            <strong>Bildirimler</strong>
            <p className="muted">Talebin ilerlediğinde telefonuna bildirim gelsin.</p>
          </div>
          <button className="switch" aria-pressed={on} onClick={() => void toggle()} disabled={!pushAvailable}>
            {on ? "Açık" : "Kapalı"}
          </button>
        </div>
        {!pushAvailable && <small className="muted">Bu sürümde telefon bildirimi yok; durumu uygulamadan izleyebilirsin.</small>}
        {error && <p className="error">{error}</p>}
      </section>
      <Apply />
      <button onClick={onSignOut}>Çıkış yap</button>
    </main>
  );
}
