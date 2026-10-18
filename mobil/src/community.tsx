import { createContext, useContext, useState, type ReactNode } from "react";
import {
  validPoint,
  type CategoryId,
  type Point,
  type ReportLocation,
} from "./domain";

export type CommunityItem = {
  id: string;
  type: "incident" | "proposal" | "completed";
  category: CategoryId;
  title: string;
  place: string;
  status: string;
  summary: string;
  impact: string;
  count?: number;
  latitude: number;
  longitude: number;
  history: { time: string; title: string; body: string }[];
};
// Presentation fixtures only. Never merged into a citizen's workspace or sent to the API.
export const communityExamples: CommunityItem[] = [
  {
    id: "sample-water",
    type: "incident",
    category: "water",
    title: "Şebeke arızası nedeniyle su kesintisi",
    place: "Cumhuriyet Mah. · Çınar Sokak ve çevresi",
    status: "Çalışma sürüyor",
    summary:
      "Ana borudaki arızanın giderilmesi için çalışma yapılıyor. Tahmini bitiş: 17.00.",
    impact: "Çınar, Menekşe ve Park sokakları",
    count: 48,
    latitude: 41.023,
    longitude: 29.002,
    history: [
      {
        time: "12.10",
        title: "Arıza tespit edildi",
        body: "Şebekedeki arıza nedeniyle bölgedeki su akışı durduruldu.",
      },
      {
        time: "12.40",
        title: "Ekip bölgede",
        body: "Onarım için kazı ve güvenlik hazırlıkları yapıldı.",
      },
      {
        time: "14.20",
        title: "Onarım devam ediyor",
        body: "Hasarlı boru değiştiriliyor. Tahmini bitiş 17.00; değişiklik olursa burada paylaşılacak.",
      },
    ],
  },
  {
    id: "sample-road",
    type: "incident",
    category: "road",
    title: "Okul yolunda bakım çalışması",
    place: "Cumhuriyet Mah. · Okul Caddesi",
    status: "Planlı çalışma",
    summary: "Yol yüzeyi yenilenirken tek şeritten kontrollü geçiş sağlanıyor.",
    impact: "Okul Caddesi'ni kullanan araçlar ve yayalar",
    count: 21,
    latitude: 41.025,
    longitude: 29.004,
    history: [
      {
        time: "09.00",
        title: "Çalışma başladı",
        body: "Yaya geçişi için güvenli güzergâh ayrıldı.",
      },
      {
        time: "13.30",
        title: "Yüzey yenileniyor",
        body: "Çalışmanın bugün tamamlanması planlanıyor.",
      },
    ],
  },
  {
    id: "sample-ramp",
    type: "proposal",
    category: "accessibility",
    title: "Sağlık merkezi önüne erişilebilir geçiş",
    place: "Cumhuriyet Mah. · Sağlık Sokak",
    status: "Değerlendiriliyor",
    summary:
      "Yüksek kaldırım, tekerlekli sandalye ve bebek arabası kullananların geçişini zorlaştırıyor. Uygun eğimli bir rampa isteniyor.",
    impact: "Erişilebilirlik · Sağlık hizmetine ulaşım",
    count: 24,
    latitude: 41.022,
    longitude: 29.003,
    history: [
      {
        time: "1. adım",
        title: "İhtiyaç paylaşıldı",
        body: "Vatandaşlardan gelen erişilebilir geçiş istekleri aynı başlıkta toplandı.",
      },
      {
        time: "Son durum",
        title: "Teknik değerlendirme",
        body: "Geçişin ölçüleri ve uygulanabilecek düzenleme değerlendiriliyor. Henüz yapım tarihi yok.",
      },
    ],
  },
  {
    id: "sample-light",
    type: "proposal",
    category: "lighting",
    title: "Park yoluna aydınlatma",
    place: "Cumhuriyet Mah. · Çınar Parkı bağlantısı",
    status: "Talep toplandı",
    summary:
      "Park ile durak arasındaki yürüyüş yolunun akşamları daha rahat kullanılabilmesi için aydınlatma isteniyor.",
    impact: "Yaya güvenliği · Ortak alan kullanımı",
    count: 86,
    latitude: 41.024,
    longitude: 29.006,
    history: [
      {
        time: "Son durum",
        title: "İstekler bir arada",
        body: "Benzer talepler birleştirildi. Kurumun değerlendirmesi bekleniyor; uygulama tarihi belirlenmedi.",
      },
    ],
  },
  {
    id: "sample-done",
    type: "completed",
    category: "pavement",
    title: "Durak yolundaki kaldırım yenilendi",
    place: "Cumhuriyet Mah. · Menekşe Sokak",
    status: "Tamamlandı",
    summary:
      "Bozuk yüzey düzeltildi, durak bağlantısındaki geçiş düzenlendi. Bu çalışma kaldırım ve erişilebilir geçiş taleplerini karşılıyor.",
    impact: "Kaldırım yüzeyi ve durak bağlantısında erişilebilir geçiş",
    count: 17,
    latitude: 41.021,
    longitude: 29.001,
    history: [
      {
        time: "1. adım",
        title: "Talepler bir araya getirildi",
        body: "Bozuk kaldırım ve geçiş güçlüğüyle ilgili 17 talep aynı çalışmayla ilişkilendirildi.",
      },
      {
        time: "2. adım",
        title: "Düzenleme yapıldı",
        body: "Yüzey yenilendi ve durak bağlantısındaki kot farkı giderildi.",
      },
      {
        time: "Sonuç",
        title: "Çalışma tamamlandı",
        body: "Çalışmanın karşıladığı ihtiyaçlar ve sonuç kaydı bu sayfada tutuluyor.",
      },
    ],
  },
];

