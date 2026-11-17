import { useCallback, useMemo, useState } from "react";
import { clockTime, institutionIds, institutions, isLive, type RequestStatus } from "@kentbag/shared";
import { api, type StaffRequest, type StaffRequestDetail } from "../api.ts";
import { usePolling, useAgentSettings } from "../components/hooks.ts";
import { RequestDrawer } from "../components/RequestDrawer.tsx";
import { Priority, StatusPill } from "../components/parts.tsx";
import { NextStep } from "../components/NextStep.tsx";

const filters: { key: string; label: string; match: (s: RequestStatus, kind: string) => boolean }[] = [
  { key: "received", label: "Onay bekleyen", match: (s) => s === "received" },
  { key: "waiting", label: "Atama bekleyen", match: (s, k) => k === "issue" && (s === "routed" || s === "returned" || s === "reopened") },
  { key: "ideas", label: "Öneriler", match: (s, k) => k === "improvement" && (s === "routed" || s === "planned") },
  { key: "live", label: "Sahada", match: isLive },
  { key: "resolved", label: "Çözülen", match: (s) => s === "resolved" },
];

export function CenterPage() {
  const load = useCallback(() => api<{ requests: StaffRequest[] }>("/api/staff/requests").then((r) => r.requests), []);
  const { data, error, refresh } = usePolling(load);
  const { settings, update } = useAgentSettings();
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const f = filters.find((x) => x.key === filter);
    const q = query.trim().toLocaleLowerCase("tr");
    return (data ?? []).filter(
      (r) => (!f || f.match(r.status, r.kind)) && (!q || `${r.reference} ${r.address} ${r.description}`.toLocaleLowerCase("tr").includes(q)),
    );
  }, [data, filter, query]);

  const nextStep = (d: StaffRequestDetail, done: () => Promise<void>) => (
    <NextStep
      role="center"
      detail={d}
      refresh={async () => {
        await done();
        await refresh();
      }}
    />
  );

  return (
    <main className="page">
      <div className="spread">
        <h1>Bütün talepler</h1>
        {settings && (
          <div className="switches" aria-label="Yapay zekâ ajanı">
            <button className="switch" aria-pressed={settings.center} onClick={() => void update({ center: !settings.center })}>
              <b aria-hidden="true" />
              Ajan · Tüm sistem
            </button>
            {institutionIds.map((id) => (
              <button
                key={id}
                className="switch"
                aria-pressed={settings.center && settings.institutions[id]}
                disabled={!settings.center}
                onClick={() => void update({ institutions: { [id]: !settings.institutions[id] } })}
              >
                <b aria-hidden="true" />
                {institutions[id].name}
              </button>
            ))}
          </div>
        )}
      </div>
      {settings && !settings.center && (
        <p className="agent-note">Ajan kapalı. Yeni talepler "Onay bekleyen" listesinde durur; kurumu siz seçersiniz.</p>
      )}
      <div className="counters">
        {filters.map((f) => (
          <button key={f.key} className="counter" aria-pressed={filter === f.key} onClick={() => setFilter(filter === f.key ? null : f.key)}>
            <span className="muted">{f.label}</span>
            <strong className="num">{data ? data.filter((r) => f.match(r.status, r.kind)).length : "–"}</strong>
          </button>
        ))}
      </div>
      <input aria-label="Taleplerde ara" placeholder="Talep numarası, adres veya açıklama ara" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <div className="list">
        {rows.map((r) => (
          <button key={r.id} className="list-row" onClick={() => setOpen(r.id)}>
            <span className="stack tight">
              <strong>
                {r.categoryName} {r.kind === "improvement" ? <span className="kind-tag">Öneri</span> : <Priority value={r.priority} />}
                {r.supportCount + r.mergedCount > 0 && <span className="support"> · +{r.supportCount + r.mergedCount} etkilenen</span>}
              </strong>
              <span className="meta">
                {r.reference} · {r.address || "Haritada işaretli"}
              </span>
            </span>
            <span className="meta">
              {r.institutionName ?? "Kurum seçilmedi"}
              {r.teamName ? ` · ${r.teamName}` : ""}
              {r.etaArrival && (r.status === "assigned" || r.status === "en_route") ? ` · varış ${clockTime(r.etaArrival)}` : ""}
            </span>
            <StatusPill status={r.status} label={r.statusLabel} />
          </button>
        ))}
        {!data && !error && <p className="empty">Talepler yükleniyor…</p>}
        {data && !rows.length && <p className="empty">Bu görünümde talep yok.</p>}
      </div>
      {open && <RequestDrawer id={open} onClose={() => setOpen(null)} nextStep={nextStep} />}
    </main>
  );
}
