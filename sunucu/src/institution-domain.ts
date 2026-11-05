export const institutionProfiles = [
  {
    id: "public-works",
    slug: "yol-isleri",
    name: "Yol ve Fen İşleri",
    short: "Yol işleri",
    icon: "road",
    color: "#bd7347",
    description: "Yol, kaldırım, buzlanma ve erişilebilir geçiş talepleri.",
    teams: [
      { id: "fen-yol", name: "Yol bakım ekibi" },
      { id: "fen-kis", name: "Kış bakım ekibi" },
    ],
  },
  {
    id: "electricity-external",
    slug: "elektrik",
    name: "Elektrik Dağıtımı",
    short: "Elektrik",
    icon: "zap",
    color: "#a98235",
    description: "Elektrik kesintisi ve şebeke arızası bildirimleri.",
    teams: [
      { id: "elektrik-ariza", name: "Elektrik arıza ekibi" },
      { id: "elektrik-bakim", name: "Şebeke bakım ekibi" },
      { id: "elektrik-trafo", name: "Trafo müdahale ekibi" },
    ],
  },
  {
    id: "water",
    slug: "su",
    name: "Su ve Kanalizasyon",
    short: "Su işleri",
    icon: "water",
    color: "#4f8ca9",
    description: "Su kesintisi, şebeke ve kanalizasyon talepleri.",
    teams: [
      { id: "su-ariza", name: "Su arıza ekibi" },
      { id: "su-kanal", name: "Kanalizasyon ekibi" },
    ],
  },
  {
    id: "cleaning",
    slug: "temizlik",
    name: "Temizlik İşleri",
    short: "Temizlik",
    icon: "trash",
    color: "#5a8771",
    description: "Çöp birikmesi ve bölge temizliği bildirimleri.",
    teams: [
      { id: "temizlik-toplama", name: "Atık toplama ekibi" },
      { id: "temizlik-bolge", name: "Bölge temizlik ekibi" },
    ],
  },
  {
    id: "parks",
    slug: "parklar",
    name: "Park ve Ortak Alanlar",
    short: "Parklar",
    icon: "tree",
    color: "#71864c",
    description: "Park, yeşil alan ve ortak alan düzenlemeleri.",
    teams: [
      { id: "park-bakim", name: "Park bakım ekibi" },
      { id: "park-duzenleme", name: "Ortak alan ekibi" },
    ],
  },
] as const;
export type InstitutionProfile = (typeof institutionProfiles)[number];
export type InstitutionDelivery = {
  id: string;
  unitId: string;
  state: "queued" | "accepted" | "returned";
  instruction: string;
  returnReason?: string;
  createdAt: string;
  acceptedAt?: string;
  updatedAt: string;
  preparedCount: number;
  events?: { id: string; kind: string; body: string; createdAt: string }[];
};
export type InstitutionOrder = {
  id: string;
  teamId: string;
  instruction: string;
  priority: "low" | "normal" | "high" | "urgent";
  state: "prepared" | "cancelled";
  createdAt: string;
};
export type InstitutionCase = {
  id: string;
  reference: string;
  category: string;
  title: string;
  description: string;
  address: string;
  neighborhood: string;
  status: string;
  shared: boolean;
  actionable: boolean;
  priority: InstitutionOrder["priority"];
  createdAt: string;
  point?: [number, number];
  photos: { id: string; uri: string }[];
  delivery: InstitutionDelivery;
  orders: InstitutionOrder[];
  events: { id: string; kind: string; body: string; createdAt: string }[];
};
export const deliveryNames = {
  queued: "Yeni gönderim",
  accepted: "Kurum incelemesinde",
  returned: "Merkeze iade edildi",
} as const;
