import { useState } from "react";
import {
  categories,
  dateText,
  exportCsv,
  finished,
  needsReview,
  matchesQuery,
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
        (tab === "all" ||
          (tab === "ongoing" && ongoing(report)) ||
          (tab === "completed" && finished(report)) ||
          (tab === "issues" && report.kind === "issue") ||
          (tab === "improvements" && report.kind === "improvement") ||
          (tab === "waiting" && ongoing(report) && !report.teamId) ||
          (tab === "feedback" && needsReview(report))),
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
          {[
            ["all", "Tüm talepler"],
            ["ongoing", "Devam edenler"],
            ["issues", "Arızalar"],
            ["improvements", "İyileştirme istekleri"],
            ["waiting", "Atama bekleyenler"],
            ["feedback", "Geri dönüşler"],
            ["completed", "Sonuçlanan"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "all" && <span>{data.reports.length}</span>}
              {id === "feedback" && (
                <span>{data.reports.filter(needsReview).length}</span>
              )}
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

export function ReportDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, act, mode, busy } = usePanel();
  const report = data.reports.find((item) => item.id === id)!;
  const [unitId, setUnit] = useState(report.unitId ?? ""),
    [teamId, setTeam] = useState(report.teamId ?? ""),
    [priorityChoice, setPriority] = useState<Priority | null>(null),
    [note, setNote] = useState(""),
    [audience, setAudience] = useState<"internal" | "citizen" | "participants">(
      "internal",
    ),
    [resolution, setResolution] = useState(""),
    [error, setError] = useState(""),
    [section, setSection] = useState("process");
  const priority = priorityChoice ?? report.priority;
  const unit = units.find((item) => item.id === unitId);
  const selectedTeams = data.teams.filter((item) => item.unitId === unitId);
  const linked = data.announcements.find(
    (item) => item.id === report.incidentId,
  );
  async function run(task: () => void | Promise<void>) {
    try {
      await task();
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    }
  }
  return (
    <Modal title={report.reference} onClose={onClose} drawer>
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
        <PriorityBadge report={report} />
      </div>
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
          ["process", "İşlem yap"],
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
      {section === "process" && (
        <>
          {report.status !== "withdrawn" ? (
            <>
              <section className="form-section">
                <div className="section-title">
                  <h3>Öncelik</h3>
                  <small>Yetkili değerlendirmesi</small>
                </div>
                <div className="inline-field">
                  <select
                    aria-label="Talebin önceliği"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as Priority)
                    }
                  >
                    {Object.entries(priorities).map(([id, value]) => (
                      <option value={id} key={id}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run(() => act({ type: "priority", id, priority }))
                    }
                  >
                    Önceliği kaydet
                  </Button>
                </div>
              </section>
              {ongoing(report) && (
                <section className="form-section">
                  <h3>Merkezdeki birim ve ekip kaydı</h3>
                  <p className="field-note">
                    Bu alan merkezdeki sorumluluk kaydını düzenler. Kurumun
                    çalışma kuyruğuna iletmek için aşağıdaki gönderim alanını
                    kullanın.
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
                        .filter((item) =>
                          item.categories.includes(report.category),
                        )
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
                        <option value="">Henüz ekip atama</option>
                        {selectedTeams.map((team) => (
                          <option
                            key={team.id}
                            value={team.id}
                            disabled={!team.active}
                          >
                            {team.name}
                            {team.active ? "" : " · Görev alamıyor"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {unit?.external && (
                    <p className="field-note">
                      Bu işlem yalnız dış kurum yönlendirme kaydı oluşturur.
                      Teslim veya müdahale teyidi anlamına gelmez.
                    </p>
                  )}
                  <Button
                    icon={unit?.external ? "external" : "team"}
                    disabled={
                      !unitId ||
                      (report.status !== "submitted" &&
                        unitId === report.unitId &&
                        (teamId || undefined) === report.teamId)
                    }
                    onClick={() =>
                      run(
                        async () =>
                          await act({
                            type: "assign",
                            id,
                            unitId,
                            teamId: teamId || undefined,
                          }),
                      )
                    }
                  >
                    {unit?.external
                      ? "Yönlendirme kaydını oluştur"
                      : "Yönlendirmeyi kaydet"}
                  </Button>
                  {report.status === "assigned" && (
                    <Button
                      variant="ghost"
                      onClick={() => run(() => act({ type: "progress", id }))}
                    >
                      Çalışmayı başlat
                    </Button>
                  )}
                </section>
              )}
              {ongoing(report) && <InstitutionForward report={report} />}
              <section className="form-section">
                <h3>Açıklama ekle</h3>
                <label className="field">
                  Görünürlük
                  <select
                    value={audience}
                    onChange={(event) =>
                      setAudience(event.target.value as typeof audience)
                    }
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
                <Button
                  variant="secondary"
                  icon="plus"
                  disabled={busy || note.trim().length < 5}
                  onClick={() =>
                    run(async () => {
                      await act({ type: "note", id, body: note, audience });
                      setNote("");
                    })
                  }
                >
                  Açıklamayı kaydet
                </Button>
              </section>
              <section className="form-section resolution-section">
                <h3>
                  {["resolved", "closed"].includes(report.status)
                    ? "Yeniden inceleme"
                    : "Sonucu kaydet"}
                </h3>
                {report.resolution && (
                  <p className="previous-resolution">
                    <strong>Önceki çözüm:</strong> {report.resolution}
                  </p>
                )}
                <label className="field">
                  {["resolved", "closed"].includes(report.status)
                    ? "Yeniden inceleme gerekçesi"
                    : "Çözüm açıklaması"}
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    placeholder="Yapılan işlemi veya yeniden inceleme gerekçesini yaz…"
                  />
                </label>
                <Button
                  icon="done"
                  variant="secondary"
                  disabled={busy || resolution.trim().length < 15}
                  onClick={() =>
                    run(async () => {
                      await act({
                        type: ["resolved", "closed"].includes(report.status)
                          ? "reopen"
                          : "resolve",
                        id,
                        body: resolution,
                      });
                      setResolution("");
                    })
                  }
                >
                  {["resolved", "closed"].includes(report.status)
                    ? "Yeniden incelemeye al"
                    : "Çözümü kaydet"}
                </Button>
                <p className="field-note">
                  Çözüm bildirimi vatandaş onayı sayılmaz. Saha fotoğrafları ve
                  ekip uygulaması üçüncü aşamada bağlanacak.
                </p>
              </section>
            </>
          ) : (
            <Empty
              title="Bu talep vatandaş tarafından geri çekilmiş."
              body="Geçmişi korunur; tamamlanan hizmet sayısına eklenmez."
            />
          )}
        </>
      )}
      {error && <Message>{error}</Message>}
    </Modal>
  );
}
