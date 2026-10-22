import { useState } from "react";
import {
  categoryFor,
  dateText,
  completionTime,
  isCompleted,
  isOngoing,
  statusNames,
  validPoint,
  type Report,
} from "../domain";
import { api } from "../api";
import { useStore } from "../store";
import { useNav } from "../navigation";
import { Button, Empty, Icon, Message, Sheet } from "../ui";
import { LocationMap } from "../Map";
import { JoinedIssues, ShareReport } from "./Nearby";
export function Reports({ initialFilter = "all" }: { initialFilter?: string }) {
  const store = useStore(),
    nav = useNav();
  const [filter, setFilter] = useState(initialFilter),
    [query, setQuery] = useState("");
  const reports = (store.workspace?.reports ?? []).filter(
    (report) =>
      (filter === "all" ||
        (filter === "completed"
          ? isCompleted(report)
          : filter === "withdrawn"
            ? report.status === "withdrawn"
            : isOngoing(report))) &&
      `${report.reference} ${report.description} ${categoryFor(report.category).name}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  if (filter === "completed")
    reports.sort(
      (a, b) => Date.parse(completionTime(b)) - Date.parse(completionTime(a)),
    );
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="page">
      <div className="page-title-row">
        <h1>
          {filter === "completed" ? "Tamamlanan taleplerim" : "Kayıtlarım"}
        </h1>
        <button
          className="icon-button"
          onClick={() => void store.refresh()}
          aria-label="Talepleri yenile"
          disabled={store.loading}
        >
          <Icon name="refresh" className={store.loading ? "spin" : ""} />
        </button>
      </div>
      <p className="page-description">
        {filter === "completed"
          ? "Sonuç aldığın talepler kaybolmaz. Zamanla burada birikir."
          : "Sorunların ve iyileştirme isteklerin, başından sonuna burada."}
      </p>
      {store.profile && (
        <div className="record-summary">
          <button
            onClick={() => setFilter("open")}
            className={filter === "open" ? "selected" : ""}
          >
            <strong>
              {store.workspace?.reports.filter(isOngoing).length ?? 0}
            </strong>
            <span>Devam eden</span>
          </button>
          <button
            className={
              filter === "completed" ? "selected completed" : "completed"
            }
            onClick={() => setFilter("completed")}
          >
            <strong>
              {store.workspace?.reports.filter(isCompleted).length ?? 0}
            </strong>
            <span>Tamamlanan</span>
          </button>
        </div>
      )}
      {store.draft && (
        <div className="draft-card">
          <div>
            <span className="draft-icon">
              <Icon name="edit" />
            </span>
            <span>
              <strong>Kaydedilmiş taslağın</strong>
              <small>
                {store.draft.category
                  ? categoryFor(store.draft.category).name
                  : "Yeni bildirim"}{" "}
                · {dateText(store.draft.updatedAt)}
              </small>
            </span>
            <button
              className="icon-button"
              aria-label="Taslağı sil"
              onClick={() => setConfirm(true)}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
          <p>
            {store.draft.description ||
              "Birkaç ayrıntı daha ekleyip bildirimini tamamlayabilirsin."}
          </p>
          <Button
            variant="secondary"
            onClick={() => nav.report(undefined, true)}
            icon="arrow"
          >
            Taslağa devam et
          </Button>
        </div>
      )}
      {store.profile && (
        <>
          {filter !== "joined" && (
            <div className="search-input">
              <Icon name="search" size={19} />
              <input
                aria-label="Taleplerde ara"
                placeholder="Talep numarası veya açıklama ara"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <div className="segmented" aria-label="Talep filtresi">
            {[
              ["all", "Tümü"],
              ["open", "Devam eden"],
              ["completed", "Tamamlanan"],
              ["withdrawn", "Geri çekilen"],
              ["joined", "Katıldıklarım"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {!store.profile ? (
        <Empty
          title={
            filter === "completed"
              ? "Çözülen taleplerin için kalıcı bir yer."
              : "Taleplerin hesabında seni bekler."
          }
          body={
            filter === "completed"
              ? "Giriş yaptığında tamamlanan taleplerini burada görebilirsin. Örnek mahalle kayıtları kişisel arşivine eklenmez."
              : "Gönderdiğin bildirimleri ve işlem adımlarını görmek için giriş yap."
          }
          icon="file"
        >
          <Button onClick={() => nav.go({ name: "auth" })}>Giriş yap</Button>
        </Empty>
      ) : filter === "joined" ? (
        <JoinedIssues />
      ) : store.loading && !store.workspace ? (
        <div className="loading-state">
          <Icon name="loading" className="spin" />
          <span>Taleplerin yükleniyor…</span>
        </div>
      ) : reports.length ? (
        <div className="report-cards">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <Empty
          icon="file"
          title={
            filter === "completed" && !query
              ? "Henüz tamamlanan talebin yok."
              : query || filter !== "all"
                ? "Bu aramada talep bulunamadı."
                : "İlk adım senden."
          }
          body={
            filter === "completed" && !query
              ? "Sonuç aldığın talepler tarihleri ve işlem geçmişleriyle burada kalacak. Geri çekilenler bu sayıya dahil edilmez."
              : query || filter !== "all"
                ? "Farklı bir kelime veya filtreyle yeniden dene."
                : "Bir sorun fark ettiğinde bildirim oluştur. Sürecini buradan takip et."
          }
        >
          {!query && filter === "all" && (
            <Button onClick={() => nav.report()} icon="plus">
              Yeni bildirim oluştur
            </Button>
          )}
        </Empty>
      )}
      {confirm && (
        <Sheet title="Taslak silinsin mi?" onClose={() => setConfirm(false)}>
          <p className="muted">
            Bu taslaktaki açıklama, fotoğraflar ve konum kaldırılacak.
          </p>
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              void store.saveDraft(null, store.profile?.id ?? null).then(() => {
                setConfirm(false);
                nav.toast("Taslak silindi.");
              });
            }}
          >
            Taslağı sil
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Vazgeç
          </Button>
        </Sheet>
      )}
    </div>
  );
}
function ReportCard({ report }: { report: Report }) {
  const nav = useNav();
  const category = categoryFor(report.category);
  return (
    <button
      className="report-card"
      onClick={() => nav.go({ name: "detail", id: report.id })}
    >
      <div className="report-card-top">
        <span
          className="category-icon"
          style={{ background: category.bg, color: category.color }}
        >
          <Icon name={category.icon} />
        </span>
        <span>
          <strong>{category.name}</strong>
          <small>
            {report.kind === "improvement"
              ? "İyileştirme isteği"
              : "Sorun bildirimi"}{" "}
            · {report.reference}
          </small>
        </span>
        <Icon name="chevron" size={17} />
      </div>
      <p>{report.description}</p>
      {isCompleted(report) && (
        <div className="report-result">
          <Icon name="done" size={17} />
          <span>
            {report.feedback?.outcome === "solved"
              ? "Çözüldüğünü onayladın"
              : "Kurum çözüm bildirdi"}
          </span>
        </div>
      )}
      <div className="report-card-foot">
        <span className={`status ${report.status}`}>
          {report.feedback?.outcome === "persists"
            ? "Sorun devam ediyor"
            : statusNames[report.status]}
        </span>
        <small>
          {dateText(
            isCompleted(report) ? completionTime(report) : report.createdAt,
          )}
        </small>
      </div>
    </button>
  );
}
export function Updates() {
  const store = useStore(),
    nav = useNav();
  const inbox = store.workspace?.inbox ?? [],
    unread = inbox.filter((item) => !item.read).length;
  const [error, setError] = useState("");
  async function read() {
    if (!store.profile) return;
    try {
      await api.read(store.profile.id);
      await store.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    }
  }
  return (
    <div className="page">
      <h1>Güncellemeler</h1>
      <p className="page-description">Bildiriminle ilgili her yeni gelişme.</p>
      {error && <Message error>{error}</Message>}
      {unread > 0 && (
        <div className="section-heading">
          <span>{unread} yeni güncelleme</span>
          <button onClick={() => void read()}>Tümünü okundu işaretle</button>
        </div>
      )}
      {inbox.length > 0 ? (
        <div className="inbox-list">
          {inbox.map((item) => (
            <button
              className={`inbox-item ${item.read ? "" : "unread"}`}
              key={item.id}
              onClick={() => {
                if (item.issueId)
                  nav.go({ name: "shared-detail", id: item.issueId });
                else if (item.reportId)
                  nav.go({ name: "detail", id: item.reportId });
              }}
            >
              <span className="inbox-icon">
                <Icon name="bell" size={20} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{dateText(item.createdAt, true)}</small>
              </span>
              {!item.read && <span className="unread-dot" />}
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={
            store.profile
              ? "Yeni bir gelişme olduğunda burada."
              : "Gelişmeleri kaçırma."
          }
          body={
            store.profile
              ? "Talebinle ilgili güncellemeler bu alanda görünecek."
              : "Bildirimlerine ait gelişmeleri görmek için hesabına giriş yap."
          }
          icon="bell"
        >
          {!store.profile && (
            <Button onClick={() => nav.go({ name: "auth" })}>Giriş yap</Button>
          )}
        </Empty>
      )}
    </div>
  );
}
export function Detail({ id, created }: { id: string; created?: boolean }) {
  const store = useStore(),
    nav = useNav();
  const report = store.workspace?.reports.find((item) => item.id === id);
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [photo, setPhoto] = useState<string | null>(null);
  if (!report)
    return (
      <div className="page">
        <Empty
          title="Bu talep şu anda açılamıyor."
          body="Taleplerini yenileyip tekrar deneyebilirsin."
        >
          <Button
            onClick={() => {
              void store.refresh();
            }}
          >
            Yeniden dene
          </Button>
        </Empty>
      </div>
    );
  const category = categoryFor(report.category);
  async function action(withdraw = false) {
    if (!store.profile) return;
    setBusy(true);
    setError("");
    try {
      if (withdraw) await api.withdraw(id, store.profile.id);
      else await api.note(id, note.trim(), store.profile.id);
      setNote("");
      setConfirm(false);
      await store.refresh();
      nav.toast(withdraw ? "Talebin geri çekildi." : "Notun kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page detail-page">
      {created && (
        <div className="receipt">
          <span>
            <Icon name="done" size={33} />
          </span>
          <h1>Bildirimin kaydedildi.</h1>
          <p>
            Talep numaran <strong>{report.reference}</strong>
          </p>
        </div>
      )}
      <section className="detail-heading">
        <span
          className="category-icon"
          style={{ background: category.bg, color: category.color }}
        >
          <Icon name={category.icon} size={27} />
        </span>
        <div>
          <h1>{category.name}</h1>
          <p>
            {report.reference} · {dateText(report.createdAt, true)}
          </p>
        </div>
      </section>
      <span className={`status big ${report.status}`}>
        {statusNames[report.status]}
      </span>
      {report.status !== "withdrawn" && (
        <section className="process-strip" aria-label="Talebin işlem aşamaları">
          {(
            [
              "submitted",
              "in_review",
              "assigned",
              "in_progress",
              "resolved",
            ] as const
          ).map((status, index) => {
            const stage = [
              "submitted",
              "in_review",
              "assigned",
              "in_progress",
              "resolved",
              "closed",
            ].indexOf(report.status);
            return (
              <div key={status} className={index <= stage ? "reached" : ""}>
                <span>
                  {index < stage || stage >= 4 ? (
                    <Icon name="check" size={12} />
                  ) : (
                    index + 1
                  )}
                </span>
                <small>
                  {
                    [
                      "Alındı",
                      "İncelendi",
                      "Ekibe iletildi",
                      "Çalışılıyor",
                      "Çözüm bildirildi",
                    ][index]
                  }
                </small>
              </div>
            );
          })}
          <p>
            Kurumun bildirdiği son aşama. Ayrıntılar işlem geçmişinde yer alır.
          </p>
        </section>
      )}
      {["resolved", "closed"].includes(report.status) && (
        <ResolutionFeedback report={report} />
      )}
      {report.status !== "withdrawn" && <ShareReport report={report} />}
      <section className="content-card">
        <h2>Bildirim ayrıntıları</h2>
        <p className="pre-wrap">{report.description}</p>
        {!!report.impacts?.length && (
          <div className="impact-chips">
            {report.impacts.map((impact) => (
              <span key={impact}>{impact}</span>
            ))}
          </div>
        )}
        {report.photos.length > 0 && (
          <div className="photo-grid">
            {report.photos.map((item) => (
              <button
                key={item.id}
                className="photo-open"
                onClick={() => setPhoto(item.uri)}
                aria-label="Fotoğrafı büyüt"
              >
                <img
                  src={item.uri}
                  alt="Bildirime eklenen fotoğraf"
                  onError={(event) => {
                    event.currentTarget.alt =
                      "Fotoğraf yüklenemedi. Talebi yenileyerek tekrar dene.";
                  }}
                />
              </button>
            ))}
          </div>
        )}
        <div className="detail-address">
          <Icon name="pin" size={18} />
          <span>
            {report.location.address ||
              (validPoint(report.location)
                ? `${report.location.latitude.toFixed(5)}, ${report.location.longitude.toFixed(5)}`
                : "Elle girilen adres")}
          </span>
        </div>
        {validPoint(report.location) ? (
          <LocationMap point={report.location} interactive={false} />
        ) : (
          <p className="field-note">
            Adres elle girildi. Harita noktası paylaşılmadı.
          </p>
        )}
      </section>
      <section className="content-card">
        <h2>İşlem geçmişi</h2>
        <ol className="timeline">
          {(report.events ?? []).map((event, index) => (
            <li
              key={event.id}
              className={
                index === (report.events ?? []).length - 1 ? "latest" : ""
              }
            >
              <span className="timeline-dot">
                <Icon name="check" size={12} />
              </span>
              <div>
                <strong>{statusNames[event.status]}</strong>
                <p>{event.body}</p>
                <small>{dateText(event.createdAt, true)}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="content-card">
        <h2>Ek bilgi ve geri dönüşler</h2>
        {report.notes.length === 0 && (
          <p className="muted">
            Yeni bir ayrıntı fark ettiysen talebine not ekleyebilirsin.
          </p>
        )}
        {report.notes.map((item) => (
          <div key={item.id} className="note">
            <span>Sen · {dateText(item.createdAt, true)}</span>
            <p>{item.text}</p>
          </div>
        ))}
        {!["closed", "withdrawn"].includes(report.status) && (
          <>
            <label className="field">
              <span>Talebine bir not ekle</span>
              <textarea
                value={note}
                rows={3}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Eklemek istediğin ayrıntılar…"
              />
            </label>
            <Button
              variant="secondary"
              icon="plus"
              busy={busy}
              disabled={note.trim().length < 2 || !store.online}
              onClick={() => void action()}
            >
              Notu kaydet
            </Button>
          </>
        )}
        {error && <Message error>{error}</Message>}
      </section>
      {report.status === "submitted" && (
        <Button variant="ghost" icon="close" onClick={() => setConfirm(true)}>
          Talebimi geri çek
        </Button>
      )}
      {confirm && (
        <Sheet
          title="Talep geri çekilsin mi?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p className="muted">
            Talep geçmişinde kalır ve geri çekildi olarak görünür.
          </p>
          <Button
            variant="danger"
            busy={busy}
            onClick={() => void action(true)}
          >
            Talebimi geri çek
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirm(false)}
            disabled={busy}
          >
            Vazgeç
          </Button>
        </Sheet>
      )}
      {photo && (
        <Sheet title="Fotoğraf" wide onClose={() => setPhoto(null)}>
          <img
            className="full-photo"
            src={photo}
            alt="Bildirime eklenen fotoğraf"
          />
        </Sheet>
      )}
    </div>
  );
}
function ResolutionFeedback({ report }: { report: Report }) {
  const store = useStore(),
    nav = useNav();
  const [text, setText] = useState(report.feedback?.text ?? ""),
    [outcome, setOutcome] = useState<"solved" | "persists" | null>(
      report.feedback?.outcome ?? null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [photoUri, setPhotoUri] = useState<string | null>(null);
  async function save() {
    if (!outcome || !store.profile) return;
    setBusy(true);
    setError("");
    try {
      await api.feedback(report.id, outcome, text.trim(), store.profile.id);
      await store.refresh();
      nav.toast("Çözümle ilgili geri dönüşün kaydedildi.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Geri dönüşün kaydedilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card resolution-card">
      <span className="eyebrow">TALEBİNİN SONUCU</span>
      <h2>
        {report.feedback?.outcome === "persists"
          ? "Sorunun devam ettiğini bildirdin."
          : report.feedback?.outcome === "solved"
            ? "Birlikte bir sonuç daha."
            : "Çözüm senin için de tamam mı?"}
      </h2>
      {report.resolution ? (
        <>
          <p>{report.resolution.body}</p>
          <small>{dateText(report.resolution.completedAt, true)}</small>
          {report.resolution.photos.length > 0 && (
            <div className="photo-grid">
              {report.resolution.photos.map((photo) => (
                <button
                  key={photo.id}
                  className="photo-open"
                  onClick={() => setPhotoUri(photo.uri)}
                  aria-label="Çözüm fotoğrafını büyüt"
                >
                  <img
                    src={photo.uri}
                    alt="Kurumun paylaştığı çözüm fotoğrafı"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p>
          Kurum bu talep için çözüm bildirdi. Sonucu kendi deneyimine göre
          değerlendirebilirsin.
        </p>
      )}
      <div className="feedback-choices">
        <button
          aria-pressed={outcome === "solved"}
          className={outcome === "solved" ? "selected" : ""}
          onClick={() => setOutcome("solved")}
          disabled={busy}
        >
          <Icon name="done" size={21} />
          Evet, çözüldü
        </button>
        <button
          aria-pressed={outcome === "persists"}
          className={outcome === "persists" ? "selected" : ""}
          onClick={() => setOutcome("persists")}
          disabled={busy}
        >
          <Icon name="refresh" size={21} />
          Sorun devam ediyor
        </button>
      </div>
      {outcome && (
        <>
          <label className="field">
            <span>
              Geri dönüş açıklaması <small>İsteğe bağlı</small>
            </span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Son durumla ilgili eklemek istediğin bir şey var mı?"
            />
          </label>
          <Button
            icon="send"
            variant="secondary"
            busy={busy}
            disabled={!store.online}
            onClick={() => void save()}
          >
            Geri dönüşümü kaydet
          </Button>
        </>
      )}
      {report.feedback?.outcome === "persists" && (
        <p className="field-note">
          Kaydın arşivde korunur ve devam edenler arasında görünür. Bu geri
          dönüş, otomatik olarak yeni ekip görevlendirildiği anlamına gelmez.
        </p>
      )}
      {error && <Message error>{error}</Message>}
      {!!report.feedbackHistory?.length && (
        <details className="feedback-history">
          <summary>
            Geri dönüş geçmişin ({report.feedbackHistory.length})
          </summary>
          {report.feedbackHistory.map((item, index) => (
            <div className="note" key={index}>
              <span>{dateText(item.createdAt, true)}</span>
              <strong>
                {item.outcome === "solved"
                  ? "Çözüldüğünü onayladın"
                  : "Sorunun devam ettiğini bildirdin"}
              </strong>
              {item.text && <p>{item.text}</p>}
            </div>
          ))}
        </details>
      )}
      {photoUri && (
        <Sheet title="Çözüm fotoğrafı" onClose={() => setPhotoUri(null)} wide>
          <img
            className="full-photo"
            src={photoUri}
            alt="Kurumun paylaştığı çözüm fotoğrafı"
          />
        </Sheet>
      )}
    </section>
  );
}
