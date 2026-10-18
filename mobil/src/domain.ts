export const categories = [
  {
    id: "electricity",
    name: "Elektrik kesintisi",
    short: "Elektrik",
    icon: "zap",
    color: "#c47a12",
    bg: "#fff5df",
    hint: "Kesinti ne zaman başladı? Binanı mı, sokağını mı etkiliyor?",
  },
  {
    id: "water",
    name: "Su kesintisi",
    short: "Su",
    icon: "droplet",
    color: "#147dcc",
    bg: "#eaf4ff",
    hint: "Suyun ne zamandır kesik? Yakındaki binalar da etkileniyor mu?",
  },
  {
    id: "waste",
    name: "Çöp birikmesi",
    short: "Temizlik",
    icon: "trash",
    color: "#278654",
    bg: "#eaf6ef",
    hint: "Çöpün biriktiği yeri ve ne zamandır orada olduğunu anlat.",
  },
  {
    id: "road",
    name: "Yol hasarı",
    short: "Yol hasarı",
    icon: "road",
    color: "#be653c",
    bg: "#fff0e8",
    hint: "Çukur, çatlak veya hasarı tarif et. Yakındaki bir noktayı da belirtebilirsin.",
  },
  {
    id: "ice",
    name: "Buzlanma",
    short: "Buzlanma",
    icon: "snow",
    color: "#6e76bc",
    bg: "#f0efff",
    hint: "Buzlanmayı nerede ve ne zaman gözlemledin?",
  },
] as const;
export const improvementCategories = [
  {
    id: "pavement",
    name: "Kaldırım düzenlemesi",
    short: "Kaldırım",
    icon: "road",
    color: "#b56c39",
    bg: "#fff0e8",
    hint: "Nerede kaldırım gerekiyor? Günlük ulaşımını nasıl etkiliyor?",
  },
  {
    id: "lighting",
    name: "Aydınlatma isteği",
    short: "Aydınlatma",
    icon: "zap",
    color: "#b78018",
    bg: "#fff5df",
    hint: "Aydınlatma gereken yeri ve yaşanan güçlüğü anlat.",
  },
  {
    id: "accessibility",
    name: "Erişilebilirlik düzenlemesi",
    short: "Erişilebilirlik",
    icon: "accessibility",
    color: "#576bb5",
    bg: "#efefff",
    hint: "Rampa, hissedilebilir yüzey veya geçiş ihtiyacını anlat.",
  },
  {
    id: "park",
    name: "Park ve ortak alan",
    short: "Ortak alan",
    icon: "tree",
    color: "#278654",
    bg: "#eaf6ef",
    hint: "Ortak alan için ne öneriyorsun? Kimlerin kullanımını kolaylaştırır?",
  },
] as const;
export const allCategories = [...categories, ...improvementCategories];
export type RequestKind = "issue" | "improvement";
export type CategoryId = (typeof allCategories)[number]["id"];
export type Point = {
  latitude: number;
  longitude: number;
  address: string;
  source: "gps" | "map";
  accuracy?: number;
};
export type ReportLocation = Point | { source: "manual"; address: string };
export type Photo = { id: string; uri: string; width: number; height: number };
export type Draft = {
  requestId: string;
  kind?: RequestKind;
  impacts?: string[];
  category: CategoryId | null;
  description: string;
  location: ReportLocation | null;
  manualAddress?: string;
  photos: Photo[];
  updatedAt: string;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  neighborhood: string;
  homeLocation?: Point;
  createdAt: string;
};
export type Status =
  | "submitted"
  | "in_review"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "withdrawn";
export type Report = Omit<Draft, "category" | "location" | "updatedAt"> & {
  id: string;
  ownerId: string;
  reference: string;
  category: CategoryId;
  location: ReportLocation;
  status: Status;
  createdAt: string;
  notes: { id: string; text: string; createdAt: string }[];
  events: { id: string; status: Status; body: string; createdAt: string }[];
  resolution?: { body: string; photos: Photo[]; completedAt: string };
  feedback?: {
    outcome: "solved" | "persists";
    text: string;
    createdAt: string;
  };
  feedbackHistory?: {
    outcome: "solved" | "persists";
    text: string;
    createdAt: string;
  }[];
};
export type InboxItem = {
  id: string;
  title: string;
  body: string;
  reportId?: string;
  createdAt: string;
  read: boolean;
};
export type Workspace = {
  sessionId: string;
  profiles: Profile[];
  reports: Report[];
  inbox: InboxItem[];
};
export const statusNames: Record<Status, string> = {
  submitted: "Kaydedildi",
  in_review: "İnceleniyor",
  assigned: "Ekibe iletildi",
  in_progress: "Çalışma sürüyor",
  resolved: "Çözüm bildirildi",
  closed: "Tamamlandı",
  withdrawn: "Geri çekildi",
};
export const freshDraft = (
  category: CategoryId | null = null,
  kind: RequestKind = "issue",
): Draft => ({
  requestId: crypto.randomUUID(),
  kind,
  impacts: [],
  category,
  description: "",
  location: null,
  photos: [],
  updatedAt: new Date().toISOString(),
});
export function validPoint(point: ReportLocation | null): point is Point {
  return (
    !!point &&
    point.source !== "manual" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}
export function validLocation(location: ReportLocation | null): boolean {
  return (
    validPoint(location) ||
    (!!location &&
      location.source === "manual" &&
      location.address.trim().length >= 10 &&
      location.address.length <= 500)
  );
}
export function draftError(draft: Draft) {
  if (
    !(draft.kind === "improvement" ? improvementCategories : categories).some(
      (c) => c.id === draft.category,
    )
  )
    return "Lütfen bir sorun türü seç.";
  if (draft.description.trim().length < 15)
    return "Sorunu en az 15 karakterle anlat.";
  if (draft.description.length > 2000)
    return "Açıklama en fazla 2.000 karakter olabilir.";
  if (!validLocation(draft.location))
    return draft.location?.source === "manual"
      ? "Açık adresi en az 10 karakterle yaz."
      : "Haritadan konum seç veya adresi elle yaz.";
  if (draft.photos.length > 3) return "En fazla 3 fotoğraf ekleyebilirsin.";
  return null;
}
export const categoryFor = (id: CategoryId) =>
  allCategories.find((c) => c.id === id)!;
export const isCompleted = (report: Pick<Report, "status" | "feedback">) =>
  ["resolved", "closed"].includes(report.status) &&
  report.feedback?.outcome !== "persists";
export const isOngoing = (report: Pick<Report, "status" | "feedback">) =>
  report.status !== "withdrawn" && !isCompleted(report);
export const completionTime = (report: Report) =>
  report.resolution?.completedAt ??
  [...report.events]
    .reverse()
    .find((event) => ["resolved", "closed"].includes(event.status))
    ?.createdAt ??
  report.createdAt;
export const dateText = (date: string, time = false) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(date));
