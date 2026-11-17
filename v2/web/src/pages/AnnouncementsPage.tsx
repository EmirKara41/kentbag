import { useCallback, useState, type FormEvent } from "react";
import { dateTime, oltuNeighborhoods } from "@kentbag/shared";
import { api, type Announcement } from "../api.ts";
import { usePolling } from "../components/hooks.ts";

const durations = [
  { hours: 3, label: "3 saat" },
  { hours: 12, label: "12 saat" },
  { hours: 24, label: "1 gün" },
  { hours: 72, label: "3 gün" },
  { hours: 168, label: "1 hafta" },
];

export function AnnouncementsPage({ author }: { author: string }) {
  const load = useCallback(() => api<{ announcements: Announcement[] }>("/api/staff/announcements").then((r) => r.announcements), []);
  const { data, error, refresh } = usePolling(load, 60_000);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [hours, setHours] = useState(24);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState("");

  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setDone("");
    try {
      await api("/api/staff/announcements", {
        body: { title, body, neighborhood: neighborhood || null, hours, requestReference: reference.trim() || undefined },
      });
      setTitle("");
      setBody("");
      setReference("");
      setDone("Duyuru yayınlandı. Vatandaşlar uygulamanın ana ekranında görüyor.");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Duyuru yayınlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function end(id: string) {
    await api(`/api/staff/announcements/${id}/end`, { body: {} });
    await refresh();
  }

  return (
    <main className="page">
      <h1>Duyurular</h1>
      <div className="grid-2">
        <form className="panel stack" onSubmit={(e) => void publish(e)}>
          <h2>Yeni duyuru</h2>
          <p className="muted">{author} adına yayınlanır. Planlı kesinti, bakım, hava uyarısı gibi herkesi ilgilendiren konular için.</p>
          <label>
            Başlık
            <input required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Planlı su kesintisi" />
          </label>
          <label>
            Açıklama
            <textarea required minLength={10} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ne olacak, ne zaman, ne kadar sürecek?" />
          </label>
          <div className="row">
            <label>
              Bölge
              <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
                <option value="">Tüm Oltu</option>
                {oltuNeighborhoods.map((n) => (
                  <option key={n} value={n}>
                    {n} Mah.
                  </option>
                ))}
              </select>
            </label>
            <label>
              Yayında kalsın
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {durations.map((d) => (
                  <option key={d.hours} value={d.hours}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            İlgili talep (isteğe bağlı)
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Örn. KB-1A2B3C" />
          </label>
          {formError && <p className="error">{formError}</p>}
          {done && <p className="agent-note">{done}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Yayınlanıyor…" : "Duyuruyu yayınla"}
          </button>
        </form>
        <section className="stack">
          <h2>Son duyurular</h2>
          {error && <p className="error">{error}</p>}
          {data && !data.length && <p className="muted">Henüz duyuru yok.</p>}
          {(data ?? []).map((a) => (
            <article key={a.id} className={`card notice ${a.active ? "" : "ended"}`}>
              <div className="spread">
                <strong>{a.title}</strong>
                <span className={`pill ${a.active ? "live" : "off"}`}>{a.active ? "Yayında" : "Bitti"}</span>
              </div>
              <p>{a.body}</p>
              <span className="muted">
                {a.from} · {a.neighborhood ? `${a.neighborhood} Mah.` : "Tüm Oltu"} · {a.active ? `${dateTime(a.endsAt)} tarihine kadar` : `${dateTime(a.endsAt)} bitti`}
                {a.requestReference ? ` · ${a.requestReference}` : ""}
              </span>
              {a.active && a.canEnd && (
                <button className="link" onClick={() => void end(a.id)}>
                  Yayından kaldır
                </button>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
