import { useCallback, useEffect, useState } from "react";
import { dateTime, isLive } from "@kentbag/shared";
import { api, type CitizenView } from "../app.ts";
import { RouteStrip, etaLine } from "../../../shared/client/RouteStrip.tsx";
import { onResume } from "../../../shared/client/native.ts";

export function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [r, setR] = useState<CitizenView | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<"none" | "reopen" | "cancel">("none");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setR((await api.call<{ request: CitizenView }>(`/api/requests/${id}`)).request);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talep yüklenemedi.");
    }
  }, [id]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    const stop = onResume(() => void load());
    return () => {
      clearInterval(timer);
      stop();
    };
  }, [load]);

  async function act() {
    setBusy(true);
    setError("");
    try {
      const path = form === "reopen" ? "reopen" : "cancel";
      const body = form === "reopen" ? { note: text, photoIds: [] } : { reason: text };
      setR((await api.call<{ request: CitizenView }>(`/api/requests/${id}/${path}`, { body })).request);
      setForm("none");
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <header className="spread">
        <button className="link" onClick={onBack}>
          Taleplerim
        </button>
        <span className="muted num">{r?.reference}</span>
      </header>
      {error && <p className="error">{error}</p>}
      {r && (
        <>
          <section className="stack">
            <h1>{r.categoryName}</h1>
            <p className={`eta big-eta ${isLive(r.status) ? "live" : ""}`}>{etaLine(r.status, r.etaArrival, r.etaFinish, r.queuePosition)}</p>
            <RouteStrip status={r.status} etaArrival={r.etaArrival} etaFinish={r.etaFinish} />
            {(r.teamName || r.institutionName) && (
              <p className="muted">
                {r.institutionName}
                {r.teamName ? ` · ${r.teamName}` : ""}
              </p>
            )}
          </section>
          {r.status === "resolved" && (
            <section className="panel stack resolved">
              <h2>Ekip işi tamamladı</h2>
              {r.resolutionNote && <p>{r.resolutionNote}</p>}
              <div className="photos">
                {r.resolutionPhotos.map((p) => (
                  <img key={p} src={p} alt="Ekibin kapanış fotoğrafı" />
                ))}
              </div>
              {form !== "reopen" && (
                <button onClick={() => setForm("reopen")}>Sorun devam ediyor</button>
              )}
            </section>
          )}
          {form !== "none" && (
            <section className="panel stack">
              <label>
                {form === "reopen" ? "Ne oluyor?" : "Neden iptal ediyorsun?"}
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={form === "reopen" ? "Örn. Elektrik yine gitti." : "Örn. Sorun kendiliğinden düzeldi."} />
              </label>
              <div className="row">
                <button className="primary" disabled={busy || text.trim().length < (form === "reopen" ? 5 : 10)} onClick={() => void act()}>
                  {form === "reopen" ? "Talebi yeniden aç" : "Talebi iptal et"}
                </button>
                <button className="link" onClick={() => setForm("none")}>
                  Vazgeç
                </button>
              </div>
            </section>
          )}
          <section className="stack">
            <h2>Geçmiş</h2>
            <ol className="timeline">
              {[...r.events].reverse().map((e) => (
                <li key={e.id}>
                  <time className="num">{dateTime(e.at)}</time>
                  {e.body}
                </li>
              ))}
            </ol>
          </section>
          <section className="stack">
            <h2>Bildirimin</h2>
            <p>{r.description}</p>
            <p className="muted">{r.address || "Haritada işaretli konum"}</p>
            <div className="photos">
              {r.photos.map((p) => (
                <img key={p} src={p} alt="Eklediğin fotoğraf" />
              ))}
            </div>
          </section>
          {r.status !== "resolved" && r.status !== "cancelled" && form === "none" && (
            <button className="link danger" onClick={() => setForm("cancel")}>
              Talebi iptal et
            </button>
          )}
        </>
      )}
    </main>
  );
}
