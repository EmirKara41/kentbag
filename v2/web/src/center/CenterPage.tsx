import { useCallback, useMemo, useState } from "react";
import { clockTime, institutionIds, institutions, isLive, type RequestStatus } from "@kentbag/shared";
import { api, type StaffRequest, type StaffRequestDetail } from "../api.ts";
import { usePolling, useAgentSettings } from "../components/hooks.ts";
import { RequestDrawer } from "../components/RequestDrawer.tsx";
import { Priority, StatusPill } from "../components/parts.tsx";
import { CancelRequest, LiveSummary, RouteChoice, TeamChoice } from "../components/Actions.tsx";

const filters: { key: string; label: string; match: (s: RequestStatus) => boolean }[] = [
  { key: "received", label: "Onay bekleyen", match: (s) => s === "received" },
  { key: "waiting", label: "Atama bekleyen", match: (s) => s === "routed" || s === "returned" || s === "reopened" },
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
      (r) => (!f || f.match(r.status)) && (!q || `${r.reference} ${r.address} ${r.description}`.toLocaleLowerCase("tr").includes(q)),
    );
  }, [data, filter, query]);

  const nextStep = (d: StaffRequestDetail, done: () => Promise<void>) => {
    const after = async () => {
      await done();
      await refresh();
    };
    if (d.status === "received") return <RouteChoice detail={d} refresh={after} />;
    if (d.status === "routed" || d.status === "returned" || d.status === "reopened")
      return (
        <>
          <TeamChoice detail={d} refresh={after} title={`${d.institutionName} · hangi ekip gitsin?`} />
          <CancelRequest detail={d} refresh={after} />
        </>
      );
    if (isLive(d.status))
      return (
        <>
          <LiveSummary detail={d} />
          <TeamChoice detail={d} refresh={after} title="Başka ekibe ver" />
          <CancelRequest detail={d} refresh={after} />
        </>
      );
    return <p className="muted">{d.status === "resolved" ? "Ekip işi tamamladı. Vatandaş sorun sürerse yeniden açabilir." : "Bu talep iptal edildi."}</p>;
  };

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
            <strong className="num">{data ? data.filter((r) => f.match(r.status)).length : "–"}</strong>
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
                {r.categoryName} <Priority value={r.priority} />
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
