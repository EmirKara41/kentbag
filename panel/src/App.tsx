import { lazy, Suspense, useEffect, useState } from "react";
import {
  dateText,
  finished,
  ongoing,
  needsReview,
  sortQueue,
  units,
  type CitizenReport,
} from "./domain";
import { usePanel } from "./store";
import { ReportDetail, Reports, ReportTable } from "./Reports";
import { Announcements, Works } from "./Announcements";
import { InstitutionDirectory } from "./Institutions";
import { StaffManagement, StaffLogin, signOut } from "./Staff";
import {
  Button,
  Empty,
  Icon,
  Message,
  Modal,
  PageHeading,
  type IconName,
} from "./ui";
const MapView = lazy(() => import("./MapView"));
type Page =
  | "overview"
  | "requests"
  | "map"
  | "announcements"
  | "works"
  | "teams"
  | "history"
  | "institutions"
  | "staff";
const pages: { id: Page; title: string; icon: IconName; group?: string }[] = [
  {
    id: "overview",
    title: "Genel bakış",
    icon: "overview",
    group: "ÇALIŞMA ALANI",
  },
  { id: "requests", title: "Talepler", icon: "inbox" },
  { id: "map", title: "Harita", icon: "map" },
  { id: "announcements", title: "Bölge duyuruları", icon: "announce" },
  {
    id: "works",
    title: "Çalışmalar ve sonuçlar",
    icon: "work",
    group: "KOORDİNASYON",
  },
  { id: "teams", title: "Birimler ve ekipler", icon: "team" },
  { id: "institutions", title: "Kurum çalışma alanları", icon: "link" },
  { id: "staff", title: "Personel hesapları", icon: "lock" },
  { id: "history", title: "İşlem geçmişi", icon: "history" },
];
export default function App() {
  const {
    data,
    error,
    reset,
    notice,
    setNotice,
    mode,
    ai,
    busy,
    connect,
    demo,
    lastSync,
    operator,
  } = usePanel();
  const [page, setPage] = useState<Page>("overview"),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [searchQuery, setSearchQuery] = useState(""),
    [resetPrompt, setResetPrompt] = useState(false),
    [resetError, setResetError] = useState("");
  const openCount = data.reports.filter(ongoing).length;
  function navigate(next: Page, initialFilter = "all") {
    setPage(next);
    setFilter(initialFilter);
    setSearchQuery("");
  }
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  if (mode === "offline" && location.protocol === "https:")
    return <StaffLogin title="Merkez paneline giriş" />;
  return (
    <div className="panel-app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate("overview");
          }}
        >
          <span>
            <Icon name="brand" size={26} />
          </span>
          <div>
            Kent<span>Bağ</span>
            <small>BELEDİYE ÇÖZÜM MERKEZİ</small>
          </div>
        </a>
        <div className="municipality">
          <span className="municipality-icon">
            <Icon name="work" size={19} />
          </span>
          <div>
            <strong>Oltu Belediyesi</strong>
            <small>Merkez birim çalışma alanı</small>
          </div>
          <Icon name="chevron" size={14} />
        </div>
        <nav aria-label="Panel gezinme">
          {pages.map((item) => (
            <div key={item.id}>
              {item.group && <span className="nav-group">{item.group}</span>}
              <button
                className={page === item.id ? "active" : ""}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.title}</span>
                {item.id === "requests" && <i>{openCount}</i>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/giris">Personel girişi</a>
          <button
            className="reset-link"
            onClick={() =>
              void signOut().catch(() => location.assign("/giris"))
            }
          >
            Oturumu kapat
          </button>
          <div className="connection-status">
            <i />
            <span>
              {mode === "live" ? "Sunucu bağlı" : "Örnek / bağlantısız alan"}
              <small>
                Oltu · {operator ? "İnternet demosu" : "Yerel pilot"}
              </small>
            </span>
          </div>
          <button
            className="reset-link"
            disabled={mode !== "demo"}
            onClick={() => setResetPrompt(true)}
          >
            <Icon name="reset" size={15} />
            Örnek verileri sıfırla
          </button>
          <div className="operator">
            <span>YO</span>
            <div>
              <strong>{operator?.name ?? "Yerel Operatör"}</strong>
              <small>
                {operator
                  ? "Merkez yetkilisi"
                  : "Bu bilgisayarın pilot oturumu"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Çözüm merkezi <Icon name="chevron" size={13} />
            <strong>{pages.find((item) => item.id === page)?.title}</strong>
          </div>
          <form
            className="top-search"
            onSubmit={(event) => {
              event.preventDefault();
              setPage("requests");
              setFilter("all");
              setSearchQuery(search);
            }}
          >
            <Icon name="search" size={17} />
            <input
              aria-label="Hızlı talep arama"
              placeholder="Talep veya adres ara…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button aria-label="Aramayı aç">
              <kbd>↵</kbd>
            </button>
          </form>
          <span className="top-date">
            {new Intl.DateTimeFormat("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </span>
          <button
            className="top-bell"
            aria-label="Geri dönüşleri aç"
            onClick={() => navigate("requests", "feedback")}
          >
            <Icon name="bell" />
            <i />
          </button>
          <span className="operator-avatar">YO</span>
        </header>
        <div className="demo-banner">
          <Icon name="info" size={15} />
          <span>
            <strong>
              {mode === "live"
                ? `Oltu · ${operator ? "İnternet demosu" : "Yerel bağlantı"}`
                : mode === "connecting"
                  ? "Yerel sisteme bağlanılıyor…"
                  : "Örnek / bağlantısız alan"}
            </strong>
            {mode === "live"
              ? ` — Vatandaş, kurum ve saha akışı bağlı. ${ai === "no_key" ? "Gemini anahtarı yok; kural tabanlı öneriler açık." : "Gemini analizi açık."} Sonuçlar kurum ve merkez kontrolünden sonra paylaşılır.`
              : " — Örnek işlemler gerçek kayıtlara eklenmez."}
            {lastSync && mode === "live" && (
              <small> Son eşitleme: {dateText(lastSync)}</small>
            )}
          </span>
          <div className="connection-actions">
            {mode !== "live" && (
              <button
                disabled={mode === "connecting" || busy}
                onClick={() => {
                  setSelected(null);
                  void connect();
                }}
              >
                Yerel sisteme bağlan
              </button>
            )}
            {mode !== "demo" && (
              <button
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  demo();
                }}
              >
                Örnek alanı aç
              </button>
            )}
          </div>
        </div>
        <main className="workspace">
          {error && <Message>{error}</Message>}
          {page === "overview" && (
            <Overview onOpen={setSelected} onNavigate={navigate} />
          )}
          {page === "requests" && (
            <Reports
              key={filter + searchQuery}
              onOpen={setSelected}
              initialFilter={filter}
              initialQuery={searchQuery}
            />
          )}
          {page === "map" && (
            <Suspense
              fallback={<div className="loading-map">Harita hazırlanıyor…</div>}
            >
              <MapView onOpen={setSelected} />
            </Suspense>
          )}
          {page === "announcements" && <Announcements />}
          {page === "works" && <Works onOpen={setSelected} />}
          {page === "teams" && <Teams onOpen={setSelected} />}
          {page === "institutions" && <InstitutionDirectory />}
          {page === "staff" && <StaffManagement />}
          {page === "history" && (
            <>
              <PageHeading
                eyebrow="KURUM İÇİ KAYIT"
                title="İşlem geçmişi"
                body="Kurum içinde kaydedilen işlemler. Vatandaşa açık açıklamalar ayrıca talebe işlenir."
              />
              <div className="content-panel audit-panel">
                {data.audit.map((item) => (
                  <div key={item.id}>
                    <span>
                      <Icon name="history" size={18} />
                    </span>
                    <p>{item.body}</p>
                    <small>{dateText(item.at)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
          <footer className="workspace-footer">
            <span>
              KentBağ <i>·</i> Vatandaş ile yönetim arasında.
            </span>
            <span>
              {mode === "live"
                ? "Oltu · Gerçek pilot kayıtları"
                : "Örnek veriler"}{" "}
              · Panel 0.3.0
            </span>
          </footer>
        </main>
      </div>
      {selected && data.reports.some((r) => r.id === selected) && (
        <ReportDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
      {resetPrompt && (
        <Modal
          title="Örnek çalışma sıfırlansın mı?"
          onClose={() => setResetPrompt(false)}
        >
          <p className="modal-copy">
            Bu tarayıcıda yaptığın örnek atamalar, açıklamalar, duyurular ve
            çalışma kayıtları başlangıç durumuna döner. Mobil uygulamanın
            kayıtları etkilenmez.
          </p>
          {resetError && <Message>{resetError}</Message>}
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setResetPrompt(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                try {
                  reset();
                  setResetPrompt(false);
                  setResetError("");
                } catch (error) {
                  setResetError(
                    error instanceof Error ? error.message : "Sıfırlanamadı.",
                  );
                }
              }}
            >
              Örnek çalışmayı sıfırla
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Overview({
  onOpen,
  onNavigate,
}: {
  onOpen: (id: string) => void;
  onNavigate: (page: Page, filter?: string) => void;
}) {
  const { data } = usePanel();
  const open = data.reports.filter(ongoing),
    waiting = open.filter((report) => !report.teamId),
    urgent = open.filter(
      (report) =>
        !report.teamId && ["urgent", "high"].includes(report.priority),
    ),
    feedback = data.reports.filter(needsReview);
  const cards = [
    {
      title: "Aktif talepler",
      value: open.length,
      sub: "İşlemi veya incelemesi süren",
      icon: "inbox",
      color: "teal",
      action: () => onNavigate("requests", "ongoing"),
    },
    {
      title: "Atama bekleyen",
      value: waiting.length,
      sub: "Sorumlu ekip seçilmesi gereken",
      icon: "team",
      color: "amber",
      action: () => onNavigate("requests", "waiting"),
    },
    {
      title: "Ekibe yönlendirilen",
      value: open.filter((report) =>
        ["assigned", "in_progress"].includes(report.status),
      ).length,
      sub: "Ekibe atanmış veya çalışılan",
      icon: "work",
      color: "blue",
      action: () => onNavigate("teams"),
    },
    {
      title: "Çözüm bildirilen",
      value: data.reports.filter(finished).length,
      sub: `${data.reports.filter((report) => report.feedback === "solved").length} vatandaş tarafından çözüldü olarak işaretlenen`,
      icon: "done",
      color: "green",
      action: () => onNavigate("requests", "completed"),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="GENEL BAKIŞ"
        title="Bugünün hizmet akışı"
        body="Önce müdahale bekleyenleri gör. Bir sonraki adımı belirle, vatandaşın süreci takip edebilsin."
      >
        <Button icon="announce" onClick={() => onNavigate("announcements")}>
          Bölge duyuruları
        </Button>
      </PageHeading>
      <div className="metric-grid">
        {cards.map((card) => (
          <button
            className="metric-card"
            key={card.title}
            onClick={card.action}
          >
            <div>
              <span>{card.title}</span>
              <span className={`metric-icon ${card.color}`}>
                <Icon name={card.icon} size={19} />
              </span>
            </div>
            <strong>
              {card.value}
              <Icon name="up" size={18} />
            </strong>
            <small>{card.sub}</small>
          </button>
        ))}
      </div>
      <div className="attention-strip">
        <div>
          <span className="attention-icon">
            <Icon name="clock" size={22} />
          </span>
          <p>
            <strong>{urgent.length} yüksek öncelikli talep</strong> kurumun
            değerlendirmesini bekliyor.
            <small>
              Otomatik aciliyet önerileri kurumun incelemesine açıktır.
              Yetkilinin belirlediği öncelik esas alınır.
            </small>
          </p>
        </div>
        <button onClick={() => onNavigate("requests", "waiting")}>
          Taleplere git <Icon name="arrow" size={17} />
        </button>
      </div>
      <div className="overview-grid">
        <section className="content-panel queue-panel">
          <div className="panel-heading">
            <div>
              <h2>Öncelikli iş kuyruğu</h2>
              <p>Öncelik ve bekleme süresine göre</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("requests")}
            >
              Tüm talepler <Icon name="arrow" size={15} />
            </button>
          </div>
          <ReportTable
            compact
            reports={sortQueue(open).slice(0, 5)}
            onOpen={onOpen}
          />
        </section>
        <section className="content-panel active-events">
          <div className="panel-heading">
            <div>
              <h2>Bölgedeki aktif olaylar</h2>
              <p>Ortak açıklama, daha az tekrar</p>
            </div>
            <span className="count-pill">
              {
                data.announcements.filter((item) => item.state === "active")
                  .length
              }
            </span>
          </div>
          {data.announcements
            .filter((item) => item.state === "active")
            .map((item) => (
              <div className="active-event" key={item.id}>
                <span className="event-type">
                  <Icon name="water" size={19} />
                  BÖLGE DUYURUSU · PANEL KAYDI
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <div className="event-metadata">
                  <span>
                    <Icon name="pin" size={13} />
                    {item.neighborhood}
                  </span>
                  <span>{item.reportIds.length} ilişkili talep</span>
                </div>
                <div className="event-time">
                  <Icon name="clock" size={16} />
                  <span>
                    Tahmini bitiş
                    <strong>{item.eta || "Henüz belirtilmedi"}</strong>
                  </span>
                </div>
              </div>
            ))}
          {!data.announcements.some((item) => item.state === "active") && (
            <Empty
              title="Aktif duyuru yok."
              body="Bölge duyurularından yeni bir açıklama hazırlayabilirsin."
            />
          )}
          <button
            className="wide-link"
            onClick={() => onNavigate("announcements")}
          >
            Duyuruları yönet <Icon name="arrow" size={16} />
          </button>
        </section>
      </div>
      <div className="overview-bottom">
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Birimlerin iş dağılımı</h2>
              <p>Devam eden taleplerden hesaplanır</p>
            </div>
            <Icon name="team" size={20} />
          </div>
          <div className="unit-distribution">
            {units
              .filter((unit) => !unit.external)
              .map((unit) => {
                const count = open.filter(
                  (report) => report.unitId === unit.id,
                ).length;
                return (
                  <div key={unit.id}>
                    <span>{unit.name}</span>
                    <div>
                      <i
                        style={{
                          width: `${open.length ? (count / open.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            <div className="unassigned-caption">
              {open.filter((report) => !report.unitId).length} talep henüz
              birime yönlendirilmedi.
            </div>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Vatandaş geri dönüşleri</h2>
              <p>Sonuç sonrası yeniden bakılması gerekenler</p>
            </div>
            <span className="count-pill orange">{feedback.length}</span>
          </div>
          {feedback.map((report) => (
            <button
              key={report.id}
              className="feedback-row"
              onClick={() => onOpen(report.id)}
            >
              <span>
                <Icon name="reset" size={21} />
              </span>
              <div>
                <small>{report.reference}</small>
                <strong>{report.title}</strong>
                <p>“Sorun devam ediyor” geri dönüşü var.</p>
              </div>
              <Icon name="chevron" size={17} />
            </button>
          ))}
          {!feedback.length && (
            <Empty
              title="İncelenecek geri dönüş yok."
              body="Sorunun sürdüğünü bildiren vatandaş kayıtları burada görünür."
            />
          )}
        </section>
      </div>
    </>
  );
}
function Teams({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, act, mode } = usePanel();
  const [error, setError] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="SAHA KOORDİNASYONU"
        title="Birimler ve ekipler"
        body="Birimleri, atanmış işleri ve yeni görev alabilecek ekipleri birlikte gör."
      />
      <div className="team-grid">
        {data.teams.map((team) => {
          const unit = units.find((item) => item.id === team.unitId)!;
          const tasks = data.reports.filter(
            (report) => report.teamId === team.id && ongoing(report),
          );
          return (
            <article key={team.id} className="team-card">
              <div className="card-top">
                <span className="team-symbol">
                  <Icon name="team" size={24} />
                </span>
                <span
                  className={`availability ${team.active ? "available" : "unavailable"}`}
                >
                  <i />
                  {team.active ? "Görev alabilir" : "Yeni göreve kapalı"}
                </span>
              </div>
              <small>{unit.name}</small>
              <h2>{team.name}</h2>
              <div className="team-load">
                <strong>{tasks.length}</strong>
                <span>
                  aktif görev
                  <small>
                    {mode === "live"
                      ? "Merkez birim kaydı · Kurumun saha görevlerinden ayrı"
                      : "Örnek atama kayıtları"}
                  </small>
                </span>
                <b>{team.code}</b>
              </div>
              <div className="team-tasks">
                {tasks.map((report) => (
                  <button key={report.id} onClick={() => onOpen(report.id)}>
                    <span>{report.title}</span>
                    <Icon name="up" size={14} />
                  </button>
                ))}
                {!tasks.length && <p>Atanmış aktif görev yok.</p>}
              </div>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await act({
                      type: "team",
                      id: team.id,
                      active: !team.active,
                    });
                    setError("");
                  } catch (error) {
                    setError(
                      error instanceof Error ? error.message : "Kaydedilemedi.",
                    );
                  }
                }}
              >
                {team.active ? "Yeni görevlere kapat" : "Görev alabilir yap"}
              </Button>
            </article>
          );
        })}
      </div>
      {error && <Message>{error}</Message>}
      <div className="external-unit">
        <Icon name="external" size={22} />
        <div>
          <h3>Dış kurum yönlendirmeleri</h3>
          <p>
            Elektrik dağıtım kurumu gibi dış sorumlulara ait talepler için
            yönlendirme kaydı tutulur. Teslim teyidi olmadan iletildi veya
            çözüldü bilgisi üretilmez.
          </p>
        </div>
      </div>
    </>
  );
}
