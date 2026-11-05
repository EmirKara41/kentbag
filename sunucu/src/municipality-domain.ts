export const categories = {
  electricity: { name: "Elektrik kesintisi", icon: "zap", color: "amber" },
  water: { name: "Su kesintisi", icon: "water", color: "blue" },
  waste: { name: "Çöp birikmesi", icon: "trash", color: "green" },
  road: { name: "Yol hasarı", icon: "road", color: "orange" },
  ice: { name: "Buzlanma", icon: "snow", color: "purple" },
  pavement: { name: "Kaldırım düzenlemesi", icon: "road", color: "orange" },
  lighting: { name: "Aydınlatma isteği", icon: "light", color: "amber" },
  accessibility: {
    name: "Erişilebilirlik",
    icon: "accessibility",
    color: "purple",
  },
  park: { name: "Park ve ortak alan", icon: "tree", color: "green" },
} as const;
export type Category = keyof typeof categories;
export type Status =
  | "submitted"
  | "in_review"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "withdrawn";
export const statuses: Record<Status, string> = {
  submitted: "Yeni talep",
  in_review: "İnceleniyor",
  assigned: "Ekibe atandı",
  in_progress: "Çalışma sürüyor",
  resolved: "Çözüm bildirildi",
  closed: "Tamamlandı",
  withdrawn: "Geri çekildi",
};
export const priorities = {
  urgent: "Acil",
  high: "Yüksek",
  normal: "Normal",
  low: "Düşük",
} as const;
export type Priority = keyof typeof priorities;
export type Event = {
  id: string;
  body: string;
  at: string;
  audience: "internal" | "citizen" | "participants";
};
export type CitizenReport = {
  fieldOrders?: import("./institution-domain.js").InstitutionOrder[];
  institutionDelivery?: import("./institution-domain.js").InstitutionDelivery;
  shared?: boolean;
  triage?: {
    source: "rules" | "gemini";
    priority: Priority;
    score: number;
    reason: string;
    assessedAt: string;
    aiState: "no_key" | "pending" | "done" | "failed";
    model?: string;
  };
  prioritySource?: "authority" | "suggestion";
  photos?: { id: string; uri: string }[];
  id: string;
  reference: string;
  title: string;
  description: string;
  category: Category;
  kind: "issue" | "improvement";
  address: string;
  neighborhood: string;
  point?: [number, number];
  citizen: string;
  supports: number;
  status: Status;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  unitId?: string;
  teamId?: string;
  incidentId?: string;
  feedback?: "solved" | "persists";
  feedbackText?: string;
  resolution?: string;
  externalRouting?: string;
  events: Event[];
};
export type Unit = {
  id: string;
  name: string;
  categories: Category[];
  external?: boolean;
};
export type Team = {
  id: string;
  name: string;
  unitId: string;
  active: boolean;
  code: string;
};
export type Announcement = {
  id: string;
  title: string;
  category: Category;
  neighborhood: string;
  body: string;
  eta: string;
  state: "draft" | "active" | "completed";
  reportIds: string[];
  updates: { body: string; at: string }[];
};
export type Work = {
  id: string;
  title: string;
  neighborhood: string;
  body: string;
  benefit: string;
  reportIds: string[];
  state: "planned" | "in_progress" | "completed";
  completedAt?: string;
};
export type PanelState = {
  version: 1;
  reports: CitizenReport[];
  teams: Team[];
  announcements: Announcement[];
  works: Work[];
  audit: { id: string; body: string; at: string }[];
};
export const units: Unit[] = [
  {
    id: "water",
    name: "ESKİ · Su ve Kanalizasyon",
    categories: ["water"],
    external: true,
  },
  {
    id: "public-works",
    name: "Fen İşleri ve İmar",
    categories: ["road", "pavement", "accessibility", "ice", "lighting"],
  },
  { id: "cleaning", name: "Temizlik İşleri", categories: ["waste"] },
  {
    id: "parks",
    name: "Park ve ortak alan koordinasyonu",
    categories: ["park", "lighting"],
  },
  {
    id: "electricity-external",
    name: "Elektrik dağıtım kurumu",
    categories: ["electricity"],
    external: true,
  },
];
export const finished = (report: CitizenReport) =>
  ["resolved", "closed"].includes(report.status) &&
  report.feedback !== "persists";
export const ongoing = (report: CitizenReport) =>
  !finished(report) && report.status !== "withdrawn";
