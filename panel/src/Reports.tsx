import { useCallback, useEffect, useState } from "react";
import {
  categories,
  dateText,
  exportCsv,
  finished,
  needsReview,
  matchesQuery,
  minLength,
  ongoing,
  priorities,
  sortQueue,
  statuses,
  units,
  waitingText,
  type Category,
  type CitizenReport,
  type Priority,
  type Status,
} from "./domain";
import { usePanel } from "./store";
import { InstitutionForward } from "./Institutions";
import { institutionProfiles } from "../../sunucu/src/institution-domain";
import {
  centerStep,
  fieldResultPending,
  flowLabels,
  flowStates,
} from "./centerStep";
import { CenterFieldReview } from "./FieldReview";
import {
  Button,
  CategoryIcon,
  Empty,
  Icon,
  Message,
  Modal,
  PageHeading,
  PriorityBadge,
  StatusBadge,
  type IconName,
} from "./ui";

export function ReportTable({
  reports,
  onOpen,
  compact = false,
}: {
  reports: CitizenReport[];
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  if (!reports.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table className={`report-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th>Talep / konu</th>
            <th>Mahalle</th>
            <th>Öncelik</th>
            <th>Durum</th>
            {!compact && <th>Sorumlu ekip</th>}
            <th>Bekleme</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <button
                  className="report-title-button"
                  onClick={() => onOpen(report.id)}
                >
                  <CategoryIcon category={report.category} small />
                  <span>
                    <small>
                      {report.reference}{" "}
                      {report.kind === "improvement" ? "· İyileştirme" : ""}
                    </small>
                    <strong>{report.title}</strong>
                  </span>
                </button>
              </td>
              <td>
                <span className="neighborhood-cell">{report.neighborhood}</span>
                {!report.point && (
                  <small className="manual-caption">Adres elle girildi</small>
                )}
              </td>
              <td>
                <PriorityBadge report={report} />
              </td>
              <td>
                <StatusBadge report={report} />
              </td>
              {!compact && (
                <td>
                  <TeamLabel report={report} />
                </td>
              )}
              <td className="waiting-cell">
                {ongoing(report)
                  ? waitingText(report.createdAt)
                  : dateText(report.updatedAt, false)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TeamLabel({ report }: { report: CitizenReport }) {
  const { data } = usePanel();
  const team = data.teams.find((item) => item.id === report.teamId);
  const unit = units.find((item) => item.id === report.unitId);
  return (
    <span className={`team-label ${team ? "" : "unassigned"}`}>
      {team ? team.code : (unit?.name ?? "Atama bekliyor")}
    </span>
  );
}
const requestTabs: Record<
  string,
  { label: string; match: (report: CitizenReport) => boolean }
> = {
  all: { label: "Tüm talepler", match: () => true },
  ongoing: { label: "Devam edenler", match: ongoing },
  forward: {
    label: "Kuruma gönderilecek",
    match: (report) => centerStep(report) === "forward",
  },
  waiting: {
    label: "Kurumda",
    match: (report) => centerStep(report) === "waiting",
  },
  publish: {
    label: "Onay bekleyen sonuç",
    match: (report) => centerStep(report) === "publish",
  },
  feedback: { label: "Geri dönüşler", match: needsReview },
  completed: { label: "Sonuçlanan", match: finished },
  issues: { label: "Arızalar", match: (report) => report.kind === "issue" },
  improvements: {
    label: "İyileştirme istekleri",
    match: (report) => report.kind === "improvement",
  },
};
export function Reports({
  onOpen,
  initialFilter = "all",
  initialQuery = "",
}: {
  onOpen: (id: string) => void;
  initialFilter?: string;
  initialQuery?: string;
}) {
  const { data, mode } = usePanel();
  const [tab, setTab] = useState(initialFilter),
    [query, setQuery] = useState(initialQuery),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [category, setCategory] = useState("");
  const filtered = sortQueue(
    data.reports.filter(
      (report) =>
        matchesQuery(report, query) &&
        (!status || report.status === status) &&
        (!priority || report.priority === priority) &&
        (!category || report.category === category) &&
        (requestTabs[tab]?.match ?? requestTabs.all.match)(report),
    ),
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportCsv(filtered, mode !== "live")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      mode === "live"
        ? "KentBag-Oltu-talepler.csv"
        : "KentBag-ornek-talepler.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageHeading
        eyebrow="TALEP YÖNETİMİ"
        title="Talepler"
        body="Gelen bildirimleri incele, sorumlu birime yönlendir ve süreci takip et."
      >
        <Button icon="download" variant="secondary" onClick={download}>
          Görünümü dışa aktar
        </Button>
      </PageHeading>
      <div className="content-panel">
        <div className="tabs request-tabs">
          {Object.entries(requestTabs).map(([id, { label, match }]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
              <span>{data.reports.filter(match).length}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input
              aria-label="Taleplerde ara"
              placeholder="Talep no, konu veya adres ara…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Durum filtresi"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tüm durumlar</option>
            {Object.entries(statuses).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Öncelik filtresi"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">Tüm öncelikler</option>
            {Object.entries(priorities).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Kategori filtresi"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Tüm kategoriler</option>
            {Object.entries(categories).map(([id, value]) => (
              <option key={id} value={id}>
                {value.name}
              </option>
            ))}
          </select>
        </div>
        <div className="table-summary">
          <span>
            <strong>{filtered.length}</strong>{" "}
            {mode === "live" ? "kayıt" : "örnek kayıt"}
          </span>
          <span>Öncelik ve bekleme süresine göre sıralı</span>
        </div>
        <ReportTable reports={filtered} onOpen={onOpen} />
      </div>
      <div className="subtle-note">
        <Icon name="info" size={15} />
        Destek sayısı, benzersiz vatandaş sayısı veya otomatik öncelik puanı
        değildir. Önceliği kurum yetkilisi belirler.
      </div>
    </>
  );
}

type Run = (task: () => void | Promise<void>) => Promise<boolean>;
type Dirty = (part: string, dirty: boolean) => void;
function FlowSteps({ report }: { report: CitizenReport }) {
  const states = flowStates(report);
  return (
    <ol className="flow-steps" aria-label="Talep aşaması">
      {flowLabels.map((label, index) => {
        const state = states[index];
        return (
          <li
            key={label}
            className={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <i>
              {state === "skipped" ? (
                "–"
              ) : state === "done" ? (
                <Icon name="check" size={11} />
              ) : (
                index + 1
              )}
            </i>
            <span>{state === "skipped" ? `${label} (yok)` : label}</span>
          </li>
        );
      })}
    </ol>
  );
}
function LengthHint({ value, min }: { value: string; min: number }) {
  const length = value.trim().length;
  return (
    <small className={`length-hint ${length >= min ? "ok" : ""}`}>
      {length >= min
        ? `${value.length}/2000`
        : `En az ${min} karakter · ${min - length} karakter daha`}
    </small>
  );
}
function TextAction({
  part,
  label,
  placeholder,
  min,
  button,
  icon,
  variant = "primary",
  onDirty,
  onSubmit,
}: {
  part: string;
  label: string;
  placeholder: string;
  min: number;
  button: string;
  icon: IconName;
  variant?: "primary" | "secondary";
  onDirty: Dirty;
  onSubmit: (body: string) => Promise<boolean>;
}) {
  const { busy } = usePanel();
  const [value, setValue] = useState("");
  const dirty = value.trim().length > 0;
  useEffect(() => onDirty(part, dirty), [part, dirty, onDirty]);
  return (
    <>
      <label className="field">
        <span>
          {label}
          <LengthHint value={value} min={min} />
        </span>
        <textarea
          rows={3}
          maxLength={2000}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      <Button
        icon={icon}
        variant={variant}
        disabled={busy || value.trim().length < min}
        onClick={() =>
          void onSubmit(value).then((ok) => {
            if (ok) setValue("");
          })
        }
      >
        {button}
      </Button>
    </>
  );
}
// Legacy center-side unit/team record. Crews are assigned by institutions,
// so this stays available but folded away.
function CenterRecord({
  report,
  run,
  onDirty,
}: {
  report: CitizenReport;
  run: Run;
  onDirty: Dirty;
}) {
  const { data, act, busy } = usePanel();
  const [unitId, setUnit] = useState(report.unitId ?? ""),
    [teamId, setTeam] = useState(report.teamId ?? "");
  const unit = units.find((item) => item.id === unitId);
  const unitTeams = data.teams.filter((item) => item.unitId === unitId);
  const changed =
    unitId !== (report.unitId ?? "") || teamId !== (report.teamId ?? "");
  useEffect(() => onDirty("record", changed), [changed, onDirty]);
  return (
    <details className="center-record">
      <summary>Merkez kaydını düzelt (birim ve ekip)</summary>
      <p className="field-note">
        Yalnız merkezdeki sorumluluk kaydını değiştirir; kuruma gönderim veya
        saha görevi sayılmaz. Saha ekibini kurum atar.
      </p>
      <label className="field">
        Sorumlu birim
        <select
          value={unitId}
          onChange={(event) => {
            setUnit(event.target.value);
            setTeam("");
          }}
        >
          <option value="">Birim seç</option>
          {units
            .filter((item) => item.categories.includes(report.category))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.external ? " · Dış kurum" : ""}
              </option>
            ))}
        </select>
      </label>
      {unitId && !unit?.external && (
        <label className="field">
          Saha ekibi
          <select
            value={teamId}
            onChange={(event) => setTeam(event.target.value)}
          >
            <option value="">Ekip kaydı yok</option>
            {unitTeams.map((team) => (
              <option key={team.id} value={team.id} disabled={!team.active}>
                {team.name}
                {team.active ? "" : " · Görev alamıyor"}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="secondary"
        icon={unit?.external ? "external" : "team"}
        disabled={busy || !unitId || (report.status !== "submitted" && !changed)}
        onClick={() =>
          void run(() =>
            act({
              type: "assign",
              id: report.id,
              unitId,
              teamId: teamId || undefined,
            }),
          )
        }
      >
        Merkez kaydını güncelle
      </Button>
    </details>
  );
}
function NextStep({
  report,
  run,
  onDirty,
}: {
  report: CitizenReport;
  run: Run;
  onDirty: Dirty;
}) {
  const { act } = usePanel();
  const step = centerStep(report);
  const [noField, setNoField] = useState(false);
  const forwardDirty = useCallback(
    (dirty: boolean) => onDirty("forward", dirty),
    [onDirty],
  );
  const reviewDirty = useCallback(
    (dirty: boolean) => onDirty("review", dirty),
    [onDirty],
  );
  useEffect(() => {
    if (!noField) onDirty("no_field", false);
  }, [noField, onDirty]);
  const delivery = report.institutionDelivery;
  const profile = institutionProfiles.find((p) => p.id === delivery?.unitId);
  const heading = {
    forward:
      delivery?.state === "returned"
        ? "Kurum iade etti · yeniden yönlendir"
        : "İlgili kuruma gönder",
    waiting:
      delivery?.state === "queued"
        ? `${profile?.name ?? "Kurum"} kuyruğunda · teslim alınması bekleniyor`
        : `${profile?.name ?? "Kurum"} üzerinde çalışıyor`,
    publish: "Saha sonucunu kontrol et ve paylaş",
    reopen: needsReview(report)
      ? "Vatandaş sorunun sürdüğünü bildirdi"
      : "Gerekirse yeniden incelemeye al",
    none: "",
  }[step];
  const hint = {
    forward:
      "Talebi kategorisine uygun kuruma gönder. Saha ekibini kurum atar.",
    waiting:
      "Merkezden beklenen bir işlem yok. Kurum sonucu ilettiğinde burada onayına düşer.",
    publish:
      "Kurum, ekibin fotoğraflı sonucunu kontrol edip merkeze iletti. Paylaşmadan önce açıklamayı gözden geçir.",
    reopen: "",
    none: "",
  }[step];
  return (
    <section className="next-step">
      <small className="next-step-label">SIRADAKİ ADIM</small>
      <h3>{heading}</h3>
      {hint && <p className="field-note">{hint}</p>}
      {step === "publish" && (
        <CenterFieldReview report={report} onDirty={reviewDirty} />
      )}
      {(step === "forward" || step === "waiting" || step === "publish") && (
        <InstitutionForward report={report} onDirty={forwardDirty} />
      )}
      {step === "waiting" && (
        <CenterFieldReview report={report} onDirty={reviewDirty} />
      )}
      {step === "reopen" && (
        <>
          {report.resolution && (
            <p className="previous-resolution">
              <strong>Önceki sonuç:</strong> {report.resolution}
            </p>
          )}
          <TextAction
            part="reopen"
            label="Yeniden inceleme gerekçesi"
            placeholder="Örn. Vatandaş geri dönüşü üzerine yerinde kontrol yapılacak."
            min={minLength.reopen}
            button="Yeniden incelemeye al"
            icon="reset"
            variant={needsReview(report) ? "primary" : "secondary"}
            onDirty={onDirty}
            onSubmit={(body) =>
              run(() => act({ type: "reopen", id: report.id, body }))
            }
          />
        </>
      )}
      {(step === "forward" || step === "waiting") &&
        !fieldResultPending(report) && (
          <div className="secondary-path">
            <button
              className="text-button"
              aria-expanded={noField}
              onClick={() => setNoField(!noField)}
            >
              {noField
                ? "Vazgeç"
                : "Saha işi gerekmiyor mu? Saha işi olmadan sonuçlandır"}
            </button>
            {noField && (
              <>
                <p className="field-note">
                  Bilgi talebi, mükerrer kayıt veya dış kurumun sonuçlandırdığı
                  işler için. Kayıtta saha çalışması yapılmadığı açıkça yazılır
                  ve kurumdaki hazır görev iptal edilir.
                </p>
                <TextAction
                  part="no_field"
                  label="Sonuçlandırma gerekçesi"
                  placeholder="Örn. Bilgi talebiydi; vatandaşa kesinti planı hakkında açıklama yapıldı."
                  min={minLength.resolution}
                  button="Saha işi olmadan sonuçlandır"
                  icon="done"
                  variant="secondary"
                  onDirty={onDirty}
                  onSubmit={(body) =>
                    run(() =>
                      act({
                        type: "resolve",
                        id: report.id,
                        body,
                        mode: "no_field",
                      }),
                    )
                  }
                />
              </>
            )}
          </div>
        )}
    </section>
  );
}
function NoteForm({
  report,
  run,
  onDirty,
}: {
  report: CitizenReport;
  run: Run;
  onDirty: Dirty;
}) {
  const { act, busy } = usePanel();
  const [note, setNote] = useState(""),
    [audience, setAudience] = useState<"internal" | "citizen" | "participants">(
      "internal",
    );
  const dirty = note.trim().length > 0;
  useEffect(() => onDirty("note", dirty), [dirty, onDirty]);
  return (
    <section className="form-section">
      <h3>Açıklama ekle</h3>
      <label className="field">
        Görünürlük
        <select
          value={audience}
          onChange={(event) => setAudience(event.target.value as typeof audience)}
        >
          <option value="internal">Kurum içi not</option>
          <option value="citizen">Talep sahibine yanıt</option>
          {report.shared && (
            <option value="participants">
              Ortak güncelleme · Katılan herkese
            </option>
          )}
        </select>
      </label>
      <label className="field">
        Açıklama
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={
            audience === "internal"
              ? "Yalnız kurum içinde kalacak ayrıntılar…"
              : audience === "participants"
                ? "Katılan herkesin göreceği ortak açıklama…"
                : "Yalnız talep sahibinin göreceği yanıt…"
          }
        />
      </label>
      <LengthHint value={note} min={minLength.note} />
      <Button
        variant="secondary"
        icon="plus"
        disabled={busy || note.trim().length < minLength.note}
        onClick={() =>
          void run(() =>
            act({ type: "note", id: report.id, body: note, audience }),
          ).then((ok) => {
            if (ok) setNote("");
          })
        }
      >
        Açıklamayı kaydet
      </Button>
    </section>
  );
}
export function ReportDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, act, mode } = usePanel();
  const report = data.reports.find((item) => item.id === id)!;
  const [error, setError] = useState(""),
    [section, setSection] = useState("process"),
    [dirtyParts, setDirtyParts] = useState<Record<string, boolean>>({}),
    [confirmClose, setConfirmClose] = useState(false);
  const onDirty = useCallback<Dirty>(
    (part, dirty) =>
      setDirtyParts((parts) =>
        parts[part] === dirty ? parts : { ...parts, [part]: dirty },
      ),
    [],
  );
  const dirty = Object.values(dirtyParts).some(Boolean);
  const linked = data.announcements.find(
    (item) => item.id === report.incidentId,
  );
  const run: Run = async (task) => {
    try {
      await task();
      setError("");
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
      return false;
    }
  };
  function requestClose() {
    if (dirty && !confirmClose) setConfirmClose(true);
    else onClose();
  }
  return (
    <Modal title={report.reference} onClose={requestClose} drawer>
      <div className="detail-title">
        <CategoryIcon category={report.category} />
        <div>
          <span className="eyebrow">
            {categories[report.category].name} ·{" "}
            {report.kind === "improvement"
              ? "İyileştirme isteği"
              : "Arıza bildirimi"}
          </span>
          <h2>{report.title}</h2>
        </div>
      </div>
      <div className="detail-badges">
        <StatusBadge report={report} />
        {report.status !== "withdrawn" ? (
          <label className="priority-picker">
            Öncelik
            <select
              aria-label="Talebin önceliği"
              value={report.priority}
              onChange={(event) =>
                void run(() =>
                  act({
                    type: "priority",
                    id,
                    priority: event.target.value as Priority,
                  }),
                )
              }
            >
              {Object.entries(priorities).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <PriorityBadge report={report} />
        )}
      </div>
      {report.status !== "withdrawn" && <FlowSteps report={report} />}
      <p className="report-description">{report.description}</p>
      {report.triage && (
        <div className="triage-card">
          <strong>
            {report.triage.source === "gemini"
              ? "Gemini önerisi"
              : "Kural tabanlı öneri"}{" "}
            · {priorities[report.triage.priority]}
          </strong>
          <p>{report.triage.reason}</p>
          <small>
            {report.prioritySource === "authority"
              ? `Yetkili kararı: ${priorities[report.priority]}. Otomatik öneri kararı değiştirmez.`
              : "Kuyruk bu öneriye göre sıralanır; yetkili önceliği değiştirebilir."}
          </small>
          {report.triage.aiState === "pending" && (
            <small> Gemini değerlendirmesi bekleniyor.</small>
          )}
          {report.triage.aiState === "failed" && (
            <small> Gemini yanıtı alınamadı; kurallar kullanıldı.</small>
          )}
        </div>
      )}
      {!!report.photos?.length && (
        <div className="receipt-photos">
          {report.photos.map((photo) => (
            <a key={photo.id} href={photo.uri} target="_blank" rel="noreferrer">
              <img src={photo.uri} alt="Vatandaşın talebe eklediği fotoğraf" />
            </a>
          ))}
        </div>
      )}
      <div className="address-box">
        <Icon name="pin" size={19} />
        <div>
          <strong>{report.address}</strong>
          <small>
            {report.point
              ? `${report.point[0].toFixed(5)}, ${report.point[1].toFixed(5)}`
              : "Adres elle girildi · Harita noktası yok"}
          </small>
        </div>
      </div>
      <div className="report-facts">
        <div>
          <small>Bildiren</small>
          <strong>
            {report.citizen}{" "}
            <span>{mode === "live" ? "Vatandaş kaydı" : "Örnek kişi"}</span>
          </strong>
        </div>
        <div>
          <small>Alınma zamanı</small>
          <strong>{dateText(report.createdAt)}</strong>
        </div>
        <div>
          <small>Destek kaydı</small>
          <strong>{report.supports}</strong>
        </div>
      </div>
      {report.feedback === "persists" && (
        <div className="feedback-alert">
          <Icon name="reset" size={19} />
          <span>
            <strong>Vatandaş sorunun devam ettiğini bildirdi.</strong>
            {report.feedbackText && <p>{report.feedbackText}</p>}
            <small>
              Önceki çözüm kaydı korunuyor. Yeniden inceleme kararını yetkili
              verir.
            </small>
          </span>
        </div>
      )}
      {linked && (
        <div className="linked-notice">
          <Icon name="link" size={18} />
          <span>
            <small>ORTAK DUYURUYA BAĞLI</small>
            <strong>{linked.title}</strong>
            <p>Bu duyuru {linked.reportIds.length} taleple ilişkili.</p>
          </span>
        </div>
      )}
      <div className="tabs detail-tabs">
        {[
          ["process", "Sıradaki adım"],
          ["history", "İşlem geçmişi"],
          ["public", "Vatandaşta görünüm"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={section === value ? "active" : ""}
            onClick={() => setSection(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "history" && (
        <ol className="timeline">
          {[...report.events].reverse().map((event) => (
            <li key={event.id}>
              <span className="timeline-dot">
                <Icon
                  name={event.audience === "internal" ? "lock" : "bell"}
                  size={13}
                />
              </span>
              <div>
                <small>
                  {dateText(event.at)} ·{" "}
                  {event.audience === "internal"
                    ? "Kurum içi"
                    : event.audience === "participants"
                      ? "Katılan herkese"
                      : "Talep sahibine özel"}
                </small>
                <p>{event.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {section === "public" && (
        <div className="citizen-preview">
          <div>
            <Icon name="bell" />
            <strong>Vatandaşın görebileceği içerik</strong>
          </div>
          <p className="preview-caption">
            Canlı uygulamaya gönderilmez. Kurum içi notlar bu görünümde yer
            almaz.
          </p>
          {report.events
            .filter(
              (event) =>
                event.audience === "citizen" ||
                event.audience === "participants",
            )
            .map((event) => (
              <article key={event.id}>
                <small>{dateText(event.at)}</small>
                <p>{event.body}</p>
              </article>
            ))}
        </div>
      )}
      {/* Hidden instead of unmounted so typed text survives tab switches. */}
      <div hidden={section !== "process"}>
        {report.status !== "withdrawn" ? (
          <>
            <NextStep
              key={`${report.status}:${report.institutionDelivery?.state ?? ""}`}
              report={report}
              run={run}
              onDirty={onDirty}
            />
            <NoteForm report={report} run={run} onDirty={onDirty} />
            {ongoing(report) && (
              <CenterRecord report={report} run={run} onDirty={onDirty} />
            )}
          </>
        ) : (
          <Empty
            title="Bu talep vatandaş tarafından geri çekilmiş."
            body="Geçmişi korunur; tamamlanan hizmet sayısına eklenmez."
          />
        )}
      </div>
      {error && <Message>{error}</Message>}
      {confirmClose && (
        <div className="unsaved-bar" role="alert">
          <span>
            <strong>Kaydedilmemiş değişiklik var.</strong>
            Kapatırsan yazdıkların ve seçimlerin kaybolur.
          </span>
          <div>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              Geri dön
            </Button>
            <Button variant="danger" onClick={onClose}>
              Kaydetmeden kapat
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
