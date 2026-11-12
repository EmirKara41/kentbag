import type { CategoryId, InstitutionId, Point, RequestKind } from "./types.ts";

export const categories: Record<
  CategoryId,
  { name: string; kind: RequestKind; institution: InstitutionId; defaultMinutes: number }
> = {
  electricity: { name: "Elektrik kesintisi", kind: "issue", institution: "electricity", defaultMinutes: 60 },
  water: { name: "Su kesintisi", kind: "issue", institution: "water", defaultMinutes: 90 },
  waste: { name: "Çöp birikmesi", kind: "issue", institution: "cleaning", defaultMinutes: 30 },
  road: { name: "Yol hasarı", kind: "issue", institution: "public-works", defaultMinutes: 120 },
  ice: { name: "Buzlanma", kind: "issue", institution: "public-works", defaultMinutes: 45 },
  lighting: { name: "Aydınlatma", kind: "improvement", institution: "electricity", defaultMinutes: 60 },
  pavement: { name: "Kaldırım", kind: "improvement", institution: "public-works", defaultMinutes: 120 },
  accessibility: { name: "Erişilebilirlik", kind: "improvement", institution: "public-works", defaultMinutes: 120 },
  park: { name: "Park ve ortak alan", kind: "improvement", institution: "parks", defaultMinutes: 90 },
};

export const institutions: Record<
  InstitutionId,
  { name: string; dative: string; teams: { id: string; name: string }[] }
> = {
  electricity: {
    name: "Elektrik Dağıtımı",
    dative: "Elektrik Dağıtımı'na",
    teams: [
      { id: "elk-ariza", name: "Elektrik arıza ekibi" },
      { id: "elk-bakim", name: "Şebeke bakım ekibi" },
      { id: "elk-trafo", name: "Trafo müdahale ekibi" },
    ],
  },
  water: {
    name: "Su ve Kanalizasyon",
    dative: "Su ve Kanalizasyon'a",
    teams: [
      { id: "su-ariza", name: "Su arıza ekibi" },
      { id: "su-kanal", name: "Kanalizasyon ekibi" },
    ],
  },
  cleaning: {
    name: "Temizlik İşleri",
    dative: "Temizlik İşleri'ne",
    teams: [
      { id: "tmz-toplama", name: "Atık toplama ekibi" },
      { id: "tmz-bolge", name: "Bölge temizlik ekibi" },
    ],
  },
  "public-works": {
    name: "Yol ve Fen İşleri",
    dative: "Yol ve Fen İşleri'ne",
    teams: [
      { id: "fen-yol", name: "Yol bakım ekibi" },
      { id: "fen-kis", name: "Kış bakım ekibi" },
    ],
  },
  parks: {
    name: "Park ve Bahçeler",
    dative: "Park ve Bahçeler'e",
    teams: [
      { id: "prk-bakim", name: "Park bakım ekibi" },
      { id: "prk-alan", name: "Ortak alan ekibi" },
    ],
  },
};

export const institutionIds = Object.keys(institutions) as InstitutionId[];

export function institutionFor(category: CategoryId): InstitutionId {
  return categories[category].institution;
}

export function teamById(teamId: string) {
  for (const id of institutionIds) {
    const team = institutions[id].teams.find((t) => t.id === teamId);
    if (team) return { ...team, institution: id };
  }
  return null;
}

export const oltuCenter: Point = { lat: 40.545, lng: 41.993 };

// Demo neighbourhood list for Oltu; citizens can still type any address.
export const oltuNeighborhoods = [
  "Cumhuriyet",
  "Ayyıldız",
  "Aslanpaşa",
  "Karabekir",
  "Halitpaşa",
  "Yeni",
  "Çarşı",
  "Gazi",
  "Kale",
  "İstasyon",
];
