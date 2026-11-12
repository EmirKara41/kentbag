import { useEffect, useRef } from "react";
import L from "leaflet";
import { clockTime, dateTime, isLive, routeIndex, routeStops, type RequestStatus } from "@kentbag/shared";

const priorityText = { urgent: "Acil", high: "Yüksek", normal: "Normal", low: "Düşük" } as const;

export function Priority({ value }: { value: keyof typeof priorityText }) {
  return <span className={`prio prio-${value}`}>{priorityText[value]}</span>;
}

export function StatusPill({ status, label }: { status: RequestStatus; label: string }) {
  const tone = status === "resolved" ? "done" : status === "cancelled" ? "off" : isLive(status) ? "live" : "wait";
  return <span className={`pill ${tone}`}>{label}</span>;
}

/** The transit-line strip: one stop per stage, the current stop marked. */
export function RouteStrip({ status, etaArrival, etaFinish }: { status: RequestStatus; etaArrival?: string | null; etaFinish?: string | null }) {
  const here = routeIndex(status);
  if (here < 0) return <p className="muted">Bu talep iptal edildi.</p>;
  return (
    <ol className="route" aria-label={`Talebin durumu: ${routeStops[here]}`}>
      {routeStops.map((stop, i) => (
        <li key={stop} className={`${i < here ? "passed" : i === here ? "here" : ""} ${i === 5 ? "final" : ""}`}>
          <i />
          {stop}
          {i === 3 && here <= 3 && etaArrival && <small className="num">varış {clockTime(etaArrival)}</small>}
          {i === 4 && here === 4 && etaFinish && <small className="num">bitiş {clockTime(etaFinish)}</small>}
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
