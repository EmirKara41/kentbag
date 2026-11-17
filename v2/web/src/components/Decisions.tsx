import { useEffect, useState } from "react";
import { api, type StaffRequest, type StaffRequestDetail } from "../api.ts";

function useRun(refresh: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await api(path, { body });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const choices = {
  plan: { label: "Planlandı", field: "note", min: 5, hint: "Ne zaman, nasıl yapılacak? Örn. Aralık ayında iki direk eklenecek.", button: "Planı kaydet" },
  complete: { label: "Tamamlandı", field: "note", min: 10, hint: "Ne yapıldı? Örn. İki aydınlatma direği takıldı.", button: "Tamamlandı olarak kapat" },
  reject: { label: "Uygulanmayacak", field: "reason", min: 10, hint: "Gerekçe vatandaşa gösterilir. Örn. Bu yıl bütçede park donatısı yok.", button: "Gerekçeyle reddet" },
} as const;

/** The institution's decision on an improvement request: plan, complete or reject with a reason. */
export function ImprovementDecision({ detail, refresh }: { detail: StaffRequestDetail; refresh: () => Promise<void> }) {
  const [kind, setKind] = useState<keyof typeof choices | null>(null);
  const [text, setText] = useState("");
  const { busy, error, run } = useRun(refresh);
  const c = kind ? choices[kind] : null;
  return (
    <div className="stack">
      <h3>{detail.status === "planned" ? "Planlanan öneri · sonuç ne oldu?" : "İyileştirme önerisi · kararınız?"}</h3>
      <p className="muted">Öneriler ekibe atanmaz. Kararınız ve açıklamanız vatandaşa gösterilir.</p>
      <div className="row" role="group" aria-label="Karar">
        {(Object.keys(choices) as (keyof typeof choices)[])
          .filter((k) => !(k === "plan" && detail.status === "planned"))
          .map((k) => (
            <button key={k} aria-pressed={kind === k} className={kind === k ? "primary" : ""} onClick={() => setKind(k)}>
              {choices[k].label}
            </button>
          ))}
      </div>
      {c && (
        <>
          <label>
            {c.field === "reason" ? "Gerekçe" : "Açıklama"}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={c.hint} />
          </label>
          {error && <p className="error">{error}</p>}
          <button
            className={kind === "reject" ? "danger" : "primary"}
            disabled={busy || text.trim().length < c.min}
            onClick={() => void run(`/api/staff/requests/${detail.id}/${kind}`, { [c.field]: text })}
          >
            {c.button}
          </button>
        </>
      )}
    </div>
  );
}

/** Same-category open requests nearby; merging makes them one job that closes together. */
export function MergeChoice({ detail, refresh }: { detail: StaffRequestDetail; refresh: () => Promise<void> }) {
  const [similar, setSimilar] = useState<(StaffRequest & { distanceMeters: number })[] | null>(null);
  const { busy, error, run } = useRun(refresh);
  useEffect(() => {
    api<{ requests: (StaffRequest & { distanceMeters: number })[] }>(`/api/staff/requests/${detail.id}/similar`)
      .then((r) => setSimilar(r.requests))
      .catch(() => setSimilar([]));
  }, [detail.id, detail.updatedAt]);
  if (!similar?.length) return null;
  return (
    <div className="stack">
      <h3>Yakında aynı sorun ({similar.length})</h3>
      <p className="muted">Aynı sorunsa birleştirin: bu talep seçtiğiniz talebe bağlanır, vatandaş ilerlemeyi oradan izler, iş bitince ikisi birlikte kapanır.</p>
      {error && <p className="error">{error}</p>}
      <ul className="similar">
        {similar.map((s) => (
          <li key={s.id}>
            <span className="stack tight">
              <strong className="num">{s.reference}</strong>
              <span className="muted">
                {s.statusLabel} · {s.distanceMeters} m · {s.address || "Haritada işaretli"}
              </span>
            </span>
            <button disabled={busy} onClick={() => void run(`/api/staff/requests/${detail.id}/merge`, { into: s.id })}>
              Bununla birleştir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
