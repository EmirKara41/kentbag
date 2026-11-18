import { useCallback, useEffect, useState } from "react";
import { dateTime, isLive } from "@kentbag/shared";
import { api, type CitizenView } from "../app.ts";
import { RouteStrip, etaLine } from "../../../shared/client/RouteStrip.tsx";
import { onResume } from "../../../shared/client/native.ts";
import { ContactList } from "../../../shared/client/Referral.tsx";

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

  async function unfollow() {
    setBusy(true);
    try {
      await api.call(`/api/requests/${id}/support`, { method: "DELETE" });
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Takip bırakılamadı.");
      setBusy(false);
    }
  }

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
            <h1>
              {r.categoryName}
              {r.kind === "improvement" && <span className="tag">Öneri</span>}
            </h1>
            <p className={`eta big-eta ${isLive(r.status) ? "live" : ""}`}>{etaLine(r.status, r.etaArrival, r.etaFinish, r.queuePosition, r.kind)}</p>
            <RouteStrip status={r.status} kind={r.kind} etaArrival={r.etaArrival} etaFinish={r.etaFinish} />
            {r.relation === "following" && <p className="note">Bu sorunu başka bir vatandaş bildirdi; sen de etkilendiğin için takip ediyorsun.</p>}
            {r.mergedWith && (
              <p className="note">
                Aynı sorun için açılmış {r.mergedWith} numaralı taleple birleştirildi. Ekip ikisini tek işte çözüyor; ilerlemeyi buradan izleyebilirsin.
              </p>
            )}
            {r.relation === "own" && r.othersAffected && !r.mergedWith && <p className="note">Bu sorundan başka vatandaşlar da etkilendiğini bildirdi.</p>}
            {(r.teamName || r.institutionName) && (
              <p className="muted">
                {r.institutionName}
                {r.teamName ? ` · ${r.teamName}` : ""}
              </p>
            )}
          </section>
          {r.referral && (
            <section className="panel stack referral">
              <h2>Yetki alanımız dışında</h2>
              <p>
                Bildirdiğin yer {[r.referral.district, r.referral.province].filter(Boolean).join(", ")} sınırları içinde; Oltu Belediyesi burada
                hizmet veremiyor. Sorunu şu numaralardan ilgili kuruma iletebilirsin:
              </p>
              <ContactList contacts={r.referral.contacts} />
            </section>
          )}
          {r.status === "resolved" && (
            <section className="panel stack resolved">
              <h2>{r.kind === "improvement" ? "Önerin hayata geçirildi" : "Ekip işi tamamladı"}</h2>
              {r.resolutionNote && <p>{r.resolutionNote}</p>}
              <div className="photos">
                {r.resolutionPhotos.map((p) => (
                  <img key={p} src={p} alt="Ekibin kapanış fotoğrafı" />
                ))}
              </div>
              {r.canReopen && form !== "reopen" && (
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
          {r.relation === "own" && (
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
          )}
          {r.relation === "following" && (
            <button className="link danger" disabled={busy} onClick={() => void unfollow()}>
              Takibi bırak
            </button>
          )}
          {r.canCancel && form === "none" && (
            <button className="link danger" onClick={() => setForm("cancel")}>
              Talebi iptal et
            </button>
          )}
        </>
      )}
    </main>
  );
}
