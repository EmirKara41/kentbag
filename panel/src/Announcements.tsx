import { useState } from "react";
import {
  categories,
  dateText,
  type Announcement,
  type Category,
  type Work,
} from "./domain";
import { usePanel } from "./store";
import {
  Button,
  CategoryIcon,
  Empty,
  Icon,
  Message,
  Modal,
  PageHeading,
} from "./ui";

export function Announcements() {
  const { data, mode } = usePanel();
  const [editing, setEditing] = useState<Announcement | null>(null),
    [creating, setCreating] = useState(false),
    [filter, setFilter] = useState("all");
  const items = data.announcements.filter(
    (item) => filter === "all" || item.state === filter,
  );
  return (
    <>
      <PageHeading
        eyebrow="TOPLU BİLGİLENDİRME"
        title="Bölge duyuruları"
        body="Aynı durumdan etkilenen talepleri tek duyuruda buluştur. Son açıklamayı bir yerden güncelle."
      >
        <Button icon="plus" onClick={() => setCreating(true)}>
          Yeni duyuru
        </Button>
      </PageHeading>
      {mode === "live" && (
        <Message>
          Duyurular bu aşamada sunucuda ve panelde saklanır. Vatandaş
          uygulamasındaki bölge yayını henüz bağlı değil.
        </Message>
      )}
      <div className="split-info">
        <Icon name="announce" size={25} />
        <div>
          <h3>Tekrarlanan bildirimler, ortak bir sürece bağlansın.</h3>
          <p>
            İlişkilendirme kayıtları silmez ve talepleri kendiliğinden
            tamamlamaz. Canlı bağlantı kurulunca bu yayın vatandaş uygulamasına
            aktarılacak.
          </p>
        </div>
      </div>
      <div className="tabs standalone-tabs">
        {[
          ["all", "Tüm duyurular"],
          ["active", "Yayında"],
          ["draft", "Taslak"],
          ["completed", "Tamamlanan"],
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
      <div className="announcement-grid">
        {items.map((item) => (
          <article className="announcement-card" key={item.id}>
            <div className="card-top">
              <CategoryIcon category={item.category} />
              <span className={`publication-state ${item.state}`}>
                {item.state === "active"
                  ? "Panelde aktif"
                  : item.state === "draft"
                    ? "Taslak"
                    : "Tamamlandı"}
              </span>
            </div>
            <small className="location-line">
              <Icon name="pin" size={13} />
              {item.neighborhood} Mahallesi
            </small>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <div className="announcement-meta">
              <span>
                <Icon name="link" size={16} />
                {item.reportIds.length} ilişkili talep
              </span>
              <span>
                <Icon name="clock" size={16} />
                {item.eta || "Bitiş zamanı belirtilmedi"}
              </span>
            </div>
            <div className="card-bottom">
              <small>
                {dateText(item.updates.at(-1)?.at ?? new Date().toISOString())}
              </small>
              <Button variant="secondary" onClick={() => setEditing(item)}>
                İncele ve güncelle
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="Bu görünümde duyuru yok."
          body="Yeni bir duyuru hazırlayabilir veya diğer yayınlara bakabilirsin."
        />
      )}
      {(creating || editing) && (
        <AnnouncementEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
function AnnouncementEditor({
  initial,
  onClose,
}: {
  initial: Announcement | null;
  onClose: () => void;
}) {
  const { data, act } = usePanel();
  const [value, setValue] = useState<Omit<Announcement, "updates">>(() =>
    initial
      ? { ...initial }
      : {
          id: crypto.randomUUID(),
          title: "",
          category: "water",
          neighborhood: "Cumhuriyet",
          body: "",
          eta: "",
          state: "draft",
          reportIds: [],
        },
  );
  const [error, setError] = useState("");
  const candidates = data.reports.filter(
    (report) =>
      report.category === value.category &&
      report.status !== "withdrawn" &&
      (!report.incidentId || report.incidentId === value.id),
  );
  function patch(input: Partial<typeof value>) {
    setValue((previous) => ({ ...previous, ...input }));
  }
  return (
    <Modal
      title={initial ? "Duyuruyu güncelle" : "Yeni bölge duyurusu"}
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await act({ type: "announcement", value });
            onClose();
          } catch (error) {
            setError(error instanceof Error ? error.message : "Kaydedilemedi.");
          }
        }}
      >
        <div className="editor-columns">
          <div>
            <label className="field">
              Duyuru başlığı
              <input
                required
                maxLength={180}
                value={value.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="Örn. Çınar Sokak'ta su kesintisi"
              />
            </label>
            <div className="two-fields">
              <label className="field">
                Kategori
                <select
                  value={value.category}
                  onChange={(event) =>
                    patch({
                      category: event.target.value as Category,
                      reportIds: [],
                    })
                  }
                >
                  {Object.entries(categories).map(([id, category]) => (
                    <option key={id} value={id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Mahalle / etkilenen bölge
                <input
                  required
                  value={value.neighborhood}
                  maxLength={120}
                  onChange={(event) =>
                    patch({ neighborhood: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              Vatandaşa açık açıklama
              <textarea
                required
                minLength={15}
                maxLength={2000}
                rows={4}
                value={value.body}
                onChange={(event) => patch({ body: event.target.value })}
                placeholder="Ne oldu, hangi çalışma sürüyor ve son durum ne?"
              />
            </label>
            <div className="two-fields">
              <label className="field">
                Tahmini bitiş
                <input
                  maxLength={120}
                  value={value.eta}
                  onChange={(event) => patch({ eta: event.target.value })}
                  placeholder="Örn. Bugün 17.00 / Henüz belli değil"
                />
              </label>
              <label className="field">
                Yayın durumu
                <select
                  value={value.state}
                  onChange={(event) =>
                    patch({
                      state: event.target.value as Announcement["state"],
                    })
                  }
                >
                  <option value="draft">Taslak</option>
                  <option value="active">Panelde aktif</option>
                  <option value="completed">Tamamlandı</option>
                </select>
              </label>
            </div>
            <div className="field">
              <span>
                İlişkili talepler <small>Aynı kategorideki kayıtlar</small>
              </span>
              <div className="checkbox-list">
                {candidates.map((report) => (
                  <label key={report.id}>
                    <input
                      type="checkbox"
                      checked={value.reportIds.includes(report.id)}
                      onChange={(event) =>
                        patch({
                          reportIds: event.target.checked
                            ? [...value.reportIds, report.id]
                            : value.reportIds.filter((id) => id !== report.id),
                        })
                      }
                    />
                    <span>
                      <strong>{report.title}</strong>
                      <small>
                        {report.reference} · {report.neighborhood}
                      </small>
                    </span>
                  </label>
                ))}
                {!candidates.length && (
                  <p className="field-note">
                    Bu kategori için bağlanabilecek talep yok.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="editor-preview">
            <span className="eyebrow">VATANDAŞTA GÖRÜNÜM · ÖRNEK</span>
            <div className="phone-preview">
              <CategoryIcon category={value.category} />
              <small>{value.neighborhood || "Bölge"} Mahallesi</small>
              <h3>{value.title || "Duyuru başlığı"}</h3>
              <p>{value.body || "Yazdığın açıklama burada görünecek."}</p>
              <div>
                <Icon name="clock" size={15} />
                {value.eta || "Bitiş zamanı belirtilmedi"}
              </div>
              <span className="phone-follow">
                <Icon name="bell" size={16} />
                Gelişmeleri takip et
              </span>
            </div>
            <p>
              Önizleme yalnız kamuya açık açıklamayı içerir. Kurum içi notlar ve
              vatandaşın kişisel bilgileri gösterilmez.
            </p>
          </div>
        </div>
        {error && <Message>{error}</Message>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button icon="check" type="submit">
            Duyuruyu kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Works({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = usePanel();
  const [editing, setEditing] = useState<Work | null>(null),
    [creating, setCreating] = useState(false);
  const completed = data.works.filter((work) => work.state === "completed");
  const linked = new Set(completed.flatMap((work) => work.reportIds));
  return (
    <>
      <PageHeading
        eyebrow="ÇALIŞMALAR VE SONUÇLAR"
        title="Çalışmalar ve sonuçlar"
        body="Çalışmaları karşıladıkları ihtiyaçlarla ilişkilendir. Talep, destek ve çalışma sayılarını ayrı tut."
      >
        <Button icon="plus" onClick={() => setCreating(true)}>
          Çalışma kaydı oluştur
        </Button>
      </PageHeading>
      <div className="result-stats">
        <div>
          <strong>{completed.length}</strong>
          <span>Tamamlanan çalışma kaydı</span>
        </div>
        <div>
          <strong>{linked.size}</strong>
          <span>Bu çalışmalarla ilişkili talep</span>
        </div>
        <div>
          <Icon name="support" />
          <p>
            İlişki, çalışmanın talep nedeniyle kararlaştırıldığı anlamına
            gelmez. Hizmetin hangi ihtiyacı karşıladığını gösterir.
          </p>
        </div>
      </div>
      <div className="works-grid">
        {data.works.map((work) => (
          <article className="work-card" key={work.id}>
            <div className={`work-illustration ${work.state}`} aria-hidden>
              <div className="work-line" />
              <Icon
                name={work.state === "completed" ? "done" : "work"}
                size={36}
              />
              <span>ÇALIŞMA KAYDI</span>
            </div>
            <div className="work-card-body">
              <div className="card-top">
                <small>{work.neighborhood} Mahallesi</small>
                <span
                  className={`publication-state ${work.state === "completed" ? "completed" : "draft"}`}
                >
                  {work.state === "completed"
                    ? "Tamamlandı"
                    : work.state === "planned"
                      ? "Planlandı"
                      : "Çalışma sürüyor"}
                </span>
              </div>
              <h2>{work.title}</h2>
              <p>{work.body}</p>
              <div className="benefit">
                <Icon name="done" size={17} />
                <span>{work.benefit}</span>
              </div>
              <div className="related-requests">
                <small>KARŞILADIĞI TALEPLER</small>
                {work.reportIds.map((id) => (
                  <button key={id} onClick={() => onOpen(id)}>
                    {data.reports.find((report) => report.id === id)?.reference}
                    <Icon name="up" size={13} />
                  </button>
                ))}
                {!work.reportIds.length && (
                  <p>Henüz talep ilişkilendirilmedi.</p>
                )}
              </div>
              <div className="card-bottom">
                <small>
                  {work.completedAt
                    ? dateText(work.completedAt, false)
                    : "Yapım sonucu henüz yok"}
                </small>
                <Button variant="secondary" onClick={() => setEditing(work)}>
                  Kaydı düzenle
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {(creating || editing) && (
        <WorkEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
function WorkEditor({
  initial,
  onClose,
}: {
  initial: Work | null;
  onClose: () => void;
}) {
  const { data, act } = usePanel();
  const [value, setValue] = useState<Work>(() =>
      initial
        ? { ...initial }
        : {
            id: crypto.randomUUID(),
            title: "",
            neighborhood: "",
            body: "",
            benefit: "",
            state: "planned",
            reportIds: [],
          },
    ),
    [error, setError] = useState("");
  function patch(input: Partial<Work>) {
    setValue((previous) => ({ ...previous, ...input }));
  }
  return (
    <Modal
      title={initial ? "Çalışmayı düzenle" : "Yeni çalışma kaydı"}
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await act({ type: "work", value });
            onClose();
          } catch (error) {
            setError(error instanceof Error ? error.message : "Kaydedilemedi.");
          }
        }}
      >
        <label className="field">
          Çalışma başlığı
          <input
            required
            maxLength={180}
            value={value.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </label>
        <div className="two-fields">
          <label className="field">
            Mahalle / bölge
            <input
              required
              maxLength={120}
              value={value.neighborhood}
              onChange={(event) => patch({ neighborhood: event.target.value })}
            />
          </label>
          <label className="field">
            Çalışma durumu
            <select
              value={value.state}
              onChange={(event) =>
                patch({ state: event.target.value as Work["state"] })
              }
            >
              <option value="planned">Planlandı</option>
              <option value="in_progress">Çalışma sürüyor</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </label>
        </div>
        <label className="field">
          Yapılan / planlanan işlem
          <textarea
            required
            minLength={15}
            maxLength={2000}
            rows={3}
            value={value.body}
            onChange={(event) => patch({ body: event.target.value })}
          />
        </label>
        <label className="field">
          Karşılanan ihtiyaç
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={2}
            value={value.benefit}
            onChange={(event) => patch({ benefit: event.target.value })}
            placeholder="Örn. Sağlık merkezine erişilebilir geçiş"
          />
        </label>
        <div className="field">
          <span>İlişkili talepler</span>
          <div className="checkbox-list">
            {data.reports
              .filter((report) => report.status !== "withdrawn")
              .map((report) => (
                <label key={report.id}>
                  <input
                    type="checkbox"
                    checked={value.reportIds.includes(report.id)}
                    onChange={(event) =>
                      patch({
                        reportIds: event.target.checked
                          ? [...value.reportIds, report.id]
                          : value.reportIds.filter((id) => id !== report.id),
                      })
                    }
                  />
                  <span>
                    <strong>{report.title}</strong>
                    <small>
                      {report.reference} · {report.neighborhood}
                    </small>
                  </span>
                </label>
              ))}
          </div>
        </div>
        <p className="field-note">
          Çalışmayı tamamlandı olarak kaydetmek ilişkili talepleri otomatik
          kapatmaz; vatandaş onayı yerine geçmez.
        </p>
        {error && <Message>{error}</Message>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" icon="check">
            Çalışmayı kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
