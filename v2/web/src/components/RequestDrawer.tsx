import { useCallback, useEffect, useState, type ReactNode } from "react";
import { dateTime } from "@kentbag/shared";
import { api, type StaffRequestDetail } from "../api.ts";
import { MapView, Priority, RouteStrip, StatusPill, Timeline } from "./parts.tsx";

/** Side panel with everything about one request and a single "next step" area. */
export function RequestDrawer({
  id,
  onClose,
  nextStep,
}: {
  id: string;
  onClose: () => void;
  nextStep: (detail: StaffRequestDetail, refresh: () => Promise<void>) => ReactNode;
}) {
  const [detail, setDetail] = useState<StaffRequestDetail | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setDetail((await api<{ request: StaffRequestDetail }>(`/api/staff/requests/${id}`)).request);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talep yüklenemedi.");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh, onClose]);

  return (
    <aside className="drawer" role="dialog" aria-label="Talep ayrıntısı">
      <div className="spread">
        <span className="muted num">{detail?.reference}</span>
        <button className="link" onClick={onClose}>
          Kapat
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {detail && (
        <div className="stack">
          <div className="stack tight">
            <h2>
              {detail.categoryName}
              {detail.kind === "improvement" && <span className="kind-tag">İyileştirme önerisi</span>}
            </h2>
            <div className="row">
              <StatusPill status={detail.status} label={detail.statusLabel} />
              <Priority value={detail.priority} />
              <span className="muted">{dateTime(detail.createdAt)}</span>
            </div>
          </div>
          <RouteStrip status={detail.status} kind={detail.kind} etaArrival={detail.etaArrival} etaFinish={detail.etaFinish} />
          {(detail.supportCount > 0 || detail.merged.length > 0 || detail.mergedIntoReference) && (
            <p className="agent-note">
              {detail.mergedIntoReference && <>Bu talep <strong className="num">{detail.mergedIntoReference}</strong> ile birleştirildi; onunla birlikte kapanır. </>}
              {detail.merged.length > 0 && (
                <>
                  Birleşen talepler: <span className="num">{detail.merged.map((m) => m.reference).join(", ")}</span>.{" "}
                </>
              )}
              {detail.supportCount > 0 && <>{detail.supportCount} vatandaş "Ben de etkileniyorum" dedi.</>}
            </p>
          )}
          <section className="next panel stack">{nextStep(detail, refresh)}</section>
          <p>{detail.description}</p>
          <p className="muted">
            {detail.address || "Adres yazılmamış"}
            {detail.citizenName ? ` · Bildiren: ${detail.citizenName}` : ""}
          </p>
          {detail.point && <MapView point={detail.point} />}
          {detail.photos.length > 0 && (
            <div className="photos">
              {detail.photos.map((p) => (
                <a key={p} href={p} target="_blank" rel="noreferrer">
                  <img src={p} alt="Vatandaşın eklediği fotoğraf" />
                </a>
              ))}
            </div>
          )}
          {detail.agentReason && (
            <p className="agent-note">
              <strong>Ajanın gerekçesi:</strong> {detail.agentReason}
            </p>
          )}
          {detail.resolutionNote && (
            <div className="stack tight">
              <h3>Ekibin kapanış notu</h3>
              <p>{detail.resolutionNote}</p>
              <div className="photos">
                {detail.resolutionPhotos.map((p) => (
                  <img key={p} src={p} alt="Ekibin kapanış fotoğrafı" />
                ))}
              </div>
            </div>
          )}
          <h3>Geçmiş</h3>
          <Timeline events={detail.events} />
        </div>
      )}
    </aside>
  );
}
