import { clockTime, routeIndex, stopsFor, type RequestKind, type RequestStatus } from "@kentbag/shared";

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
  if (here < 0) return <p className="muted">{status === "rejected" ? "Bu öneri uygulanmayacak." : "Bu talep iptal edildi."}</p>;
  const issue = kind === "issue";
  return (
    <ol className="route" aria-label={`Durum: ${stops[here]}`}>
      {stops.map((stop, i) => (
        <li key={stop} className={`${i < here ? "passed" : i === here ? "here" : ""} ${i === stops.length - 1 ? "final" : ""}`}>
          <i />
          {stop}
          {issue && i === 3 && here <= 3 && here >= 2 && etaArrival && <small className="num">{clockTime(etaArrival)}</small>}
          {issue && i === 4 && here === 4 && etaFinish && <small className="num">{clockTime(etaFinish)}</small>}
        </li>
      ))}
    </ol>
  );
}

/** One plain sentence about what happens next, for cards and headers. */
export function etaLine(
  status: RequestStatus,
  etaArrival?: string | null,
  etaFinish?: string | null,
  queuePosition?: number | null,
  kind: RequestKind = "issue",
) {
  if (kind === "improvement") {
    if (status === "received") return "Önerin alındı, kuruma iletiliyor";
    if (status === "routed") return "Kurum önerini değerlendiriyor";
    if (status === "planned") return "Önerin planlandı";
    if (status === "resolved") return "Önerin hayata geçirildi";
    if (status === "rejected") return "Önerin bu dönem uygulanmayacak";
    return status === "cancelled" ? "İptal edildi" : "Kurum önerini değerlendiriyor";
  }
  if (status === "assigned")
    return etaArrival ? `Tahmini varış ${clockTime(etaArrival)}` : queuePosition ? `Ekibin sırasında ${queuePosition}. iş` : "Ekip atandı";
  if (status === "en_route") return etaArrival ? `Ekip yolda · tahmini varış ${clockTime(etaArrival)}` : "Ekip yolda";
  if (status === "on_site") return etaFinish ? `Ekip sahada · tahmini bitiş ${clockTime(etaFinish)}` : "Ekip sahada";
  if (status === "received") return "Talebin alındı, kuruma yönlendiriliyor";
  if (status === "routed" || status === "returned" || status === "reopened") return "Uygun ekip bekleniyor";
  if (status === "resolved") return "Çözüldü";
  return "İptal edildi";
}
