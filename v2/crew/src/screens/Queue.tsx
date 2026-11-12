import { useCallback, useEffect, useState } from "react";
import { clockTime } from "@kentbag/shared";
import { api } from "../app.ts";
import { nextAction, remainingChoices, type CrewJob, type Queue } from "../crew.ts";
import { capturePhoto, currentPosition, isNative, onResume, openInMaps, preparePhoto, type LocalPhoto } from "../../../shared/client/native.ts";

const priorityText = { urgent: "Acil", high: "Yüksek", normal: "Normal", low: "Düşük" } as const;

async function reportLocation() {
  try {
    await api.call("/api/crew/location", { body: { point: await currentPosition() } });
  } catch {
    /* location is best-effort; the flow continues without it */
  }
}

function MinutesPicker({ title, onPick, busy }: { title: string; onPick: (m: number) => void; busy: boolean }) {
  return (
    <div className="stack">
      <strong>{title}</strong>
      <div className="minutes">
        {remainingChoices.map((m) => (
          <button key={m} disabled={busy} onClick={() => onPick(m)}>
            {m < 60 ? `${m} dk` : m % 60 ? `${Math.floor(m / 60)},5 sa` : `${m / 60} sa`}
          </button>
        ))}
      </div>
    </div>
  );
}

function CurrentJob({ job, onChanged }: { job: CrewJob; onChanged: () => Promise<void> }) {
  const [step, setStep] = useState<"none" | "arrive" | "remaining" | "resolve" | "decline">("none");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const action = nextAction(job.status);

  async function send(path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await reportLocation();
      await api.call(`/api/crew/jobs/${job.id}/${path}`, { body });
      setStep("none");
      setNote("");
      setPhotos([]);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem yapılamadı.");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    setBusy(true);
    setError("");
    try {
      const photoIds = await Promise.all(photos.map((p) => api.uploadPhoto(p)));
      setBusy(false);
      await send("resolve", { note, photoIds });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.");
      setBusy(false);
    }
  }

  async function addPhoto(source: "camera" | "gallery", file?: File) {
    try {
      const p = file ? await preparePhoto(file) : await capturePhoto(source);
      if (p) setPhotos((l) => [...l, p].slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf eklenemedi.");
    }
  }

  return (
    <section className="panel stack current">
      <div className="spread">
        <h2>{job.categoryName}</h2>
        <span className={`prio prio-${job.priority}`}>{priorityText[job.priority]}</span>
      </div>
      <p>{job.description}</p>
      <p className="muted">{job.address || "Haritada işaretli konum"} · {job.reference}</p>
      {job.point && (
        <button onClick={() => openInMaps(job.point!, job.categoryName)}>Navigasyonda aç</button>
      )}
      {job.photos.length > 0 && (
        <div className="photos">
          {job.photos.map((p) => (
            <img key={p} src={p} alt="Vatandaşın fotoğrafı" />
          ))}
        </div>
      )}
      {job.status === "on_site" && job.etaFinish && <p className="eta">Tahmini bitiş {clockTime(job.etaFinish)}</p>}

      {step === "none" && action && (
        <button
          className="go big"
          disabled={busy}
          onClick={() => (action.action === "depart" ? void send("depart") : setStep(action.action === "arrive" ? "arrive" : "resolve"))}
        >
          {action.label}
        </button>
      )}
      {step === "arrive" && <MinutesPicker title="İş yaklaşık ne kadar sürer?" busy={busy} onPick={(m) => void send("arrive", { remainingMinutes: m })} />}
      {step === "remaining" && <MinutesPicker title="Ne kadar kaldı?" busy={busy} onPick={(m) => void send("remaining", { remainingMinutes: m })} />}
      {step === "resolve" && (
        <div className="stack">
          <label>
            Ne yaptınız?
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Sigorta değiştirildi, elektrik verildi." />
          </label>
          <div className="photos">
            {photos.map((p) => (
              <img key={p.id} src={p.uri} alt="" />
            ))}
          </div>
          {photos.length < 3 &&
            (isNative ? (
              <div className="row">
                <button onClick={() => void addPhoto("camera")}>Fotoğraf çek</button>
                <button onClick={() => void addPhoto("gallery")}>Galeriden seç</button>
              </div>
            ) : (
              <label className="button">
                Fotoğraf ekle (isteğe bağlı)
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void addPhoto("gallery", e.target.files[0])} />
              </label>
            ))}
          <button className="go big" disabled={busy || note.trim().length < 10} onClick={() => void resolve()}>
            İşi kapat
          </button>
          <small className="muted">Vatandaşa hemen bildirim gider.</small>
        </div>
      )}
      {step === "decline" && (
        <div className="stack">
          <label>
            Neden yapamıyorsunuz?
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Adreste arıza bulunamadı, konum yanlış." />
          </label>
          <button className="danger" disabled={busy || note.trim().length < 10} onClick={() => void send("decline", { reason: note })}>
            İşi kuruma iade et
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        {step !== "none" && (
          <button className="link" onClick={() => setStep("none")}>
            Vazgeç
          </button>
        )}
        {step === "none" && job.status === "on_site" && (
          <button className="link" onClick={() => setStep("remaining")}>
            Kalan süreyi güncelle
          </button>
        )}
        {step === "none" && (
          <button className="link danger" onClick={() => setStep("decline")}>
            Bu işi yapamıyoruz
          </button>
        )}
      </div>
    </section>
  );
}

export function QueueScreen({ onSignOut }: { onSignOut: () => void }) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setQueue(await api.call<Queue>("/api/crew/queue"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İş listesi yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    const stop = onResume(() => void load());
    const refresh = () => void load();
    window.addEventListener("kb:refresh", refresh);
    return () => {
      clearInterval(timer);
      stop();
      window.removeEventListener("kb:refresh", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!queue?.team.onShift) return;
    void reportLocation();
    const timer = setInterval(() => void reportLocation(), 3 * 60_000);
    return () => clearInterval(timer);
  }, [queue?.team.onShift]);

  async function toggleShift() {
    if (!queue) return;
    try {
      await api.call("/api/crew/shift", { body: { onShift: !queue.team.onShift } });
      if (!queue.team.onShift) await reportLocation();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mesai durumu değiştirilemedi.");
    }
  }

  const [current, ...rest] = queue?.jobs ?? [];
  return (
    <main className="screen">
      <header className="spread">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {queue?.team.name ?? "KentBağ Ekip"}
        </div>
        <button className="link" onClick={onSignOut}>
          Çıkış
        </button>
      </header>
      {queue && (
        <div className="shift">
          <div>
            <strong>{queue.team.onShift ? "Mesaideyiz" : "Mesai dışı"}</strong>
            <p className="muted">{queue.team.onShift ? "Yeni işler size atanabilir." : "Size yeni iş atanmaz."}</p>
          </div>
          <button className={queue.team.onShift ? "" : "go"} onClick={() => void toggleShift()}>
            {queue.team.onShift ? "Mesaiyi bitir" : "Mesaiye başla"}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {queue && !current && <p className="muted">Şu anda size atanmış iş yok. Yeni iş gelince burada görünür.</p>}
      {current && <CurrentJob key={current.id} job={current} onChanged={load} />}
      {rest.length > 0 && (
        <section className="stack">
          <h2>Sıradaki işler</h2>
          {rest.map((j, i) => (
            <div key={j.id} className="panel queue-item">
              <strong>
                {i + 2}. {j.categoryName} <span className={`prio prio-${j.priority}`}>{priorityText[j.priority]}</span>
              </strong>
              <span className="muted">{j.address || "Haritada işaretli konum"}</span>
              {j.etaArrival && <span className="num">Tahmini başlama {clockTime(j.etaArrival)}</span>}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
