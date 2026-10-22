import { useEffect, useState } from "react";
import { api, serviceReady } from "../api";
import {
  categoryFor,
  categories,
  dateText,
  publicAreas,
  statusNames,
  type CategoryId,
  type Point,
  type SharedIssue,
} from "../domain";
import { useStore } from "../store";
import { useNav } from "../navigation";
import { currentLocation } from "../native";
import { LocationMap } from "../Map";
import { Button, Empty, Icon, Message, Sheet } from "../ui";

export function SharedCard({ item }: { item: SharedIssue }) {
  const nav = useNav(),
    category = categoryFor(item.category);
  return (
    <button
      className="shared-card"
      disabled={!item.available}
      onClick={() => nav.go({ name: "shared-detail", id: item.id })}
    >
      <div className="shared-card-heading">
        <span
          className="category-icon"
          style={{ background: category.bg, color: category.color }}
        >
          <Icon name={category.icon} />
        </span>
        <div>
          <strong>{item.title}</strong>
          <small>
            {item.available ? item.area : "Artık paylaşılmıyor"}
            {item.distanceKm !== undefined
              ? ` · Yaklaşık ${item.distanceKm} km`
              : ""}
          </small>
        </div>
        <Icon name="chevron" size={18} />
      </div>
      <div className="shared-card-labels">
        <span>
          {item.needsReview
            ? "Sorunun sürdüğü bildirildi"
            : item.verification === "unverified"
              ? "Henüz doğrulanmadı"
              : statusNames[item.status]}
        </span>
        <span>{item.participantCount} hesap katılıyor</span>
      </div>
      <small>
        {dateText(item.createdAt, true)}
        {item.joined ? " · Katıldın" : item.own ? " · Sen bildirdin" : ""}
      </small>
    </button>
  );
}
export function Nearby({
  category: initialCategory,
  onNew,
}: {
  category?: CategoryId;
  onNew: () => void;
}) {
  const store = useStore();
  const [category, setCategory] = useState(initialCategory ?? ""),
    [area, setArea] = useState("Oltu"),
    [point, setPoint] = useState<Point | null>(null),
    [mapOpen, setMapOpen] = useState(false),
    [mapPoint, setMapPoint] = useState<Point | null>(null);
  const [items, setItems] = useState<SharedIssue[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [gpsBusy, setGpsBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ area });
    if (category) query.set("category", category);
    if (point) {
      query.set("latitude", String(point.latitude));
      query.set("longitude", String(point.longitude));
    }
    void (async () => {
      setLoading(true);
      setError("");
      setItems([]);
      try {
        if (!serviceReady)
          throw new Error(
            "Yakındaki bildirimler için hizmet bağlantısı gerekiyor.",
          );
        const result = await api.community(query);
        if (active) setItems(result.items);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Bildirimler alınamadı.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [area, category, point, reload, store.profile?.id]);
  async function locate() {
    setGpsBusy(true);
    try {
      setPoint(await currentLocation());
      setArea("Oltu");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Konum alınamadı. Bölge seçerek devam edebilirsin.",
      );
    } finally {
      setGpsBusy(false);
    }
  }
  return (
    <div className="page nearby-page">
      <span className="eyebrow">AYNI SORUN, ORTAK TAKİP</span>
      <h1>Yakınında bildirilen sorunlar</h1>
      <p className="page-description">
        Önce bir göz at. Aynı sorun seni de etkiliyorsa mevcut bildirime katıl.
      </p>
      <details className="nearby-location-picker">
        <summary className="nearby-location">
          <Icon name="pin" />
          <div>
            <strong>
              {point
                ? "Seçtiğin konumun çevresi"
                : area === "Oltu"
                  ? "Oltu · Erzurum"
                  : `${area} · Oltu`}
            </strong>
            <small>
              {point
                ? "5 km çevresi · Bölge ve türü değiştir"
                : `${category ? categories.find((c) => c.id === category)?.name : "Tüm sorunlar"} · Bölge ve türü değiştir`}
            </small>
          </div>
          <Icon name="chevron" size={18} />
        </summary>
        <div className="nearby-controls">
          <Button
            variant="secondary"
            icon="pin"
            busy={gpsBusy}
            onClick={() => void locate()}
          >
            Konumumu kullan
          </Button>
          <Button
            variant="ghost"
            icon="pin"
            onClick={() => {
              setMapPoint(point);
              setMapOpen(true);
            }}
          >
            Haritadan bölge seç
          </Button>
        </div>
        <div className="nearby-filters">
          <label className="field">
            <span>Bölge</span>
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setPoint(null);
              }}
            >
              {publicAreas.map((a) => (
                <option key={a} value={a}>
                  {a === "Oltu" ? "Oltu geneli" : a}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sorun türü</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Tüm sorunlar</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <div className="nearby-new">
        <Button icon="plus" onClick={onNew}>
          Farklı bir sorun bildir
        </Button>
        <small>Listede yoksa yeni bildirim açabilirsin.</small>
      </div>
      <div className="section-heading">
        <h2>Mevcut bildirimler</h2>
        <button
          className="icon-button"
          aria-label="Yakındaki sorunları yenile"
          onClick={() => setReload((v) => v + 1)}
        >
          <Icon name="refresh" />
        </button>
      </div>
      {error && <Message error>{error}</Message>}
      {loading ? (
        <p role="status">Yakındaki bildirimler yükleniyor…</p>
      ) : items.length ? (
        <div className="shared-list">
          {items.map((item) => (
            <SharedCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        !error && (
          <Empty
            title="Bu bölgede açık bildirim yok."
            body="Yeni bir sorun bildirebilir veya başka bir bölgeye bakabilirsin."
            icon="pin"
          />
        )
      )}
      <p className="field-note">
        Yalnız paylaşımına izin verilen gerçek kayıtlar gösterilir. Konum
        yaklaşık gösterilir; isim, özel açıklama ve fotoğraflar paylaşılmaz.
      </p>
      {mapOpen && (
        <Sheet title="Hangi bölgeye bakalım?" onClose={() => setMapOpen(false)}>
          <LocationMap point={mapPoint} onChange={setMapPoint} />
          <Button
            disabled={!mapPoint}
            onClick={() => {
              setPoint(mapPoint);
              setArea("Oltu");
              setMapOpen(false);
            }}
          >
            Bu bölgede ara
          </Button>
        </Sheet>
      )}
    </div>
  );
}
export function SharedDetail({ id }: { id: string }) {
  const store = useStore(),
    nav = useNav();
  const [item, setItem] = useState<SharedIssue | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void api
      .sharedIssue(id)
      .then((data) => {
        if (active) {
          setItem(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setItem(null);
          setError(e instanceof Error ? e.message : "Bildirim alınamadı.");
        }
      });
    return () => {
      active = false;
    };
  }, [id, reload, store.profile?.id, store.workspace]);
  async function join() {
    if (!store.profile) {
      nav.go({ name: "auth" });
      return;
    }
    if (!item) return;
    setBusy(true);
    try {
      await api.subscribe(id, !item.joined, store.profile.id);
      await store.refresh();
      setReload((v) => v + 1);
      nav.toast(
        item.joined
          ? "Bildirimden ayrıldın."
          : "Bildirime katıldın. Gelişmeler Kayıtlarım’da.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page shared-detail">
      {error && <Message error>{error}</Message>}
      {item && (
        <>
          <span className="eyebrow">ORTAK SORUN BİLDİRİMİ</span>
          <h1>{item.title}</h1>
          <p className="page-description">
            {item.area} · {dateText(item.createdAt, true)}
          </p>
          <span className={`status ${item.status}`}>
            {item.verification === "unverified"
              ? "Henüz doğrulanmadı"
              : statusNames[item.status]}
          </span>
          <p>
            {item.participantCount} hesap bu sorundan etkilendiğini belirtiyor.
          </p>
          {item.point ? (
            <LocationMap
              interactive={false}
              point={{
                ...item.point,
                address: "Yaklaşık konum",
                source: "map",
              }}
            />
          ) : (
            <Message>
              Bu kayıt için harita noktası paylaşılmamış; bölge bilgisi
              gösteriliyor.
            </Message>
          )}
          <p className="field-note">
            Gösterilen konum yaklaşıktır. Bildirenin kişisel bilgileri, özel
            açıklaması ve fotoğrafları paylaşılmaz.
          </p>
          {item.own ? (
            <Button variant="secondary" onClick={() => nav.tab("reports")}>
              Senin bildirimin · Kayıtlarıma git
            </Button>
          ) : (
            <Button
              busy={busy}
              disabled={
                !item.joined &&
                ["resolved", "closed"].includes(item.status) &&
                !item.needsReview
              }
              variant={item.joined ? "secondary" : "primary"}
              icon={item.joined ? "check" : "plus"}
              onClick={() => void join()}
            >
              {item.joined
                ? "Katıldın · Takibi bırak"
                : ["resolved", "closed"].includes(item.status) &&
                    !item.needsReview
                  ? "Bu sorun tamamlandı"
                  : "Ben de etkileniyorum"}
            </Button>
          )}
          <p className="field-note">
            Katılınca bu bildirim Kayıtlarım → Katıldıklarım altında görünür.
            Kurumun ortak açıklamaları ve durum değişiklikleri Güncellemeler’e
            gelir.
          </p>
          <section className="content-card">
            <h2>Ortak gelişmeler</h2>
            {item.events?.length ? (
              item.events.map((e) => (
                <div className="shared-event" key={e.id}>
                  <small>{dateText(e.createdAt, true)}</small>
                  <p>{e.body}</p>
                </div>
              ))
            ) : (
              <p className="muted">
                Henüz ortak açıklama yok. Bu kayıt bir vatandaş bildirimidir;
                kurumun çalışmaya başladığı anlamına gelmez.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
export function JoinedIssues() {
  const store = useStore(),
    [error, setError] = useState("");
  const items = store.workspace?.subscriptions ?? [];
  return (
    <>
      <p className="page-description">
        Katıldığın ortak sorunların son durumunu burada takip edebilirsin.
      </p>
      {error && <Message error>{error}</Message>}
      {items.length ? (
        <div className="shared-list">
          {items.map((item) => (
            <div key={item.id}>
              <SharedCard item={item} />
              {!item.available && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (store.profile)
                      void api
                        .subscribe(item.id, false, store.profile.id)
                        .then(() => store.refresh())
                        .catch((e) => setError(e.message));
                  }}
                >
                  Takibi bırak
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Henüz bir bildirime katılmadın."
          body="Bildir bölümünden yakınındaki bir soruna katılabilirsin."
          icon="pin"
        />
      )}
    </>
  );
}
export function ShareReport({
  report,
}: {
  report: import("../domain").Report;
}) {
  const store = useStore();
  const [area, setArea] = useState(report.publicArea ?? "Oltu"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function share() {
    if (!store.profile) return;
    setBusy(true);
    try {
      await api.share(report.id, !report.sharePublicly, area, store.profile.id);
      await store.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paylaşım değiştirilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card sharing-card">
      <h2>Yakındaki sorunlarda paylaşım</h2>
      <p>
        Yalnız sorun türü, bölge ve yaklaşık konum görünür. İsmin, açıklaman,
        fotoğrafların ve sana özel yanıtlar paylaşılmaz.
      </p>
      {!report.sharePublicly && (
        <label className="field">
          <span>Paylaşılacak bölge</span>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            {publicAreas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      )}
      {error && <Message error>{error}</Message>}
      <Button busy={busy} variant="secondary" onClick={() => void share()}>
        {report.sharePublicly
          ? "Paylaşımı kapat"
          : "Yakındaki sorunlarda paylaş"}
      </Button>
    </section>
  );
}
