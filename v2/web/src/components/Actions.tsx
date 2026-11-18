import { useEffect, useState } from "react";
import { clockTime, institutionIds, institutions, isLive } from "@kentbag/shared";
import { api, type StaffRequestDetail, type TeamBoard } from "../api.ts";

type Suggestion = { institution: string; teamId: string | null; reason: string };

function useSuggestion(id: string) {
  const [s, setS] = useState<Suggestion | null>(null);
  useEffect(() => {
    api<Suggestion>(`/api/staff/requests/${id}/suggest`, { body: {} }).then(setS).catch(() => setS(null));
  }, [id]);
  return s;
}

function useTeams(institution: string | null) {
  const [teams, setTeams] = useState<TeamBoard[]>([]);
  useEffect(() => {
    if (!institution) return setTeams([]);
    api<{ teams: TeamBoard[] }>(`/api/staff/teams?institution=${institution}`).then((r) => setTeams(r.teams)).catch(() => setTeams([]));
  }, [institution]);
  return teams;
}

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

export function RouteChoice({ detail, refresh }: { detail: StaffRequestDetail; refresh: () => Promise<void> }) {
  const suggestion = useSuggestion(detail.id);
  const [choice, setChoice] = useState("");
  const { busy, error, run } = useRun(refresh);
  const value = choice || suggestion?.institution || "";
  return (
    <div className="stack">
      <h3>Hangi kuruma gitsin?</h3>
      {suggestion && <p className="muted">Ajanın önerisi: {institutions[suggestion.institution as keyof typeof institutions]?.name}</p>}
      <select aria-label="Kurum" value={value} onChange={(e) => setChoice(e.target.value)}>
        <option value="">Kurum seç</option>
        {institutionIds.map((id) => (
          <option key={id} value={id}>
            {institutions[id].name}
          </option>
        ))}
      </select>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={!value || busy} onClick={() => void run(`/api/staff/requests/${detail.id}/route`, { institution: value })}>
        Yönlendir
      </button>
    </div>
  );
}

/** Center: the place is outside Oltu; the citizen gets the numbers of the responsible bodies. */
export function ReferChoice({ detail, refresh }: { detail: StaffRequestDetail; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [district, setDistrict] = useState("");
  const { busy, error, run } = useRun(refresh);
  if (!open)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        Yetki alanımız dışında
      </button>
    );
  return (
    <div className="stack">
      <label>
        Hangi ilçede? (boş bırakırsanız konumdan bulunur)
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Örn. Narman" />
      </label>
      <small>Vatandaşa o ilçenin belediyesi ve ilgili arıza hatları (153, 185, 186, 159) önerilir.</small>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button disabled={busy} onClick={() => void run(`/api/staff/requests/${detail.id}/refer`, district.trim() ? { district: district.trim() } : {})}>
          Yönlendir ve kapat
        </button>
        <button className="link" onClick={() => setOpen(false)}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}

export function TeamChoice({ detail, refresh, title }: { detail: StaffRequestDetail; refresh: () => Promise<void>; title: string }) {
  const suggestion = useSuggestion(detail.id);
  const teams = useTeams(detail.institution);
  const [choice, setChoice] = useState("");
  const { busy, error, run } = useRun(refresh);
  const value = choice || (suggestion?.teamId && suggestion.teamId !== detail.teamId ? suggestion.teamId : "");
  return (
    <div className="stack">
      <h3>{title}</h3>
      {suggestion?.teamId && <p className="muted">Ajanın önerisi: {suggestion.reason}</p>}
      <select aria-label="Ekip" value={value} onChange={(e) => setChoice(e.target.value)}>
        <option value="">Ekip seç</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} disabled={!t.active || t.id === detail.teamId}>
            {t.name} · {t.onShift ? `${t.jobs.length} iş sırada` : "mesai dışı"}
            {t.active ? "" : " · kapalı"}
          </option>
        ))}
      </select>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={!value || busy} onClick={() => void run(`/api/staff/requests/${detail.id}/assign`, { teamId: value })}>
        Ata
      </button>
    </div>
  );
}

export function CancelRequest({ detail, refresh }: { detail: StaffRequestDetail; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { busy, error, run } = useRun(refresh);
  if (!open)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        Talebi iptal et
      </button>
    );
  return (
    <div className="stack">
      <label>
        İptal gerekçesi
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. Mükerrer kayıt, diğer talep işleniyor." />
        <small>Vatandaş talebinin iptal edildiğini görür; gerekçe yalnız personelde kalır.</small>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="danger" disabled={reason.trim().length < 10 || busy} onClick={() => void run(`/api/staff/requests/${detail.id}/cancel`, { reason })}>
          İptal et
        </button>
        <button className="link" onClick={() => setOpen(false)}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}

/** What is going on right now, for live requests. */
export function LiveSummary({ detail }: { detail: StaffRequestDetail }) {
  if (!isLive(detail.status)) return null;
  return (
    <p>
      <strong>{detail.teamName}</strong>
      {detail.status === "assigned" && ` · sırada ${detail.queuePosition}. iş`}
      {detail.etaArrival && detail.status !== "on_site" && ` · tahmini varış ${clockTime(detail.etaArrival)}`}
      {detail.status === "on_site" && detail.etaFinish && ` · tahmini bitiş ${clockTime(detail.etaFinish)}`}
    </p>
  );
}
