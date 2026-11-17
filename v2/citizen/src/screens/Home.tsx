import { useCallback, useEffect, useState } from "react";
import { isLive, isOpen } from "@kentbag/shared";
import { api, type Announcement, type CitizenView } from "../app.ts";
import { etaLine } from "../../../shared/client/RouteStrip.tsx";
import { onResume } from "../../../shared/client/native.ts";

function Card({ r, onOpen }: { r: CitizenView; onOpen: (id: string) => void }) {
  const open = isOpen(r.status);
  return (
    <button className={`request-card ${isLive(r.status) ? "live" : ""} ${open ? "" : "past"}`} onClick={() => onOpen(r.id)}>
      <span className="spread">
        <strong>
          {r.categoryName}
          {r.kind === "improvement" && <span className="tag">Öneri</span>}
          {r.relation === "following" && <span className="tag">Takip ediyorsun</span>}
        </strong>
        <span className="muted num">{r.reference}</span>
      </span>
      {open && <span className="eta">{etaLine(r.status, r.etaArrival, r.etaFinish, r.queuePosition, r.kind)}</span>}
      <span className="muted">
        {r.statusLabel}
        {r.mergedWith ? ` · ${r.mergedWith} ile birlikte` : ""}
      </span>
    </button>
  );
}

export function Home({ onReport, onOpen, onSettings }: { onReport: () => void; onOpen: (id: string) => void; onSettings: () => void }) {
  const [requests, setRequests] = useState<CitizenView[] | null>(null);
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRequests((await api.call<{ requests: CitizenView[] }>("/api/requests/mine")).requests);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talepler yüklenemedi.");
    }
    api
      .call<{ announcements: Announcement[] }>("/api/announcements")
      .then((r) => setNotices(r.announcements))
      .catch(() => {});
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

  const active = (requests ?? []).filter((r) => isOpen(r.status));
  const past = (requests ?? []).filter((r) => !isOpen(r.status));

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
      {notices.length > 0 && (
        <section className="stack" aria-label="Duyurular">
          {notices.map((n) => (
            <article key={n.id} className="notice">
              <span className="muted">
                {n.from} · {n.neighborhood ? `${n.neighborhood} Mah.` : "Tüm Oltu"}
              </span>
              <strong>{n.title}</strong>
              <span>{n.body}</span>
            </article>
          ))}
        </section>
      )}
      <button className="report-button" onClick={onReport}>
        Sorun bildir
        <small>Arıza bildir ya da mahallen için öneri gönder</small>
      </button>
      {error && <p className="error">{error}</p>}
      <section className="stack">
        <h2>Taleplerim</h2>
        {requests === null && <p className="muted">Yükleniyor…</p>}
        {requests && !active.length && <p className="muted">Açık talebin yok. Bir sorun görürsen yukarıdan bildir.</p>}
        {active.map((r) => (
          <Card key={r.id} r={r} onOpen={onOpen} />
        ))}
      </section>
      {past.length > 0 && (
        <section className="stack">
          <h2>Geçmiş</h2>
          {past.map((r) => (
            <Card key={r.id} r={r} onOpen={onOpen} />
          ))}
        </section>
      )}
    </main>
  );
}
