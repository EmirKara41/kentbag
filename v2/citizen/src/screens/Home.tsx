import { useCallback, useEffect, useState } from "react";
import { isLive } from "@kentbag/shared";
import { api, type CitizenView } from "../app.ts";
import { etaLine } from "../../../shared/client/RouteStrip.tsx";
import { onResume } from "../../../shared/client/native.ts";

export function Home({ onReport, onOpen, onSettings }: { onReport: () => void; onOpen: (id: string) => void; onSettings: () => void }) {
  const [requests, setRequests] = useState<CitizenView[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRequests((await api.call<{ requests: CitizenView[] }>("/api/requests/mine")).requests);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talepler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20_000);
    const stop = onResume(() => void load());
    return () => {
      clearInterval(timer);
      stop();
    };
  }, [load]);

  const active = (requests ?? []).filter((r) => r.status !== "resolved" && r.status !== "cancelled");
  const past = (requests ?? []).filter((r) => r.status === "resolved" || r.status === "cancelled");

  return (
    <main className="screen">
      <header className="spread">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          KentBağ
        </div>
        <button className="link" onClick={onSettings}>
          Ayarlar
        </button>
      </header>
      <button className="report-button" onClick={onReport}>
        Sorun bildir
        <small>Elektrik, su, çöp, yol, buzlanma</small>
      </button>
      {error && <p className="error">{error}</p>}
      <section className="stack">
        <h2>Taleplerim</h2>
        {requests === null && <p className="muted">Yükleniyor…</p>}
        {requests && !active.length && <p className="muted">Açık talebin yok. Bir sorun görürsen yukarıdan bildir.</p>}
        {active.map((r) => (
          <button key={r.id} className={`request-card ${isLive(r.status) ? "live" : ""}`} onClick={() => onOpen(r.id)}>
            <span className="spread">
              <strong>{r.categoryName}</strong>
              <span className="muted num">{r.reference}</span>
            </span>
            <span className="eta">{etaLine(r.status, r.etaArrival, r.etaFinish, r.queuePosition)}</span>
            <span className="muted">{r.statusLabel}</span>
          </button>
        ))}
      </section>
      {past.length > 0 && (
        <section className="stack">
          <h2>Geçmiş</h2>
          {past.map((r) => (
            <button key={r.id} className="request-card past" onClick={() => onOpen(r.id)}>
              <span className="spread">
                <strong>{r.categoryName}</strong>
                <span className="muted num">{r.reference}</span>
              </span>
              <span className="muted">{r.statusLabel}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
