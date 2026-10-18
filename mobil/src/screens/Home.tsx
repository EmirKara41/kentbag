import {
  categories,
  categoryFor,
  dateText,
  completionTime,
  isCompleted,
  isOngoing,
  statusNames,
} from "../domain";
import { useStore } from "../store";
import { useNav } from "../navigation";
import { useCommunity } from "../community";
import { Icon } from "../ui";
import { AreaPicker, CommunityCard, ExampleNotice } from "./Neighborhood";

export function Home() {
  const { profile, workspace, draft } = useStore(),
    nav = useNav(),
    community = useCommunity();
  const reports = workspace?.reports ?? [];
  const completed = reports
      .filter(isCompleted)
      .sort(
        (a, b) => Date.parse(completionTime(b)) - Date.parse(completionTime(a)),
      ),
    ongoing = reports
      .filter(isOngoing)
      .sort(
        (a, b) =>
          Date.parse(
            b.feedback?.createdAt ?? b.events.at(-1)?.createdAt ?? b.createdAt,
          ) -
          Date.parse(
            a.feedback?.createdAt ?? a.events.at(-1)?.createdAt ?? a.createdAt,
          ),
      );
  const latest = ongoing[0];
  const incidents = community.items.filter((item) => item.type === "incident");
  const outcome = community.items.find((item) => item.type === "completed");
  return (
    <div className="page home-page civic-home">
      <div className="greeting greeting-reserved" aria-hidden="true" />
      <AreaPicker />
      <section className="local-overview">
        <div className="local-heading">
          <span className="live-mark" />
          <span>Bölgemde şu an</span>
          {incidents[0] && <span className="example-label">ÖRNEK İÇERİK</span>}
        </div>
        <h2>
          {incidents[0]?.title ?? "Bölgenin gelişmeleri burada buluşacak."}
        </h2>
        <p>
          {incidents[0]
            ? "Çınar Sokak ve çevresi · Onarım sürüyor. Tahmini bitiş 17.00. Son açıklama 14.20."
            : "Kurum bağlantısı açıldığında devam eden çalışmaların son durumunu burada görebilirsin."}
        </p>
        <div className="overview-city" aria-hidden="true">
          <span />
          <span />
          <span />
          <i />
          <span />
          <span />
        </div>
        <button
          onClick={() =>
            incidents[0]
              ? nav.go({ name: "community-detail", id: incidents[0].id })
              : nav.tab("neighborhood")
          }
        >
          {incidents[0] ? "Gelişmeleri incele" : "Mahalleme göz at"}{" "}
          <Icon name="arrow" size={17} />
        </button>
        {incidents[0] && (
          <small className="hero-example-note">
            Tasarım örneği · Gerçek kesinti duyurusu değildir.
          </small>
        )}
      </section>
      {draft && (
        <button
          className="draft-banner"
          onClick={() => nav.report(undefined, true)}
        >
          <span className="draft-icon">
            <Icon name="edit" size={19} />
          </span>
          <span>
            <strong>Yarım kalan bir bildirimin var</strong>
            <small>Kaldığın yerden devam et</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      )}
      <div className="report-entry-pair">
        <button onClick={() => nav.report()}>
          <span className="entry-symbol issue">
            <Icon name="road" size={24} />
          </span>
          <strong>Bir sorun var</strong>
          <small>Arıza veya aksaklık bildir</small>
          <Icon name="arrow" size={17} />
        </button>
        <button onClick={() => nav.report(undefined, false, "improvement")}>
          <span className="entry-symbol improvement">
            <Icon name="tree" size={24} />
          </span>
          <strong>Bir fikrim var</strong>
          <small>İyileştirme isteği paylaş</small>
          <Icon name="arrow" size={17} />
        </button>
      </div>
      <section className="personal-section">
        <div className="section-heading">
          <h2>Benim kayıtlarım</h2>
          <button onClick={() => nav.tab("reports")}>
            Tümü <Icon name="chevron" size={14} />
          </button>
        </div>
        {latest ? (
          <button
            className="personal-latest"
            onClick={() => nav.go({ name: "detail", id: latest.id })}
          >
            <div className="personal-latest-top">
              <span>
                <Icon name="clock" size={15} />
                DEVAM EDEN TALEBİN
              </span>
              <small>{latest.reference}</small>
            </div>
            <h3>{categoryFor(latest.category).name}</h3>
            <p>{latest.events.at(-1)?.body ?? latest.description}</p>
            <div>
              <span className={`status ${latest.status}`}>
                {latest.feedback?.outcome === "persists"
                  ? "Sorun devam ediyor · Geri dönüşün alındı"
                  : statusNames[latest.status]}
              </span>
              <Icon name="chevron" size={17} />
            </div>
          </button>
        ) : (
          <div className="personal-idle">
            <Icon name="file" size={23} />
            <div>
              <strong>
                {profile
                  ? "Devam eden talebin yok."
                  : "Sürecin hep gözünün önünde."}
              </strong>
              <p>
                {profile
                  ? "Yeni bir ihtiyacını buradan paylaşabilirsin."
                  : "Giriş yaptığında kayıtlarını burada takip edebilirsin."}
              </p>
            </div>
          </div>
        )}
        <button
          className="completed-collection"
          onClick={() => nav.go({ name: "reports", filter: "completed" })}
        >
          <span className="collection-icon">
            <Icon name="done" size={25} />
          </span>
          <span>
            <strong>Tamamlanan taleplerim</strong>
            <small>
              {completed.length
                ? `${completed.length} talebin sonuçlandı. Hepsi burada.`
                : "Çözülen taleplerin zamanla burada biriksin."}
            </small>
          </span>
          <span className="collection-count">
            {completed.length || <Icon name="chevron" size={18} />}
          </span>
        </button>
      </section>
      <section className="local-section">
        <div className="section-heading">
          <h2>Diğer bölge gelişmeleri</h2>
          <button onClick={() => nav.tab("neighborhood")}>
            Tümü <Icon name="chevron" size={14} />
          </button>
        </div>
        {community.examples && <ExampleNotice />}
        {incidents.length ? (
          <div className="community-list">
            {incidents.slice(1).map((item) => (
              <CommunityCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="quiet-card">
            <Icon name="bell" />
            <p>
              Kurumun bölge duyuruları bağlantı açıldığında burada görünecek.
            </p>
            <button onClick={() => nav.tab("neighborhood")}>
              Örnek deneyimi incele <Icon name="arrow" size={15} />
            </button>
          </div>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Ne bildirmek istersin?</h2>
          <span>Hızlı bildirim</span>
        </div>
        <div className="services">
          {categories.map((category) => (
            <button
              key={category.id}
              className="service"
              onClick={() => nav.report(category.id)}
              aria-label={`${category.name} bildir`}
            >
              <span style={{ background: category.bg, color: category.color }}>
                <Icon name={category.icon} size={23} />
              </span>
              <strong>{category.short}</strong>
            </button>
          ))}
        </div>
      </section>
      {outcome && (
        <section className="local-section">
          <div className="section-heading">
            <h2>Birlikte görünen sonuçlar</h2>
            <Icon name="done" size={18} />
          </div>
          <p className="section-caption">
            Bir çalışma, birden fazla ihtiyaca karşılık verebilir.
          </p>
          <CommunityCard item={outcome} />
          <small className="example-caption">
            Örnek çalışma · Gerçek kurum kaydı değildir.
          </small>
        </section>
      )}
      {completed.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Son tamamlanan talebin</h2>
          </div>
          {completed.slice(0, 1).map((report) => (
            <button
              key={report.id}
              className="completed-mini"
              onClick={() => nav.go({ name: "detail", id: report.id })}
            >
              <Icon name="done" size={23} />
              <span>
                <strong>{categoryFor(report.category).name}</strong>
                <small>
                  {dateText(
                    report.resolution?.completedAt ??
                      report.events.at(-1)?.createdAt ??
                      report.createdAt,
                  )}{" "}
                  · {report.reference}
                </small>
              </span>
              <Icon name="chevron" size={17} />
            </button>
          ))}
        </section>
      )}
      <button className="how-card" onClick={() => nav.go({ name: "help" })}>
        <span className="how-icon">
          <Icon name="help" size={24} />
        </span>
        <span>
          <strong>Bildirimin nasıl ilerliyor?</strong>
          <small>Süreci ve hizmetleri tanı</small>
        </span>
        <Icon name="chevron" size={18} />
      </button>
      <div className="home-footer">
        <Icon name="shield" size={14} />
        <span>Konumun yalnızca sen paylaştığında alınır.</span>
      </div>
    </div>
  );
}
