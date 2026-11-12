import { clockTime, routeIndex, routeStops, type RequestStatus } from "@kentbag/shared";

/** The transit-line strip: one stop per stage, the current stop marked. */
export function RouteStrip({ status, etaArrival, etaFinish }: { status: RequestStatus; etaArrival?: string | null; etaFinish?: string | null }) {
  const here = routeIndex(status);
  if (here < 0) return <p className="muted">Bu talep iptal edildi.</p>;
  return (
    <ol className="route" aria-label={`Durum: ${routeStops[here]}`}>
      {routeStops.map((stop, i) => (
        <li key={stop} className={`${i < here ? "passed" : i === here ? "here" : ""} ${i === 5 ? "final" : ""}`}>
          <i />
          {stop}
          {i === 3 && here <= 3 && here >= 2 && etaArrival && <small className="num">{clockTime(etaArrival)}</small>}
          {i === 4 && here === 4 && etaFinish && <small className="num">{clockTime(etaFinish)}</small>}
        </li>
      ))}
    </ol>
  );
}

/** One plain sentence about what happens next, for cards and headers. */
export function etaLine(status: RequestStatus, etaArrival?: string | null, etaFinish?: string | null, queuePosition?: number | null) {
  if (status === "assigned")
    return etaArrival ? `Tahmini varış ${clockTime(etaArrival)}` : queuePosition ? `Ekibin sırasında ${queuePosition}. iş` : "Ekip atandı";
  if (status === "en_route") return etaArrival ? `Ekip yolda · tahmini varış ${clockTime(etaArrival)}` : "Ekip yolda";
  if (status === "on_site") return etaFinish ? `Ekip sahada · tahmini bitiş ${clockTime(etaFinish)}` : "Ekip sahada";
  if (status === "received") return "Talebin alındı, kuruma yönlendiriliyor";
  if (status === "routed" || status === "returned" || status === "reopened") return "Uygun ekip bekleniyor";
  if (status === "resolved") return "Çözüldü";
  return "İptal edildi";
}
