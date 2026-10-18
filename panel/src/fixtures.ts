import type { CitizenReport, PanelState } from "./domain";
export function seedState(): PanelState {
  const date = (hours: number) =>
    new Date(Date.now() - hours * 3600000).toISOString();
  const rows: (Pick<
    CitizenReport,
    | "id"
    | "title"
    | "description"
    | "category"
    | "status"
    | "priority"
    | "address"
    | "neighborhood"
  > &
    Partial<CitizenReport> & { hours: number })[] = [
    {
      id: "r1",
      title: "Okul önündeki yolda derin çukur",
      description:
        "Okulun girişindeki çukur özellikle servis saatlerinde geçişi tehlikeli hale getiriyor. Etrafında uyarı da yok.",
      category: "road",
      status: "submitted",
      priority: "urgent",
      address: "Cumhuriyet Mah., Okul Caddesi, ilkokul önü",
      neighborhood: "Cumhuriyet",
      point: [41.023, 29.002],
      hours: 2,
      supports: 8,
    },
    {
      id: "r2",
      title: "Sağlık merkezine erişilebilir geçiş",
      description:
        "Yüksek kaldırım nedeniyle tekerlekli sandalye ile sağlık merkezine ulaşmak zor. Uygun eğimli bir geçiş düzenlemesi istiyoruz.",
      category: "accessibility",
      kind: "improvement",
      status: "in_review",
      priority: "high",
      address: "Cumhuriyet Mah., Sağlık Sokak No: 12",
      neighborhood: "Cumhuriyet",
      hours: 30,
      supports: 24,
      unitId: "public-works",
    },
    {
      id: "r3",
      title: "Çınar Sokak'ta su kesintisi",
      description:
        "Öğle saatlerinden beri sokakta su yok. Komşu binalarda da aynı durum yaşanıyor.",
      category: "water",
      status: "in_progress",
      priority: "high",
      address: "Cumhuriyet Mah., Çınar Sokak",
      neighborhood: "Cumhuriyet",
      point: [41.026, 29.006],
      hours: 4,
      supports: 19,
      unitId: "water",
      teamId: "t1",
      incidentId: "a1",
    },
    {
      id: "r4",
      title: "Park girişinde biriken atıklar",
      description:
        "Konteyner çevresindeki çöpler iki gündür alınmadı. Yaya yolu da kapanmaya başladı.",
      category: "waste",
      status: "assigned",
      priority: "normal",
      address: "Yıldız Mah., Park Sokak girişi",
      neighborhood: "Yıldız",
      point: [41.032, 29.011],
      hours: 20,
      supports: 6,
      unitId: "cleaning",
      teamId: "t3",
    },
    {
      id: "r5",
      title: "Elektrik kesintisi hakkında bilgi",
      description:
        "Sabah saatlerinden beri birkaç sokakta elektrik yok. Kesinti hakkında bilgi almak istiyoruz.",
      category: "electricity",
      status: "submitted",
      priority: "high",
      address: "Bahçelievler Mah., Lale Caddesi",
      neighborhood: "Bahçelievler",
      point: [41.015, 28.99],
      hours: 3,
      supports: 11,
    },
    {
      id: "r6",
      title: "Durak yoluna aydınlatma isteği",
      description:
        "Park ile durak arasındaki yürüyüş yolunda yeterli aydınlatma yok. Akşam saatlerinde kullanmak zor oluyor.",
      category: "lighting",
      kind: "improvement",
      status: "in_review",
      priority: "normal",
      address: "Yıldız Mah., Çınar Parkı durak bağlantısı",
      neighborhood: "Yıldız",
      point: [41.03, 29.008],
      hours: 76,
      supports: 86,
      unitId: "parks",
    },
    {
      id: "r7",
      title: "Menekşe Sokak kaldırım hasarı",
      description:
        "Durak önündeki kırık kaldırım taşları geçişi zorlaştırıyor. Yüzeyin düzenlenmesini istiyoruz.",
      category: "pavement",
      kind: "improvement",
      status: "closed",
      priority: "normal",
      address: "Cumhuriyet Mah., Menekşe Sokak",
      neighborhood: "Cumhuriyet",
      point: [41.021, 29.001],
      hours: 120,
      supports: 17,
      unitId: "public-works",
      feedback: "solved",
      resolution: "Kaldırım yüzeyi ve durak bağlantısı düzenlendi.",
    },
    {
      id: "r8",
      title: "Menekşe Sokak'ta su akışı yok",
      description:
        "Yakındaki sokaktaki arızayla ilgili olabilir. Binamızda öğleden beri su akmıyor.",
      category: "water",
      status: "in_review",
      priority: "normal",
      address: "Cumhuriyet Mah., Menekşe Sokak No: 9",
      neighborhood: "Cumhuriyet",
      point: [41.025, 29.003],
      hours: 3,
      supports: 3,
      incidentId: "a1",
      unitId: "water",
    },
    {
      id: "r9",
      title: "Yaya yolunda yüzey onarımı",
      description:
        "Onarım yapılmış ama yolun bir kısmında çukur devam ediyor. Tekrar kontrol edilmesini rica ediyorum.",
      category: "road",
      status: "resolved",
      priority: "high",
      address: "Yıldız Mah., Gül Sokak No: 7",
      neighborhood: "Yıldız",
      hours: 54,
      supports: 2,
      feedback: "persists",
      resolution: "Yol yüzeyine yama yapıldı.",
      unitId: "public-works",
    },
    {
      id: "r10",
      title: "Konteyner çevresi temizliği",
      description:
        "Konteynerin etrafında biriken atıkların alınması gerekiyor.",
      category: "waste",
      status: "resolved",
      priority: "normal",
      address: "Bahçelievler Mah., Çiçek Sokak",
      neighborhood: "Bahçelievler",
      point: [41.018, 28.996],
      hours: 28,
      supports: 4,
      unitId: "cleaning",
      teamId: "t3",
      resolution: "Atıklar alındı ve çevre temizliği yapıldı.",
    },
    {
      id: "r11",
      title: "Parkta dinlenme bankı isteği",
      description:
        "Yürüyüş yolunun sonunda oturacak bir yer yok. Dinlenme bankı eklenmesini istiyoruz.",
      category: "park",
      kind: "improvement",
      status: "submitted",
      priority: "low",
      address: "Bahçelievler Mah., Yeşil Vadi Parkı",
      neighborhood: "Bahçelievler",
      point: [41.012, 28.997],
      hours: 48,
      supports: 12,
    },
    {
      id: "r12",
      title: "Tekrarlanan yol bildirimi",
      description:
        "Aynı sorun için daha önce bildirim yaptığımı gördüm; bu kaydı geri çekiyorum.",
      category: "road",
      status: "withdrawn",
      priority: "normal",
      address: "Cumhuriyet Mah., Okul Caddesi",
      neighborhood: "Cumhuriyet",
      hours: 1,
      supports: 0,
    },
  ];
  const reports: CitizenReport[] = rows.map((row, index) => ({
    citizen: ["Deniz K.", "Ece A.", "Mert Y.", "Selin T."][index % 4],
    kind: "issue",
    supports: 0,
    ...row,
    reference: `KB-2026-${String(1042 + index).padStart(4, "0")}`,
    createdAt: date(row.hours),
    updatedAt: date(row.hours - 0.5),
    events: [
      {
        id: `seed-${index}`,
        audience: "citizen",
        body: "Örnek talep kaydı oluşturuldu.",
        at: date(row.hours),
      },
      ...(row.status !== "submitted"
        ? [
            {
              id: `seed-action-${index}`,
              audience: "internal" as const,
              body:
                row.feedback === "persists"
                  ? "Vatandaş sorunun devam ettiğini bildirdi; yetkili incelemesi bekleniyor."
                  : "Örnek işlem geçmişi kaydedildi.",
              at: date(row.hours - 0.5),
            },
          ]
        : []),
    ],
  }));
  return {
    version: 1,
    reports,
    teams: [
      {
        id: "t1",
        name: "Su Arıza Ekibi 01",
        code: "SU-01",
        unitId: "water",
        active: true,
      },
      {
        id: "t2",
        name: "Yol Bakım Ekibi 02",
        code: "FN-02",
        unitId: "public-works",
        active: true,
      },
      {
        id: "t3",
        name: "Temizlik Ekibi 03",
        code: "TM-03",
        unitId: "cleaning",
        active: true,
      },
      {
        id: "t4",
        name: "Park Bakım Ekibi 04",
        code: "PK-04",
        unitId: "parks",
        active: false,
      },
    ],
    announcements: [
      {
        id: "a1",
        title: "Çınar Sokak ve çevresinde su kesintisi",
        category: "water",
        neighborhood: "Cumhuriyet",
        body: "Ana borudaki arızanın giderilmesi için çalışma sürüyor. Hasarlı bölüm değiştiriliyor.",
        eta: "Bugün 17.00",
        state: "active",
        reportIds: ["r3", "r8"],
        updates: [
          {
            body: "Arıza tespit edildi, onarım çalışması başladı.",
            at: date(3),
          },
          {
            body: "Hasarlı boru değiştiriliyor. Tahmini bitiş bugün 17.00.",
            at: date(1),
          },
        ],
      },
    ],
    works: [
      {
        id: "w1",
        title: "Durak bağlantısında kaldırım düzenlemesi",
        neighborhood: "Cumhuriyet",
        body: "Kırık yüzey yenilendi, durak bağlantısındaki geçiş düzenlendi.",
        benefit: "Kaldırım yüzeyi ve durak erişiminin iyileştirilmesi",
        reportIds: ["r7"],
        state: "completed",
        completedAt: date(24),
      },
      {
        id: "w2",
        title: "Park yolunda aydınlatma değerlendirmesi",
        neighborhood: "Yıldız",
        body: "Mevcut elektrik altyapısı ve uygun armatür konumları incelenecek.",
        benefit: "Park ile durak arasındaki yaya yolunun aydınlatılması",
        reportIds: ["r6"],
        state: "planned",
      },
    ],
    audit: [
      {
        id: "initial-audit",
        body: "Örnek çalışma alanı hazırlandı. Canlı kurum bağlantısı yok.",
        at: date(0),
      },
    ],
  };
}