export const needsReview = (report: CitizenReport) =>
  report.feedback === "persists" &&
  ["resolved", "closed"].includes(report.status);
export const priorityOrder: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};
export function sortQueue(reports: CitizenReport[]) {
  return [...reports].sort(
    (a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      (b.triage?.score ?? 0) - (a.triage?.score ?? 0) ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}
export const dateText = (date: string, time = true) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(date));
export function waitingText(date: string) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(date)) / 3600000),
  );
  return hours < 1
    ? "Son bir saat"
    : hours < 24
      ? `${hours} saattir`
      : `${Math.floor(hours / 24)} gündür`;
}
export function matchesQuery(report: CitizenReport, query: string) {
  return `${report.reference} ${report.title} ${report.description} ${report.address} ${report.neighborhood}`
    .toLocaleLowerCase("tr")
    .includes(query.trim().toLocaleLowerCase("tr"));
}

export type Action =
  | { type: "priority"; id: string; priority: Priority }
  | { type: "assign"; id: string; unitId: string; teamId?: string }
  | { type: "progress"; id: string }
  | {
      type: "note";
      id: string;
      body: string;
      audience: "internal" | "citizen" | "participants";
    }
  | { type: "resolve"; id: string; body: string }
  | { type: "reopen"; id: string; body: string }
  | { type: "team"; id: string; active: boolean }
  | { type: "announcement"; value: Omit<Announcement, "updates"> }
  | { type: "work"; value: Work };