type Preferences = {
  version: 1;
  area: string;
  examples: boolean;
  follows: string[];
  supports: string[];
};
const storageKey = "kent-community-preferences-v1";
function readPreferences(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (data?.version === 1)
      return {
        version: 1,
        area: typeof data.area === "string" ? data.area.slice(0, 120) : "",
        examples: data.examples !== false,
        follows: Array.isArray(data.follows)
          ? data.follows.filter(
              (id: unknown) =>
                typeof id === "string" &&
                communityExamples.some((item) => item.id === id),
            )
          : [],
        supports: Array.isArray(data.supports)
          ? data.supports.filter(
              (id: unknown) =>
                typeof id === "string" &&
                communityExamples.some((item) => item.id === id),
            )
          : [],
      };
  } catch {
    /* A damaged preference must not prevent access to the app. */
  }
  return { version: 1, area: "", examples: true, follows: [], supports: [] };
}
function useCommunityState() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [storageError, setStorageError] = useState("");
  function change(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Tercihin bu cihazda saklanamadı. Uygulama kapanınca kaybolabilir.",
      );
    }
    setPreferences(next);
  }
  function toggle(group: "follows" | "supports", id: string) {
    change({
      [group]: preferences[group].includes(id)
        ? preferences[group].filter((value) => value !== id)
        : [...preferences[group], id],
    });
  }
  return {
    ...preferences,
    storageError,
    change,
    toggle,
    items: preferences.examples ? communityExamples : [],
  };
}
const CommunityContext = createContext<ReturnType<
  typeof useCommunityState
> | null>(null);
export function CommunityProvider({ children }: { children: ReactNode }) {
  return (
    <CommunityContext.Provider value={useCommunityState()}>
      {children}
    </CommunityContext.Provider>
  );
}
export function useCommunity() {
  const value = useContext(CommunityContext);
  if (!value) throw new Error("Community provider is missing");
  return value;
}
export function nearbyIncidents(
  point: ReportLocation | null,
  category: CategoryId | null,
  items: CommunityItem[],
) {
  if (!validPoint(point) || !category) return [];
  return items.filter(
    (item) =>
      item.type === "incident" &&
      item.category === category &&
      distanceKm(point, item) < 1.5,
  );
}
function distanceKm(
  a: Pick<Point, "latitude" | "longitude">,
  b: Pick<Point, "latitude" | "longitude">,
) {
  const radians = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * radians;
  const lon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
