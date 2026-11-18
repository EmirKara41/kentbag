import { useEffect, useRef } from "react";
import L from "leaflet";
import { clockTime, dateTime, isLive, routeIndex, stopsFor, type RequestKind, type RequestStatus } from "@kentbag/shared";

const priorityText = { urgent: "Acil", high: "Yüksek", normal: "Normal", low: "Düşük" } as const;

export function Priority({ value }: { value: keyof typeof priorityText }) {
  return <span className={`prio prio-${value}`}>{priorityText[value]}</span>;
}

/** Badge for the AI photo check; nothing when the photo fits or was not checked. */
export function PhotoFlag({ check }: { check?: { verdict: string } | null }) {
  if (check?.verdict === "unrelated") return <span className="pill flag">Fotoğraf uyumsuz</span>;
  if (check?.verdict === "doubtful") return <span className="pill wait">Fotoğraf belirsiz</span>;
  return null;
}

const photoText = { ok: "Fotoğraf sorunla uyumlu", doubtful: "Fotoğrafın sorunla ilgisi belirsiz", unrelated: "Fotoğraf sorunla uyumsuz görünüyor" } as const;
const fixText = { confirmed: "Aynı yer, sorun giderilmiş görünüyor", unclear: "Karşılaştırma için yeterli değil", mismatch: "Farklı yer ya da sorun sürüyor görünüyor" } as const;

/** The AI's advisory note, always labelled as such so staff weigh it, not obey it. */
export function AiNote({ kind, check }: { kind: "photo" | "fix"; check?: { verdict: string; note: string } | null }) {
  if (!check) return null;
  const title = kind === "photo" ? photoText[check.verdict as keyof typeof photoText] : fixText[check.verdict as keyof typeof fixText];
  const bad = check.verdict === "unrelated" || check.verdict === "mismatch";
  return (
    <p className={`ai-note ${bad ? "bad" : ""}`}>
      <strong>{kind === "photo" ? "Yapay zekâ fotoğraf kontrolü" : "Yapay zekâ önce/sonra teyidi"}: {title}.</strong> {check.note}
      <small> Öneri niteliğindedir; karar personelindir.</small>
    </p>
  );
}

export function StatusPill({ status, label }: { status: RequestStatus; label: string }) {
  const tone = status === "resolved" ? "done" : ["cancelled", "rejected", "merged", "referred"].includes(status) ? "off" : isLive(status) ? "live" : "wait";
  return <span className={`pill ${tone}`}>{label}</span>;
}

/** The transit-line strip: one stop per stage, the current stop marked. */
export function RouteStrip({
  status,
  kind = "issue",
  etaArrival,
  etaFinish,
}: {
  status: RequestStatus;
  kind?: RequestKind;
  etaArrival?: string | null;
  etaFinish?: string | null;
}) {
  const stops = stopsFor(kind);
  const here = routeIndex(status, kind);
  if (here < 0)
    return (
      <p className="muted">
        {status === "rejected" ? "Bu öneri uygulanmayacak." : status === "referred" ? "Yetki alanı dışında; vatandaşa ilgili numaralar verildi." : "Bu talep iptal edildi."}
      </p>
    );
  const issue = kind === "issue";
  return (
    <ol className="route" aria-label={`Talebin durumu: ${stops[here]}`}>
      {stops.map((stop, i) => (
        <li key={stop} className={`${i < here ? "passed" : i === here ? "here" : ""} ${i === stops.length - 1 ? "final" : ""}`}>
          <i />
          {stop}
          {issue && i === 3 && here <= 3 && etaArrival && <small className="num">varış {clockTime(etaArrival)}</small>}
          {issue && i === 4 && here === 4 && etaFinish && <small className="num">bitiş {clockTime(etaFinish)}</small>}
        </li>
      ))}
    </ol>
  );
}

export function Timeline({ events }: { events: { id: string; body: string; at: string; public?: boolean }[] }) {
  return (
    <ol className="timeline">
      {[...events].reverse().map((e) => (
        <li key={e.id} className={e.public === false ? "private" : ""}>
          <time className="num">
            {dateTime(e.at)}
            {e.public === false ? " · yalnız personel görür" : ""}
          </time>
          {e.body}
        </li>
      ))}
    </ol>
  );
}

export function MapView({ point }: { point: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView([point.lat, point.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    L.circleMarker([point.lat, point.lng], { radius: 9, color: "#1d262b", weight: 3, fillColor: "#f2b705", fillOpacity: 1 }).addTo(map);
    return () => void map.remove();
  }, [point.lat, point.lng]);
  return <div className="map" ref={ref} />;
}