function required(value: string, label: string, min = 3) {
  if (value.trim().length < min || value.length > 2000)
    throw new Error(`${label} en az ${min}, en fazla 2.000 karakter olmalı.`);
}
export function applyAction(
  state: PanelState,
  action: Action,
  now = new Date().toISOString(),
): PanelState {
  const next = structuredClone(state);
  const uid = () => crypto.randomUUID();
  let audit = "";
  if (action.type === "team") {
    const team = next.teams.find((item) => item.id === action.id);
    if (!team) throw new Error("Ekip bulunamadı.");
    team.active = action.active;
    audit = `${team.name}: ${team.active ? "görev alabilir" : "yeni göreve kapalı"} olarak işaretlendi.`;
  } else if (action.type === "announcement") {
    const value = structuredClone(action.value);
    required(value.title, "Başlık");
    required(value.body, "Açıklama", 15);
    required(value.neighborhood, "Bölge");
    value.reportIds = [...new Set(value.reportIds)];
    for (const id of value.reportIds) {
      const report = next.reports.find((item) => item.id === id);
      if (
        !report ||
        report.status === "withdrawn" ||
        report.category !== value.category
      )
        throw new Error(
          "Duyuruya yalnız aynı kategorideki geçerli talepler bağlanabilir.",
        );
      if (report.incidentId && report.incidentId !== value.id)
        throw new Error(
          "Talep başka bir duyuruya bağlı; önce o duyurudan çıkar.",
        );
    }
    const previous = next.announcements.find((item) => item.id === value.id);
    const announcement = {
      ...value,
      title: value.title.trim(),
      body: value.body.trim(),
      updates: [
        ...(previous?.updates ?? []),
        { body: value.body.trim(), at: now },
      ],
    };
    next.announcements = [
      announcement,
      ...next.announcements.filter((item) => item.id !== value.id),
    ];
    for (const report of next.reports) {
      if (
        report.incidentId === value.id &&
        !value.reportIds.includes(report.id)
      )
        delete report.incidentId;
      if (value.reportIds.includes(report.id)) report.incidentId = value.id;
    }
    audit = `“${value.title}” duyurusu ${value.state === "active" ? "yayında" : value.state === "draft" ? "taslak" : "tamamlandı"} olarak kaydedildi.`;
  } else if (action.type === "work") {
    const value = structuredClone(action.value);
    required(value.title, "Başlık");
    required(value.body, "Çalışma açıklaması", 15);
    required(value.neighborhood, "Bölge");
    required(value.benefit, "Karşılanan ihtiyaç", 10);
    value.reportIds = [...new Set(value.reportIds)];
    if (
      value.reportIds.some(
        (id) =>
          !next.reports.some(
            (report) => report.id === id && report.status !== "withdrawn",
          ),
      )
    )
      throw new Error("Çalışmaya bağlanan talepler geçerli olmalı.");
    value.completedAt =
      value.state === "completed" ? (value.completedAt ?? now) : undefined;
    next.works = [value, ...next.works.filter((item) => item.id !== value.id)];
    audit = `“${value.title}” çalışma kaydı güncellendi.`;
  } else {
    const report = next.reports.find((item) => item.id === action.id);
    if (!report) throw new Error("Talep bulunamadı.");
    if (report.status === "withdrawn")
      throw new Error("Geri çekilen talepte işlem yapılamaz.");
    let body = "",
      audience: Event["audience"] = "internal";
    if (action.type === "priority") {
      report.priority = action.priority;
      report.prioritySource = "authority";
      body = `Öncelik yetkili tarafından “${priorities[action.priority]}” olarak belirlendi.`;
    }
    if (action.type === "assign") {
      if (!ongoing(report))
        throw new Error(
          "Sonuçlanan talebi yönlendirmek için yeniden incelemeye al.",
        );
      const unit = units.find((item) => item.id === action.unitId);
      if (!unit || !unit.categories.includes(report.category))
        throw new Error("Bu birim talebin kategorisi için uygun değil.");
      if (unit.external && action.teamId)
        throw new Error("Dış kuruma belediye ekibi atanamaz.");
      const team = next.teams.find((item) => item.id === action.teamId);
      if (action.teamId && (!team || team.unitId !== unit.id || !team.active))
        throw new Error("Seçilen ekip bu birim için görev alamıyor.");
      if (
        report.status !== "submitted" &&
        report.unitId === unit.id &&
        (report.teamId ?? "") === (team?.id ?? "")
      )
        return state;
      audience = "citizen";
      report.unitId = unit.id;
      report.teamId = team?.id;
      report.status = team ? "assigned" : "in_review";
      report.externalRouting = unit.external
        ? "Yönlendirme kaydı hazırlandı. Teslim teyidi yok."
        : undefined;
      body = unit.external
        ? `${unit.name} için yönlendirme kaydı oluşturuldu. Henüz teslim teyidi yok.`
        : `${unit.name}${team ? " / " + team.name : ""} yönlendirmesi kaydedildi.`;
    }
    if (action.type === "progress") {
      if (report.status !== "assigned" || !report.teamId)
        throw new Error("Önce bir saha ekibi ata.");
      report.status = "in_progress";
      body = "Kurum yetkilisi çalışmanın başladığını kaydetti.";
      audience = "citizen";
    }
    if (action.type === "note") {
      required(action.body, "Açıklama", 5);
      body = action.body.trim();
      audience = action.audience;
    }
    if (action.type === "resolve") {
      if (!ongoing(report))
        throw new Error("Bu talep için zaten çözüm bildirilmiş.");
      required(action.body, "Çözüm açıklaması", 15);
      report.status = "resolved";
      report.resolution = action.body.trim();
      delete report.feedback;
      body = "Çözüm bildirildi: " + report.resolution;
      audience = "citizen";
    }
    if (action.type === "reopen") {
      if (!["resolved", "closed"].includes(report.status))
        throw new Error(
          "Yalnız çözüm bildirilmiş talep yeniden incelemeye alınabilir.",
        );
      required(action.body, "Yeniden inceleme gerekçesi", 10);
      report.status = "in_review";
      delete report.teamId;
      body = "Yeniden inceleme: " + action.body.trim();
      audience = "citizen";
    }
    report.updatedAt = now;
    report.events.push({ id: uid(), body, audience, at: now });
    audit = `${report.reference} · ${body}`;
  }
  next.audit.unshift({ id: uid(), body: audit, at: now });
  next.audit = next.audit.slice(0, 300);
  return next;
}
export function exportCsv(reports: CitizenReport[], demo = true) {
  const escape = (value: string) =>
    '"' +
    (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
    '"';
  const rows = [
    [
      demo ? "ÖRNEK VERİ" : "OLTU PİLOT KAYDI",
      "Talep no",
      "Başlık",
      "Kategori",
      "Mahalle",
      "Durum",
      "Öncelik",
      "Destek kaydı",
    ],
    ...reports.map((report) => [
      demo ? "Canlı belediye kaydı değildir" : "Yerel sunucu kaydı",
      report.reference,
      report.title,
      categories[report.category].name,
      report.neighborhood,
      statuses[report.status],
      priorities[report.priority],
      String(report.supports),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
}
