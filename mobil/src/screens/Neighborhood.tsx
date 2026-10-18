import { useState } from "react";
import {
  communityExamples,
  useCommunity,
  type CommunityItem,
} from "../community";
import { categoryFor } from "../domain";
import { useNav } from "../navigation";
import { useStore } from "../store";
import { Button, Empty, Icon, Message, Sheet } from "../ui";

export function ExampleNotice() {
  return (
    <div className="example-notice">
      <Icon name="info" size={15} />
      <span>
        <strong>Örnek mahalle içeriği</strong> · Canlı kurum verisi değildir.
      </span>
    </div>
  );
}
export function AreaPicker() {
  const community = useCommunity(),
    { profile, workspace } = useStore();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState("");
  const recentPlace = workspace?.reports.find(
    (report) => report.location.address,
  )?.location.address;
  const label = community.area || profile?.neighborhood || recentPlace;
  return (
    <>
      <button
        className="area-picker"
        onClick={() => {
          setValue(label ?? "");
          setOpen(true);
        }}
        aria-label="Bölgeni değiştir"
      >
        <span className="area-pin">
          <Icon name="pin" size={20} />
        </span>
        <span>
          <small>
            {community.area || profile?.neighborhood
              ? "SEÇİLİ BÖLGEN"
              : recentPlace
                ? "SON BİLDİRDİĞİN YER"
                : "YAŞADIĞIN YER"}
          </small>
          <strong>{label || "Bölgeni seç"}</strong>
        </span>
        <Icon name="down" size={17} />
      </button>
      {open && (
        <Sheet
          title="Hangi bölgeyi takip ediyorsun?"
          onClose={() => setOpen(false)}
        >
          <p className="muted">
            Mahalleni veya takip etmek istediğin yeri yaz. Bu seçim ev adresin
            olarak kaydedilmez.
          </p>
          <label className="field">
            <span>Mahalle veya bölge</span>
            <input
              maxLength={120}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Örn. Cumhuriyet Mahallesi"
            />
          </label>
          <Button
            onClick={() => {
              community.change({ area: value.trim() });
              setOpen(false);
            }}
          >
            Bölgeyi kaydet
          </Button>
          <p className="field-note">
            Canlı bölge yayını henüz bağlı değil. Örnek içerikler seçtiğin
            bölgeye ait gerçek duyurular değildir.
          </p>
        </Sheet>
      )}
    </>
  );
}
export function CommunityCard({ item }: { item: CommunityItem }) {
  const nav = useNav(),
    community = useCommunity(),
    category = categoryFor(item.category);
  const following = community.follows.includes(item.id);
  return (
    <button
      className={`community-card ${item.type}`}
      onClick={() => nav.go({ name: "community-detail", id: item.id })}
    >
      <div className="community-card-top">
        <span
          className="category-icon"
          style={{ background: category.bg, color: category.color }}
        >
          <Icon name={category.icon} />
        </span>
        <span className="community-state">{item.status}</span>
        <Icon name="chevron" size={17} />
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <div className="community-card-meta">
        <span>
          <Icon name="pin" size={13} />
          {item.place.split(" · ")[1]}
        </span>
        <span>
          {following
            ? "Takip ediyorsun"
            : item.type === "proposal"
              ? `${(item.count ?? 0) + Number(community.supports.includes(item.id))} örnek destek`
              : item.type === "completed"
                ? `${item.count} ilişkili örnek talep`
                : "Son bilgi " + item.history.at(-1)?.time}
        </span>
      </div>
    </button>
  );
}
export function Neighborhood() {
  const nav = useNav(),
    community = useCommunity();
  const [filter, setFilter] = useState("incident"),
    [onlyFollowed, setOnlyFollowed] = useState(false);
  const items = community.items.filter(
    (item) =>
      item.type === filter &&
      (!onlyFollowed || community.follows.includes(item.id)),
  );
  return (
    <div className="page neighborhood-page">
      <AreaPicker />
      <div className="page-title-row">
        <h1>Mahallem</h1>
        <Icon name="building" size={27} />
      </div>
      <p className="page-description">
        Devam eden işler, ortak ihtiyaçlar ve görünen sonuçlar.
      </p>
      <div className="segmented community-tabs" aria-label="Mahalle içeriği">
        {[
          ["incident", "Aktif olaylar"],
          ["proposal", "İstekler"],
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
      <label className="follow-filter">
        <input
          type="checkbox"
          checked={onlyFollowed}
          onChange={(event) => setOnlyFollowed(event.target.checked)}
        />
        Yalnızca takip ettiklerim
      </label>
      {community.examples && <ExampleNotice />}
      {filter === "proposal" && (
        <div className="neighborhood-intro">
          <h2>Mahallende neye ihtiyaç var?</h2>
          <p>
            Bir isteği destekle, gelişmesini takip et veya yeni bir ihtiyaç
            paylaş.
          </p>
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => nav.report(undefined, false, "improvement")}
          >
            İyileştirme isteği oluştur
          </Button>
        </div>
      )}
      <div className="community-list">
        {items.map((item) => (
          <CommunityCard key={item.id} item={item} />
        ))}
      </div>
      {!items.length && (
        <Empty
          icon={filter === "completed" ? "done" : "building"}
          title={
            onlyFollowed
              ? "Bu bölümde takip ettiğin kayıt yok."
              : "Bölge yayını henüz açılmadı."
          }
          body={
            onlyFollowed
              ? "Bir kaydı açıp gelişmelerini takip edebilirsin."
              : "Kurum bağlantısı kurulduğunda bölgenin duyuruları ve çalışmaları burada yer alacak."
          }
        />
      )}
      <button
        className="sample-switch"
        onClick={() => community.change({ examples: !community.examples })}
      >
        <Icon name="eye" size={16} />
        {community.examples
          ? "Örnek içerikleri gizle"
          : "Örnek mahalle deneyimini göster"}
      </button>
      {community.storageError && (
        <Message error>{community.storageError}</Message>
      )}
    </div>
  );
}
export function OutcomeArt({ after = false }: { after?: boolean }) {
  return (
    <svg
      viewBox="0 0 240 136"
      role="img"
      aria-label={
        after
          ? "Düzenlenmiş kaldırımın temsili çizimi"
          : "Bozuk kaldırımın temsili çizimi"
      }
    >
      <rect width="240" height="136" fill={after ? "#e7f2e9" : "#e9edf2"} />
      <path d="M0 15H240V62H0Z" fill="#d2decb" />
      <path
        d="M22 14H65V62H22ZM87 4H150V62H87ZM173 22H222V62H173Z"
        fill="#a6b7b5"
      />
      <path d="M0 83L240 64V136H0Z" fill="#748793" />
      <path d="M0 69L240 52V81L0 101Z" fill={after ? "#e4dac3" : "#b8bdba"} />
      {after ? (
        <>
          <path d="M0 81L240 63" stroke="#d5aa52" strokeWidth="6" />
          <path d="M112 63L155 60L174 89L126 93Z" fill="#d8c99f" />
          <path d="M0 95L240 76" stroke="#f4eddb" strokeWidth="3" />
        </>
      ) : (
        <>
          <path
            d="M37 73L62 78L58 89M92 65L103 80L92 92M177 63L192 75L182 84"
            fill="none"
            stroke="#677b82"
            strokeWidth="4"
          />
          <ellipse cx="134" cy="79" rx="20" ry="7" fill="#8a9799" />
        </>
      )}
      <path
        d="M0 117L94 110M145 106L239 98"
        stroke="#e7e6d6"
        strokeWidth="3"
        strokeDasharray="20 12"
      />
      <circle cx="204" cy="39" r="16" fill="#769780" />
      <path d="M204 43V66" stroke="#637e65" strokeWidth="5" />
    </svg>
  );
}
export function CommunityDetail({ id }: { id: string }) {
  const community = useCommunity(),
    nav = useNav();
  const item = community.examples
    ? communityExamples.find((value) => value.id === id)
    : undefined;
  if (!item)
    return (
      <div className="page">
        <Empty
          title="Bu örnek içerik kapalı."
          body="Mahallem bölümünden örnek deneyimi açabilirsin."
        >
          <Button onClick={() => nav.tab("neighborhood")}>Mahalleme dön</Button>
        </Empty>
      </div>
    );
  const following = community.follows.includes(id),
    supported = community.supports.includes(id);
  const category = categoryFor(item.category);
  return (
    <div className="page community-detail">
      <ExampleNotice />
      <span
        className="category-icon"
        style={{ background: category.bg, color: category.color }}
      >
        <Icon name={category.icon} size={27} />
      </span>
      <span className="eyebrow">
        {item.type === "incident"
          ? "BÖLGEDEKİ GELİŞME"
          : item.type === "proposal"
            ? "ORTAK İHTİYAÇ"
            : "TAMAMLANAN ÇALIŞMA"}
      </span>
      <h1>{item.title}</h1>
      <p className="community-place">
        <Icon name="pin" size={16} />
        {item.place}
      </p>
      <span
        className={`status ${item.type === "completed" ? "closed" : "in_progress"}`}
      >
        {item.status}
      </span>
      <section className="content-card">
        <h2>{item.type === "completed" ? "Ne değişti?" : "Son açıklama"}</h2>
        <p>{item.summary}</p>
        <div className="impact-label">
          <Icon name="support" size={19} />
          <span>{item.impact}</span>
        </div>
      </section>
      {item.type === "completed" && (
        <section className="content-card">
          <h2>Öncesi ve sonrası</h2>
          <div className="outcome-pair">
            <figure>
              <OutcomeArt />
              <figcaption>Önce</figcaption>
            </figure>
            <figure>
              <OutcomeArt after />
              <figcaption>Sonra</figcaption>
            </figure>
          </div>
          <p className="field-note">
            Temsili çizimlerdir. Canlı kullanımda kurumun çalışma fotoğrafları
            gösterilecek.
          </p>
          <div className="outcome-fact">
            <strong>{item.count}</strong>
            <span>örnek talebin ihtiyacını karşılayan bir çalışma</span>
          </div>
        </section>
      )}
      <section className="content-card">
        <h2>{item.type === "proposal" ? "İsteğin gelişimi" : "Gelişmeler"}</h2>
        <ol className="timeline">
          {item.history.map((event, index) => (
            <li
              key={event.title}
              className={index === item.history.length - 1 ? "latest" : ""}
            >
              <span className="timeline-dot">
                <Icon name="check" size={12} />
              </span>
              <div>
                <strong>{event.title}</strong>
                <p>{event.body}</p>
                <small>{event.time} · Örnek akış</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {item.type !== "completed" && (
        <section className="content-card">
          <h2>
            {item.type === "incident"
              ? "Bu durum seni de etkiliyor mu?"
              : "Bu ihtiyacı sen de paylaşıyor musun?"}
          </h2>
          <p>
            {item.type === "incident"
              ? "Aynı olay için yeni kayıt açmadan gelişmeleri takip et."
              : "Destek sayısı ihtiyacı görünür kılar. Yapılacak çalışmaya ve zamanına kurum karar verir."}
          </p>
          <Button
            variant={supported ? "secondary" : "primary"}
            icon={supported ? "check" : "support"}
            onClick={() => {
              community.change({
                supports: supported
                  ? community.supports.filter((value) => value !== id)
                  : [...community.supports, id],
                follows:
                  !following && !supported
                    ? [...community.follows, id]
                    : community.follows,
              });
              nav.toast(
                supported
                  ? "Örnek desteğin kaldırıldı."
                  : "Örnek desteğin bu cihazda kaydedildi.",
              );
            }}
          >
            {supported
              ? "Desteğini geri al"
              : item.type === "incident"
                ? "Ben de etkileniyorum"
                : "Bu isteği destekle"}
          </Button>
          <Button
            variant="ghost"
            icon="bell"
            onClick={() => community.toggle("follows", id)}
          >
            {following ? "Takibi bırak" : "Gelişmeleri takip et"}
          </Button>
          <p className="field-note">
            Örnek destek ve takip tercihlerin yalnızca bu cihazda saklanır.
            Kuruma iletilmez; bildirim gönderilmez.
          </p>
        </section>
      )}
      {community.storageError && (
        <Message error>{community.storageError}</Message>
      )}
    </div>
  );
}
