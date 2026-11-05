import { useState } from "react";
import { type CitizenReport, dateText } from "./domain";
import type { InstitutionOrder } from "../../sunucu/src/institution-domain";
import { usePanel } from "./store";
import { Button, Message } from "./ui";
export const fieldStages = {
  assigned: "Ekibin kabulü bekleniyor",
  accepted: "Ekip kabul etti",
  in_progress: "Saha çalışması sürüyor",
  institution_review: "Kurum kontrolünde",
  center_review: "Belediye merkezinin onayında",
  published: "Sonuç vatandaşla paylaşıldı",
};
export function FieldResultPhotos({ order }: { order: InstitutionOrder }) {
  return (
    <>
      {order.result && (
        <>
          <p style={{ whiteSpace: "pre-wrap" }}>{order.result.body}</p>
          <small>{dateText(order.result.submittedAt)}</small>
          <div className="field-result-photos">
            {order.result.photos.map((p) => (
              <a href={p.uri} target="_blank" rel="noreferrer" key={p.id}>
                <img src={p.uri} alt="Saha ekibinin sonuç fotoğrafı" />
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function CenterFieldReview({ report }: { report: CitizenReport }) {
  const { reviewField, busy } = usePanel();
  return (
    <>
      {report.fieldOrders?.map((order) => (
        <CenterOrder
          key={`${order.id}:${order.crewState}:${order.result?.submittedAt??"pending"}`}
          order={order}
          busy={busy}
          review={reviewField}
        />
      ))}
    </>
  );
}
function CenterOrder({
  order,
  busy,
  review,
}: {
  order: InstitutionOrder;
  busy: boolean;
  review: (input: {
    orderId: string;
    decision: "publish" | "return";
    body: string;
  }) => Promise<void>;
}) {
  const [body, setBody] = useState(order.result?.body ?? ""),
    [error, setError] = useState("");
  async function run(decision: "publish" | "return") {
    setError("");
    try {
      await review({ orderId: order.id, decision, body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sonuç kaydedilemedi.");
    }
  }
  return (
    <section className="form-section field-review">
      <h3>Saha sonucu · Merkez kontrolü</h3>
      <strong>
        {order.state === "cancelled"
          ? "Görev iptal edildi"
          : fieldStages[order.crewState]}
      </strong>
      <FieldResultPhotos order={order} />
      {order.state === "prepared" && order.crewState === "center_review" && (
        <>
          <p className="field-note">
            Kurum bu sonucu kontrol ederek merkeze iletti. Paylaş dediğinizde
            açıklama ve sonuç fotoğrafları talep sahibine ve takip eden
            hesaplara açılır.
          </p>
          <label className="field">
            Paylaşılacak açıklama veya iade gerekçesi
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
            />
          </label>
          {error && <Message>{error}</Message>}
          <Button
            disabled={busy || body.trim().length < 15}
            onClick={() => void run("publish")}
          >
            Sonucu vatandaş ve takipçilerle paylaş
          </Button>
          <Button
            variant="secondary"
            disabled={busy || body.trim().length < 15}
            onClick={() => void run("return")}
          >
            Düzeltme için kuruma gönder
          </Button>
        </>
      )}
      {!order.result && (
        <p className="field-note">
          Sonuç, kurum kontrolünden geçip merkeze iletildiğinde açıklama ve
          fotoğraflar burada açılır.
        </p>
      )}
    </section>
  );
}
export function InstitutionFieldReview({
  order,
  reportId,
  busy,
  act,
}: {
  order: InstitutionOrder;
  reportId: string;
  busy: boolean;
  act: (body: unknown) => Promise<void>;
}) {
  const [body, setBody] = useState(""),
    [error, setError] = useState("");
  async function run(decision: "forward" | "return") {
    setError("");
    try {
      await act({
        type: "review-result",
        id: reportId,
        orderId: order.id,
        decision,
        body,
      });
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem kaydedilemedi.");
    }
  }
  return (
    <section className="form-section field-review">
      <h3>Ekibin fotoğraflı sonucu</h3>
      <strong>
        {order.state === "cancelled"
          ? "Görev iptal edildi"
          : fieldStages[order.crewState]}
      </strong>
      <FieldResultPhotos order={order} />
      {order.reviewNote && <Message>{order.reviewNote}</Message>}
      {order.state === "prepared" &&
        order.crewState === "institution_review" && (
          <>
            <p className="field-note">
              Sonuç henüz vatandaşa açık değildir. Kontrol edin; uygun
              bulursanız belediye merkezine iletin.
            </p>
            <label className="field">
              Kurum değerlendirmesi veya düzeltme gerekçesi
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
              />
            </label>
            {error && <Message>{error}</Message>}
            <Button
              disabled={busy || body.trim().length < 15}
              onClick={() => void run("forward")}
            >
              Belediye merkezine ilet
            </Button>
            <Button
              variant="secondary"
              disabled={busy || body.trim().length < 15}
              onClick={() => void run("return")}
            >
              Düzeltme için ekibe gönder
            </Button>
          </>
        )}
    </section>
  );
}
