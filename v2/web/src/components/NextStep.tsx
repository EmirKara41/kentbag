import { isLive } from "@kentbag/shared";
import type { StaffRequestDetail } from "../api.ts";
import { CancelRequest, LiveSummary, ReferChoice, RouteChoice, TeamChoice } from "./Actions.tsx";
import { ImprovementDecision, MergeChoice } from "./Decisions.tsx";

const WAITING = ["routed", "returned", "reopened"];

/** The one place that decides what a staff member can do next with a request. */
export function NextStep({ role, detail, refresh }: { role: "center" | "institution"; detail: StaffRequestDetail; refresh: () => Promise<void> }) {
  const d = detail;
  if (d.status === "received")
    return role === "center" ? (
      <>
        <RouteChoice detail={d} refresh={refresh} />
        <ReferChoice detail={d} refresh={refresh} />
      </>
    ) : (
      <p className="muted">Merkez yönlendirmeyi bekliyor.</p>
    );
  if (d.status === "referred")
    return (
      <>
        <p>
          Yetki alanı dışında ({[d.referral?.district, d.referral?.province].filter(Boolean).join(", ") || "ilçe bilinmiyor"}). Vatandaşa önerilen numaralar:{" "}
          {(d.referral?.contacts ?? []).map((c) => `${c.name} ${c.phone}`).join(" · ")}
        </p>
        {role === "center" && <RouteChoice detail={d} refresh={refresh} />}
      </>
    );
  if (d.status === "merged")
    return <p className="muted">Bu talep {d.mergedIntoReference ?? "başka bir taleple"} birleştirildi. İşlemleri o talep üzerinden yapın.</p>;
  if (d.kind === "improvement" && (d.status === "routed" || d.status === "planned"))
    return (
      <>
        <ImprovementDecision key={d.status} detail={d} refresh={refresh} />
        <MergeChoice detail={d} refresh={refresh} />
        <CancelRequest detail={d} refresh={refresh} />
      </>
    );
  if (WAITING.includes(d.status))
    return (
      <>
        {role === "center" && d.status === "routed" && <ReferChoice detail={d} refresh={refresh} />}
        <TeamChoice detail={d} refresh={refresh} title={role === "center" ? `${d.institutionName} · hangi ekip gitsin?` : "Hangi ekip gitsin?"} />
        <MergeChoice detail={d} refresh={refresh} />
        <CancelRequest detail={d} refresh={refresh} />
      </>
    );
  if (isLive(d.status))
    return (
      <>
        <LiveSummary detail={d} />
        <TeamChoice detail={d} refresh={refresh} title="Başka ekibe ver" />
        <MergeChoice detail={d} refresh={refresh} />
        <CancelRequest detail={d} refresh={refresh} />
      </>
    );
  if (d.status === "resolved")
    return <p className="muted">{d.kind === "improvement" ? "Öneri hayata geçirildi." : "Ekip işi tamamladı. Vatandaş sorun sürerse yeniden açabilir."}</p>;
  if (d.status === "rejected") return <p className="muted">Bu öneri gerekçesiyle reddedildi.</p>;
  return <p className="muted">Bu talep iptal edildi.</p>;
}
