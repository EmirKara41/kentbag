import { useCallback, useEffect, useState } from "react";
import { clockTime, dateTime, institutions, type InstitutionId } from "@kentbag/shared";
import { api, type StaffRequest, type StaffRequestDetail, type TeamBoard } from "../api.ts";
import { usePolling, useAgentSettings } from "../components/hooks.ts";
import { RequestDrawer } from "../components/RequestDrawer.tsx";
import { Priority, StatusPill } from "../components/parts.tsx";
import { NextStep } from "../components/NextStep.tsx";

const WAITING = ["routed", "returned", "reopened"];

function WaitingCard({ request, onOpen, onDone }: { request: StaffRequest; onOpen: () => void; onDone: () => Promise<void> }) {
  const [suggestion, setSuggestion] = useState<{ teamId: string | null; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ teamId: string | null; reason: string }>(`/api/staff/requests/${request.id}/suggest`, { body: {} })
      .then(setSuggestion)
      .catch(() => setSuggestion(null));
  }, [request.id, request.updatedAt]);
  async function apply() {
    if (!suggestion?.teamId) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/staff/requests/${request.id}/assign`, { body: { teamId: suggestion.teamId } });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Atanamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card">
      <div className="spread">
        <strong>
          {request.categoryName} <Priority value={request.priority} />
        </strong>
        <StatusPill status={request.status} label={request.status === "routed" ? "Atama bekliyor" : request.statusLabel} />
      </div>
      <span className="muted">
        {request.reference} · {request.address || "Haritada işaretli"}
      </span>
      {suggestion && <p className="agent-note">{suggestion.reason}</p>}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" disabled={!suggestion?.teamId || busy} onClick={() => void apply()}>
          Öneriyi uygula
        </button>
        <button onClick={onOpen}>Başka ekip seç</button>
      </div>
    </article>
  );
}

function TeamColumn({ team, onOpen, onChange }: { team: TeamBoard; onOpen: (id: string) => void; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/staff/teams/${team.id}`, { method: "PATCH", body: { active: !team.active } });
      await onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`panel team ${team.active && team.onShift ? "" : "off"}`}>
      <div className="spread">
        <h3>{team.name}</h3>
        <span className={`pill ${team.active ? (team.onShift ? "live" : "wait") : "off"}`}>
          {!team.active ? "Kapalı" : team.onShift ? "Mesaide" : "Mesai dışı"}
        </span>
      </div>
      {team.jobs.length === 0 && <p className="muted">Sırada iş yok.</p>}
      {team.jobs.map((j, i) => (
        <button key={j.id} className="job" onClick={() => onOpen(j.id)}>
          <strong>
            {i + 1}. {j.categoryName}
          </strong>
          <span className="muted">
            {j.statusLabel}
            {j.status === "on_site" && j.etaFinish ? ` · bitiş ${clockTime(j.etaFinish)}` : j.etaArrival ? ` · varış ${clockTime(j.etaArrival)}` : ""}
          </span>
        </button>
      ))}
      <button className="link" disabled={busy} onClick={() => void toggle()}>
        {team.active ? "Ekibi kapat" : "Ekibi aç"}
      </button>
    </section>
  );
}

export function InstitutionPage({ institution }: { institution: string }) {
  const name = institutions[institution as InstitutionId]?.name ?? institution;
  const loadRequests = useCallback(() => api<{ requests: StaffRequest[] }>("/api/staff/requests").then((r) => r.requests), []);
  const loadTeams = useCallback(() => api<{ teams: TeamBoard[] }>("/api/staff/teams").then((r) => r.teams), []);
  const requests = usePolling(loadRequests);
  const teams = usePolling(loadTeams);
  const { settings, update } = useAgentSettings();
  const [open, setOpen] = useState<string | null>(null);
  const refreshAll = async () => {
    await requests.refresh();
    await teams.refresh();
  };
  const waiting = (requests.data ?? []).filter((r) => r.kind === "issue" && WAITING.includes(r.status));
  const ideas = (requests.data ?? []).filter((r) => r.kind === "improvement" && (r.status === "routed" || r.status === "planned"));
  const agentOn = settings ? settings.center && settings.institutions[institution] : false;

  const nextStep = (d: StaffRequestDetail, done: () => Promise<void>) => (
    <NextStep
      role="institution"
      detail={d}
      refresh={async () => {
        await done();
        await refreshAll();
      }}
    />
  );

  return (
    <main className="page">
      <div className="spread">
        <h1>{name}</h1>
        {settings && (
          <button
            className="switch"
            aria-pressed={agentOn}
            disabled={!settings.center}
            title={settings.center ? "" : "Belediye merkezi ajanı kapattı"}
            onClick={() => void update({ institutions: { [institution]: !settings.institutions[institution] } })}
          >
            <b aria-hidden="true" />
            Ajan ekip atasın
          </button>
        )}
      </div>
      {settings && !agentOn && <p className="agent-note">Ajan kapalı. Gelen işleri aşağıdan ekiplere siz atarsınız.</p>}
      {(requests.error || teams.error) && <p className="error">{requests.error || teams.error}</p>}
      <div className="board">
        <section className="waiting">
          <h2>Atama bekleyen ({waiting.length})</h2>
          {waiting.length === 0 && <p className="muted">Bekleyen iş yok. Yeni işler burada görünür.</p>}
          {waiting.map((r) => (
            <WaitingCard key={r.id} request={r} onOpen={() => setOpen(r.id)} onDone={refreshAll} />
          ))}
        </section>
        <section className="stack">
          {ideas.length > 0 && (
            <div className="stack">
              <h2>İyileştirme önerileri ({ideas.length})</h2>
              <div className="list">
                {ideas.map((r) => (
                  <button key={r.id} className="list-row" onClick={() => setOpen(r.id)}>
                    <span className="stack tight">
                      <strong>
                        {r.categoryName}
                        {r.supportCount + r.mergedCount > 0 && <span className="support"> · +{r.supportCount + r.mergedCount} destek</span>}
                      </strong>
                      <span className="meta">
                        {r.reference} · {r.address || "Haritada işaretli"}
                      </span>
                    </span>
                    <span className="meta">{dateTime(r.createdAt)}</span>
                    <StatusPill status={r.status} label={r.status === "routed" ? "Karar bekliyor" : r.statusLabel} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <h2>Ekipler</h2>
          <div className="teams">
            {(teams.data ?? []).map((t) => (
              <TeamColumn key={t.id} team={t} onOpen={setOpen} onChange={refreshAll} />
            ))}
          </div>
        </section>
      </div>
      {open && <RequestDrawer id={open} onClose={() => setOpen(null)} nextStep={nextStep} />}
    </main>
  );
}
