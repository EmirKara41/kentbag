import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  institutionProfiles,
  deliveryNames,
  type InstitutionProfile,
  type InstitutionCase,
  type InstitutionOrder,
} from "../../sunucu/src/institution-domain";
import {
  categories,
  dateText,
  priorities,
  units,
  waitingText,
  type CitizenReport,
  type Category,
} from "./domain";
import { usePanel } from "./store";
import { Button, Empty, Icon, Message, Modal, PageHeading } from "./ui";
import "./institutions.css";
import { StaffLogin, signOut, staffRequest, type StaffIdentity } from "./Staff";

export function InstitutionCatalog({ reports }: { reports?: CitizenReport[] }) {
  return (
    <div className="institution-directory">
      <PageHeading
        eyebrow="KURUMLAR ARASI KOORDİNASYON"
        title="Kurum çalışma alanları"
        body="Merkezden gelen talepleri incelemek ve saha görevlerini hazırlamak için sade çalışma alanları."
      />
      <div className="institution-pilot-note">
        <Icon name="info" size={19} />
        <p>
          <strong>Oltu yerel pilotu</strong> Bu sayfalar proje içindeki kurum
          rollerini temsil eder. Gerçek kurumların sistemlerine bağlantı veya
          ekiplerine teslim henüz yoktur.
        </p>
      </div>
      <div className="institution-grid">
        {institutionProfiles.map((profile) => {
          const incoming = (reports ?? []).filter(
              (r) => r.institutionDelivery?.unitId === profile.id,
            ),
            queued = incoming.filter(
              (r) => r.institutionDelivery?.state === "queued",
            ).length;
          return (
            <article
              className="institution-card"
              key={profile.id}
              style={{ "--institution-color": profile.color } as CSSProperties}
            >
              <div className="institution-card-top">
                <span className="institution-icon">
                  <Icon name={profile.icon} size={26} />
                </span>
                <span className="institution-pilot-label">PİLOT ALAN</span>
              </div>
              <h2>{profile.name}</h2>
              <p>{profile.description}</p>
              {reports && (
                <div className="institution-card-counts">
                  <span>
                    <strong>{queued}</strong> yeni gönderim
                  </span>
                  <span>
                    <strong>
                      {
                        incoming.filter(
                          (r) => r.institutionDelivery?.state === "accepted",
                        ).length
                      }
                    </strong>{" "}
                    incelemede
                  </span>
                </div>
              )}
              <a
                className="button secondary"
                href={`/kurumlar/${profile.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Çalışma alanını aç <Icon name="arrow" size={17} />
              </a>
            </article>
          );
        })}
      </div>
      <div className="institution-flow">
        <span>
          <i>1</i> Merkez talebi gönderir
        </span>
        <Icon name="arrow" />
        <span>
          <i>2</i> Kurum incelemeye alır
        </span>
        <Icon name="arrow" />
        <span>
          <i>3</i> Görev emri hazırlanır
        </span>
        <Icon name="arrow" />
        <span className="muted">
          <i>4</i> Saha bağlantısı sonraki aşama
        </span>
      </div>
    </div>
  );
}
export function InstitutionDirectory() {
  const { data } = usePanel();
  return <InstitutionCatalog reports={data.reports} />;
}
export function InstitutionForward({ report }: { report: CitizenReport }) {
  const { forward, mode, busy } = usePanel();
  const [unitId, setUnitId] = useState(report.unitId ?? ""),
    [instruction, setInstruction] = useState(""),
    [error, setError] = useState("");
  const [channel, setChannel] = useState<"portal" | "both">("portal");
  const delivery = report.institutionDelivery,
    profile = institutionProfiles.find((p) => p.id === delivery?.unitId);
  const alreadySent =
    delivery?.unitId === unitId && delivery.state !== "returned";
  return (
    <section className="form-section institution-forward">
      <div className="institution-section-title">
        <Icon name="send" size={19} />
        <h3>Kurum çalışma alanına gönder</h3>
      </div>
      <p className="field-note">
        Bu gönderim ilgili kurumun pilot kuyruğuna düşer. Vatandaşa otomatik
        bildirim veya saha ekibine teslim anlamına gelmez.
      </p>
      {delivery && (
        <div className={`institution-delivery ${delivery.state}`}>
          <strong>
            {profile?.name} · {deliveryNames[delivery.state]}
          </strong>
          <small>
            {dateText(delivery.createdAt)} tarihinde gönderildi
            {delivery.acceptedAt
              ? ` · ${dateText(delivery.acceptedAt)} teslim alındı`
              : ""}
          </small>
          <p>{delivery.instruction}</p>
          {delivery.returnReason && (
            <p>İade gerekçesi: {delivery.returnReason}</p>
          )}
          <span>
            {delivery.preparedCount} hazır görev emri · Saha teslimi bekliyor
          </span>
          {profile && (
            <a
              href={`/kurumlar/${profile.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Kurum alanını aç <Icon name="external" size={13} />
            </a>
          )}
        </div>
      )}
      {!!delivery?.events?.length && (
        <details className="institution-center-history">
          <summary>
            Kurum işlem geçmişi · {delivery.events.length} kayıt
          </summary>
          {delivery.events.map((event) => (
            <article key={event.id}>
              <small>{dateText(event.createdAt)}</small>
              <strong>{event.kind}</strong>
              <p>{event.body}</p>
            </article>
          ))}
        </details>
      )}
      <label className="field">
        Hedef kurum
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Kurum seç</option>
          {units
            .filter((u) => u.categories.includes(report.category))
            .map((u) => (
              <option value={u.id} key={u.id}>
                {institutionProfiles.find((p) => p.id === u.id)?.name ?? u.name}
              </option>
            ))}
        </select>
      </label>
      {!alreadySent && (
        <label className="field">
          Kuruma iletilecek not
          <textarea
            rows={3}
            value={instruction}
            maxLength={2000}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="İncelenmesini istediğiniz konuyu ve kurumdan beklenen işlemi yazın…"
          />
        </label>
      )}
      {!alreadySent && (
        <label className="field">
          İletim kanalı
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "portal" | "both")}
          >
            <option value="portal">Kurum paneli</option>
            <option value="both">Kurum paneli + demo e-posta</option>
          </select>
          <small>
            E-posta kopyası yapılandırılmış test alıcısına gider. Kurumun panel
            kullanması zorunlu değildir.
          </small>
        </label>
      )}
      {error && <Message>{error}</Message>}
      <Button
        icon="send"
        disabled={
          mode !== "live" ||
          busy ||
          !unitId ||
          alreadySent ||
          instruction.trim().length < 5
        }
        onClick={() =>
          void forward({
            id: report.id,
            unitId,
            instruction: instruction.trim(),
            channel,
          })
            .then(() => {
              setInstruction("");
              setError("");
            })
            .catch((e) => setError(e.message))
        }
      >
        {busy
          ? "Kaydediliyor…"
          : alreadySent
            ? "Kurum kuyruğunda"
            : "Kurum kuyruğuna gönder"}
      </Button>
      {delivery && (
        <InstitutionMailStatus
          reportId={report.id}
          updatedAt={delivery.updatedAt}
        />
      )}
    </section>
  );
}
function InstitutionMailStatus({
  reportId,
  updatedAt,
}: {
  reportId: string;
  updatedAt: string;
}) {
  const { staffAdmin } = usePanel();
  const [items, setItems] = useState<
      {
        id: string;
        recipient: string;
        subject: string;
        body: string;
        state: string;
        error?: string;
        attempts: number;
      }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await staffAdmin<{ mails: typeof items }>(
      `/institutions/mail/${reportId}`,
    );
    setItems(result.mails);
  }, [reportId, staffAdmin]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load, updatedAt]);
  return (
    <div className="institution-center-history">
      <h4>E-posta iletimi</h4>
      {error && <Message>{error}</Message>}
      {!items.length && (
        <p className="field-note">Bu gönderimde e-posta seçilmedi.</p>
      )}
      {items.map((m) => (
        <article key={m.id}>
          <strong>
            {
              {
                queued: "Gönderim bekliyor",
                sending: "Gönderiliyor",
                sent: "E-posta sağlayıcısı kabul etti",
                failed: "E-posta gönderilemedi",
              }[m.state]
            }
          </strong>
          <p>{m.recipient}</p>
          <small>Bu durum kurumun mesajı okuduğu anlamına gelmez.</small>
          {m.error && <Message>{m.error}</Message>}
          <details>
            <summary>Gönderilen metni incele</summary>
            <strong>{m.subject}</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
          </details>
          {m.state !== "sent" && m.attempts < 3 && (
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void staffAdmin(`/institutions/mail/${reportId}/retry`, {})
                  .then(load)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              Gönderimi yeniden dene
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
type Workspace = {
  cases: InstitutionCase[];
  profile: InstitutionProfile;
  crewConnected: false;
};
function useInstitution(profile: InstitutionProfile) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [lastSync, setLastSync] = useState("");
  const token = useRef(""),
    mutation = useRef(false),
    epoch = useRef(0);
  const remote = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const response = await fetch(`/api/institutions/${profile.id}${path}`, {
        method: body === undefined ? "GET" : "POST",
        cache: "no-store",
        credentials: "include",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          ...(token.current
            ? { Authorization: `Bearer ${token.current}` }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Kurum alanına ulaşılamadı.");
      return result;
    },
    [profile.id],
  );
  const refresh = useCallback(async () => {
    if (mutation.current) return;
    const expected = epoch.current;
    try {
      const result = await remote<Workspace>("/workspace");
      if (expected !== epoch.current || mutation.current) return;
      setData(result);
      setError("");
      setConnected(true);
      setLastSync(new Date().toISOString());
    } catch (e) {
      if (expected === epoch.current) {
        setError(e instanceof Error ? e.message : "Bağlantı kesildi.");
        setConnected(false);
      }
    }
  }, [remote]);
  const connect = useCallback(async () => {
    const expected = ++epoch.current;
    setConnected(false);
    setError("");
    setBusy(true);
    try {
      token.current = "";
      await remote<Workspace>("/workspace");
      if (expected !== epoch.current) return;
      await refresh();
    } catch (e) {
      if (expected === epoch.current)
        setError(e instanceof Error ? e.message : "Bağlanılamadı.");
    } finally {
      if (expected === epoch.current) setBusy(false);
    }
  }, [refresh, remote]);
  useEffect(() => {
    void connect();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && token.current)
        void refresh();
    }, 5000);
    const focus = () => {
      if (token.current) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      epoch.current++;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [connect, refresh]);
  async function act(body: unknown) {
    if (mutation.current) throw new Error("Önceki işlem sürüyor.");
    if (!connected) throw new Error("Önce kurum alanına yeniden bağlanın.");
    mutation.current = true;
    setBusy(true);
    epoch.current++;
    try {
      await remote("/actions", body);
      const result = await remote<Workspace>("/workspace");
      setData(result);
      setError("");
      setLastSync(new Date().toISOString());
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  return { data, error, busy, connected, lastSync, refresh, connect, act };
}
export function InstitutionApp() {
  const slug = location.pathname.split("/")[2],
    profile = institutionProfiles.find((p) => p.slug === slug);
  useEffect(() => {
    const previous = document.title;
    document.title = `${profile?.name ?? "Kurum çalışma alanları"} · KentBağ`;
    return () => {
      document.title = previous;
    };
  }, [profile?.name]);
  return profile ? (
    <InstitutionWorkspace key={profile.id} profile={profile} />
  ) : (
    <div className="institution-catalog-shell">
      <a className="institution-brand" href="/">
        KentBağ <span>Merkez panel</span>
      </a>
      <InstitutionCatalog />
    </div>
  );
}
function InstitutionWorkspace({ profile }: { profile: InstitutionProfile }) {
  const store = useInstitution(profile);
  const [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState("requests");
  const cases = store.data?.cases ?? [],
    pending = cases.filter(
      (c) => c.delivery.state === "queued" && isActionable(c),
    ),
    prepared = cases.flatMap((c) =>
      c.orders.filter((o) => o.state === "prepared"),
    );
  const filtered = cases
    .filter(
      (c) =>
        (filter === "all" ||
          (filter === "orders" && c.delivery.preparedCount > 0) ||
          c.delivery.state === filter) &&
        `${c.reference} ${c.title} ${c.address} ${c.description}`
          .toLocaleLowerCase("tr")
          .includes(query.toLocaleLowerCase("tr")),
    )
    .sort(
      (a, b) =>
        ({ urgent: 0, high: 1, normal: 2, low: 3 })[a.priority] -
          { urgent: 0, high: 1, normal: 2, low: 3 }[b.priority] ||
        Date.parse(a.delivery.createdAt) - Date.parse(b.delivery.createdAt),
    );
  const chosen = cases.find((c) => c.id === selected);
  if (!store.data)
    return (
      <StaffLogin
        title={`${profile.short} · Giriş`}
        onLogin={async () => {
          const identity = await staffRequest<StaffIdentity>("/api/staff/me");
          if (identity.role !== "institution" || identity.unitId !== profile.id)
            throw new Error(
              "Bu hesap seçili kuruma yetkili değil. Kendi kurumunuzun sayfasından giriş yapın.",
            );
          await store.connect();
        }}
      />
    );
  return (
    <div
      className="institution-app"
      style={{ "--institution-color": profile.color } as CSSProperties}
    >
      <aside className="institution-sidebar">
        <a className="institution-brand" href="/kurumlar">
          Kent<span>Bağ</span>
          <small>KURUM ÇALIŞMA ALANI</small>
        </a>
        <div className="institution-identity">
          <span className="institution-icon">
            <Icon name={profile.icon} size={26} />
          </span>
          <h2>{profile.name}</h2>
          <p>Oltu · Pilot kurum rolü</p>
        </div>
        <nav aria-label="Kurum gezinme">
          {[
            { id: "requests", name: "Gelen talepler", icon: "inbox" },
            { id: "orders", name: "Görev emirleri", icon: "work" },
            { id: "teams", name: "Ekip hazırlığı", icon: "team" },
          ].map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
            >
              <Icon name={item.icon} />
              {item.name}
              {item.id === "requests" && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="institution-sidebar-bottom">
          <button
            className="button secondary"
            onClick={() =>
              void signOut().catch(() => location.assign("/giris"))
            }
          >
            Oturumu kapat
          </button>
          <span
            className={`institution-connection ${store.connected ? "online" : ""}`}
          >
            <i />
            {store.connected ? "Sunucu bağlı" : "Bağlantı bekleniyor"}
          </span>
          <p>
            Bu rol yalnız {profile.short.toLocaleLowerCase("tr")} taleplerine
            erişir.
          </p>
          <a href="/">
            Merkez panele dön <Icon name="external" size={14} />
          </a>
        </div>
      </aside>
      <div className="institution-main">
        <header className="institution-topbar">
          <span>
            Kurum koordinasyonu <Icon name="chevron" size={14} />{" "}
            <strong>
              {page === "requests"
                ? "Gelen talepler"
                : page === "orders"
                  ? "Görev emirleri"
                  : "Ekip hazırlığı"}
            </strong>
          </span>
          <button
            className="button secondary"
            onClick={() =>
              void (store.connected ? store.refresh() : store.connect())
            }
            disabled={store.busy}
          >
            <Icon name="reset" size={16} />
            {store.connected ? "Yenile" : "Yeniden bağlan"}
          </button>
        </header>
        <main className="institution-content">
          <div className="institution-pilot-note">
            <Icon name="info" size={19} />
            <p>
              <strong>Kurum çalışma alanı.</strong> Yalnızca bu kuruma yetkili
              personel erişir. Görev emirleri saklanır; saha uygulaması henüz
              bağlı değildir.
            </p>
          </div>
          {store.error && <Message>{store.error}</Message>}
          {page === "requests" && (
            <>
              <PageHeading
                eyebrow="MERKEZDEN KURUMUNUZA"
                title="Gelen talepler"
                body="Talebi incelemeye alın, gerekli bilgiyi paylaşın ve saha görevini hazırlayın."
              />
              <div className="institution-stats">
                <button onClick={() => setFilter("queued")}>
                  <span>Yeni gönderim</span>
                  <strong>{pending.length}</strong>
                  <small>Kurumun incelemeye alması bekleniyor</small>
                </button>
                <button onClick={() => setFilter("accepted")}>
                  <span>İncelemede</span>
                  <strong>
                    {
                      cases.filter(
                        (c) =>
                          c.delivery.state === "accepted" && isActionable(c),
                      ).length
                    }
                  </strong>
                  <small>Kurum tarafından teslim alınan</small>
                </button>
                <button onClick={() => setFilter("orders")}>
                  <span>Hazır görev emri</span>
                  <strong>{prepared.length}</strong>
                  <small>Saha uygulamasına teslim bekliyor</small>
                </button>
              </div>
              <section className="content-panel institution-queue">
                <div className="institution-queue-toolbar">
                  <label className="institution-search">
                    <Icon name="search" size={18} />
                    <input
                      aria-label="Kurum taleplerinde ara"
                      placeholder="Talep no, konu veya adres ara…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Kurum talep durumu"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Tüm talepler</option>
                    <option value="queued">Yeni gönderimler</option>
                    <option value="accepted">İncelemedekiler</option>
                    <option value="orders">Görev emri hazırlananlar</option>
                    <option value="returned">Merkeze iade edilenler</option>
                  </select>
                </div>
                <div className="institution-queue-heading">
                  <span>{filtered.length} kayıt</span>
                  <small>Öncelik ve gönderim zamanına göre</small>
                </div>
                {!store.data ? (
                  <Empty
                    title={
                      store.busy
                        ? "Çalışma alanı yükleniyor…"
                        : "Kurum alanına bağlanılamadı."
                    }
                    body="Yerel API açık olduğunda yeniden bağlanabilirsiniz."
                  />
                ) : filtered.length ? (
                  <div className="institution-case-list">
                    {filtered.map((item) => (
                      <button
                        className="institution-case-row"
                        key={item.id}
                        onClick={() => setSelected(item.id)}
                      >
                        <span className="institution-case-icon">
                          <Icon
                            name={categories[item.category as Category].icon}
                          />
                        </span>
                        <div className="institution-case-topic">
                          <small>
                            {item.reference} ·{" "}
                            {waitingText(item.delivery.createdAt)}
                          </small>
                          <strong>{item.title}</strong>
                          <span>
                            {item.address || "Haritada konum paylaşıldı"}
                          </span>
                        </div>
                        <span
                          className={`institution-priority ${item.priority}`}
                        >
                          {priorities[item.priority]}
                        </span>
                        <span
                          className={`institution-stage ${item.delivery.state}`}
                        >
                          {isActionable(item)
                            ? deliveryNames[item.delivery.state]
                            : "Merkezde sonuçlandı"}
                        </span>
                        <Icon name="chevron" size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Bu görünümde talep yok."
                    body="Merkez panelinden kurumunuza gönderilen talepler burada görünecek. Diğer kurumların kayıtları listelenmez."
                  />
                )}
              </section>
            </>
          )}
          {page === "orders" && (
            <>
              <PageHeading
                eyebrow="SAHA İÇİN HAZIRLIK"
                title="Görev emirleri"
                body="Kurumun hazırladığı işler burada saklanır. Saha uygulaması bağlandığında teslim ve sonuç akışı eklenecek."
              />
              {prepared.length ? (
                <div className="institution-order-grid">
                  {cases.flatMap((item) =>
                    item.orders
                      .filter((o) => o.state === "prepared")
                      .map((order) => (
                        <article
                          className="content-panel institution-order-card"
                          key={order.id}
                        >
                          <span className="institution-stage accepted">
                            Hazır · Teslim bekliyor
                          </span>
                          <h2>
                            {
                              profile.teams.find((t) => t.id === order.teamId)
                                ?.name
                            }
                          </h2>
                          <small>
                            {item.reference} · {item.title}
                          </small>
                          <p>{order.instruction}</p>
                          <span
                            className={`institution-priority ${order.priority}`}
                          >
                            {priorities[order.priority]}
                          </span>
                          <Button
                            variant="secondary"
                            onClick={() => setSelected(item.id)}
                          >
                            Talebi aç
                          </Button>
                        </article>
                      )),
                  )}
                </div>
              ) : (
                <Empty
                  title="Henüz görev emri hazırlanmadı."
                  body="İncelemeye aldığınız bir talebin ayrıntılarından görev emri hazırlayabilirsiniz."
                />
              )}
            </>
          )}
          {page === "teams" && (
            <>
              <PageHeading
                eyebrow="KURUM EKİPLERİ"
                title="Saha ekiplerine hazırlık"
                body="Bu ekipler pilot görev hedefleridir. Henüz çalışan hesabı, mobil uygulama veya teslim bağlantısı yoktur."
              />
              <div className="institution-order-grid">
                {profile.teams.map((team) => (
                  <article
                    className="content-panel institution-order-card"
                    key={team.id}
                  >
                    <span className="institution-icon">
                      <Icon name="team" size={25} />
                    </span>
                    <h2>{team.name}</h2>
                    <p>
                      {prepared.filter((o) => o.teamId === team.id).length}{" "}
                      görev emri hazır
                    </p>
                    <small>Pilot ekip tanımı · Saha oturumu bağlı değil</small>
                  </article>
                ))}
              </div>
            </>
          )}
          <footer className="institution-footer">
            <span>KentBağ · {profile.name}</span>
            <span>
              {store.lastSync
                ? `Son eşitleme ${dateText(store.lastSync)}`
                : "Henüz eşitlenmedi"}
            </span>
          </footer>
        </main>
      </div>
      {chosen && (
        <InstitutionDetail
          key={chosen.id}
          item={chosen}
          profile={profile}
          busy={store.busy || !store.connected}
          act={store.act}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function isActionable(item: InstitutionCase) {
  return item.actionable;
}
function InstitutionDetail({
  item,
  profile,
  busy,
  act,
  onClose,
}: {
  item: InstitutionCase;
  profile: InstitutionProfile;
  busy: boolean;
  act: (body: unknown) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("process"),
    [body, setBody] = useState(""),
    [audience, setAudience] = useState("note"),
    [teamId, setTeam] = useState<string>(profile.teams[0].id),
    [instruction, setInstruction] = useState(""),
    [priority, setPriority] = useState<InstitutionOrder["priority"]>(
      item.priority,
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function run(action: unknown, message: string) {
    setError("");
    setSuccess("");
    try {
      await act(action);
      setSuccess(message);
      setBody("");
      setInstruction("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    }
  }
  const active = item.orders.find((o) => o.state === "prepared"),
    accepted = item.delivery.state === "accepted" && isActionable(item);
  return (
    <Modal title={item.reference} onClose={onClose} drawer>
      <div className="institution-detail">
        <div className="institution-detail-heading">
          <span className="institution-icon">
            <Icon name={categories[item.category as Category].icon} size={25} />
          </span>
          <div>
            <h2>{item.title}</h2>
            <span className={`institution-stage ${item.delivery.state}`}>
              {deliveryNames[item.delivery.state]}
            </span>
          </div>
          <span className={`institution-priority ${item.priority}`}>
            {priorities[item.priority]}
          </span>
        </div>
        <p className="institution-original-description">{item.description}</p>
        <div className="institution-address">
          <Icon name="pin" size={18} />
          {item.address || "Konum haritada işaretlendi"}
          {item.point && (
            <small>
              {item.point[0].toFixed(5)}, {item.point[1].toFixed(5)}
            </small>
          )}
        </div>
        {item.photos.length > 0 && (
          <div className="institution-photo-strip">
            {item.photos.map((photo) => (
              <a
                key={photo.id}
                href={photo.uri}
                target="_blank"
                rel="noreferrer"
              >
                <img src={photo.uri} alt="Talebe eklenen fotoğraf" />
              </a>
            ))}
          </div>
        )}
        <div className="institution-center-note">
          <strong>Merkezden iletilen not</strong>
          <p>{item.delivery.instruction}</p>
          <small>{dateText(item.delivery.createdAt)}</small>
        </div>
        <div
          className="institution-detail-tabs"
          role="tablist"
          aria-label="Talep bölümleri"
        >
          <button
            role="tab"
            aria-selected={tab === "process"}
            onClick={() => setTab("process")}
          >
            İşlem ve görev
          </button>
          <button
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
          >
            Kurum geçmişi <span>{item.events.length}</span>
          </button>
        </div>
        {error && <Message>{error}</Message>}
        {success && (
          <p className="institution-success" role="status">
            <Icon name="check" size={17} />
            {success}
          </p>
        )}
        {tab === "history" ? (
          <div className="institution-event-list">
            {item.events.map((event) => (
              <article key={event.id}>
                <small>{dateText(event.createdAt)}</small>
                <strong>{event.kind}</strong>
                <p>{event.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <>
            {!isActionable(item) ? (
              <Message>
                Bu kayıt merkezde sonuçlanmış veya geri çekilmiş. Yeni kurum
                işlemi yapılamaz.
              </Message>
            ) : item.delivery.state === "queued" ? (
              <section className="form-section">
                <h3>Talebi teslim alın</h3>
                <p>
                  İncelemeye aldığınızda merkez paneli kurumun kaydı gördüğünü
                  gösterecek. Bu işlem vatandaşa otomatik mesaj göndermez.
                </p>
                <Button
                  disabled={busy}
                  icon="check"
                  onClick={() =>
                    void run(
                      { type: "accept", id: item.id },
                      "Talep kurum incelemesine alındı.",
                    )
                  }
                >
                  İncelemeye al
                </Button>
              </section>
            ) : item.delivery.state === "returned" ? (
              <Message>
                Talep merkeze iade edildi: {item.delivery.returnReason}. Yeni
                işlem için merkezin yeniden göndermesi gerekiyor.
              </Message>
            ) : null}
            {accepted && (
              <>
                <section className="form-section">
                  <h3>Saha görevini hazırla</h3>
                  <p className="field-note">
                    Hazırlanan emir kaydedilir. Saha çalışanına gönderim, teslim
                    ve fotoğraflı sonuç bir sonraki aşamada bağlanacak.
                  </p>
                  {active ? (
                    <div className="institution-prepared-order">
                      <span className="institution-stage accepted">
                        Görev emri hazır · Saha teslimi bekliyor
                      </span>
                      <strong>
                        {
                          profile.teams.find((t) => t.id === active.teamId)
                            ?.name
                        }
                      </strong>
                      <p>{active.instruction}</p>
                      <small>
                        {dateText(active.createdAt)} ·{" "}
                        {priorities[active.priority]}
                      </small>
                      <label className="field">
                        İptal gerekçesi
                        <textarea
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          maxLength={2000}
                          placeholder="Hazır görevi neden iptal ediyorsunuz?"
                        />
                      </label>
                      <Button
                        variant="secondary"
                        disabled={busy || reason.trim().length < 5}
                        onClick={() =>
                          void run(
                            {
                              type: "cancel-order",
                              id: item.id,
                              orderId: active.id,
                              body: reason,
                            },
                            "Görev emri iptal edildi.",
                          )
                        }
                      >
                        Hazır görevi iptal et
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="institution-form-pair">
                        <label className="field">
                          Hedef ekip
                          <select
                            value={teamId}
                            onChange={(e) => setTeam(e.target.value)}
                          >
                            {profile.teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Görev önceliği
                          <select
                            value={priority}
                            onChange={(e) =>
                              setPriority(
                                e.target.value as InstitutionOrder["priority"],
                              )
                            }
                          >
                            {Object.entries(priorities).map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="field">
                        Ekipten istenen işlem
                        <textarea
                          rows={4}
                          value={instruction}
                          maxLength={2000}
                          onChange={(e) => setInstruction(e.target.value)}
                          placeholder="Kontrol edilecek nokta, yapılması istenen işlem ve saha notları…"
                        />
                      </label>
                      <Button
                        icon="work"
                        disabled={busy || instruction.trim().length < 10}
                        onClick={() =>
                          void run(
                            {
                              type: "order",
                              id: item.id,
                              teamId,
                              instruction,
                              priority,
                            },
                            "Görev emri kaydedildi. Saha uygulamasına teslim henüz yapılmadı.",
                          )
                        }
                      >
                        Görev emrini hazırla
                      </Button>
                    </>
                  )}
                </section>
                <section className="form-section">
                  <h3>Açıklama veya kurum notu</h3>
                  <label className="field">
                    Kim görecek?
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                    >
                      <option value="note">Kurum ve merkez arasında not</option>
                      <option value="citizen">Talep sahibine yanıt</option>
                      {item.shared && (
                        <option value="participants">
                          Talep sahibi ve katılan herkese
                        </option>
                      )}
                    </select>
                  </label>
                  <label className="field">
                    Açıklama
                    <textarea
                      rows={3}
                      value={body}
                      maxLength={2000}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={
                        audience === "note"
                          ? "Yalnız kurum ve merkezde kalacak ayrıntılar…"
                          : "Vatandaşın göreceği açıklama…"
                      }
                    />
                  </label>
                  <Button
                    variant="secondary"
                    disabled={busy || body.trim().length < 5}
                    onClick={() =>
                      void run(
                        {
                          type: audience === "note" ? "note" : "message",
                          id: item.id,
                          body,
                          ...(audience === "note" ? {} : { audience }),
                        },
                        audience === "note"
                          ? "Kurum notu kaydedildi."
                          : "Vatandaşa açıklama iletildi.",
                      )
                    }
                  >
                    Açıklamayı kaydet
                  </Button>
                </section>
                <section className="form-section institution-return">
                  <h3>Merkeze geri gönder</h3>
                  <p className="field-note">
                    Yetki alanınıza girmiyorsa veya ek bilgi gerekiyorsa
                    gerekçeyi yazın. Hazır görev varsa iptal edilir.
                  </p>
                  <label className="field">
                    İade gerekçesi
                    <textarea
                      rows={2}
                      value={reason}
                      maxLength={2000}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    disabled={busy || reason.trim().length < 5}
                    onClick={() =>
                      void run(
                        { type: "return", id: item.id, body: reason },
                        "Talep gerekçesiyle merkeze iade edildi.",
                      )
                    }
                  >
                    Merkeze iade et
                  </Button>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
