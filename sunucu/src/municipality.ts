import { randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import { z } from "zod";
import type { Database, Sql } from "./database.js";
import type { Config } from "./config.js";
import { HttpError } from "./validation.js";
import { CitizenService } from "./citizen.js";
import {
  applyAction,
  categories,
  units,
  type PanelState,
  type CitizenReport,
  type Action,
} from "./municipality-domain.js";
import { ruleTriage, geminiTriage } from "./triage.js";
import { CommunityService } from "./community.js";
import { InstitutionService } from "./institutions.js";

const id = z.string().min(1).max(220);
const body = z.string().trim().min(3).max(2000);
const category = z.enum(
  Object.keys(categories) as [
    keyof typeof categories,
    ...(keyof typeof categories)[],
  ],
);
const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("priority"),
    id,
    priority: z.enum(["urgent", "high", "normal", "low"]),
  }),
  z.object({
    type: z.literal("assign"),
    id,
    unitId: id,
    teamId: id.optional(),
  }),
  z.object({ type: z.literal("progress"), id }),
  z.object({
    type: z.literal("note"),
    id,
    body,
    audience: z.enum(["internal", "citizen", "participants"]),
  }),
  z.object({ type: z.literal("resolve"), id, body }),
  z.object({ type: z.literal("reopen"), id, body }),
  z.object({ type: z.literal("team"), id, active: z.boolean() }),
  z.object({
    type: z.literal("announcement"),
    value: z.object({
      id,
      title: body,
      category,
      neighborhood: body,
      body,
      eta: z.string().max(200),
      state: z.enum(["draft", "active", "completed"]),
      reportIds: z.array(id).max(1000),
    }),
  }),
  z.object({
    type: z.literal("work"),
    value: z.object({
      id,
      title: body,
      neighborhood: body,
      body,
      benefit: body,
      reportIds: z.array(id).max(1000),
      state: z.enum(["planned", "in_progress", "completed"]),
      completedAt: z.iso.datetime().optional(),
    }),
  }),
]);
export function emptyMunicipality(): PanelState {
  return {
    version: 1,
    reports: [],
    announcements: [],
    works: [],
    audit: [],
    teams: [
      {
        id: "oltu-fen",
        unitId: "public-works",
        name: "Fen İşleri · Pilot ekip",
        code: "FEN-01",
        active: true,
      },
      {
        id: "oltu-temizlik",
        unitId: "cleaning",
        name: "Temizlik · Pilot ekip",
        code: "TEM-01",
        active: true,
      },
      {
        id: "oltu-park",
        unitId: "parks",
        name: "Ortak alan · Pilot ekip",
        code: "PRK-01",
        active: true,
      },
    ],
  };
}
export class MunicipalityService {
  readonly citizen: CitizenService;
  private running = false;
  constructor(
    readonly db: Database,
    readonly config: Config,
    readonly ai: { apiKey?: string; model: string },
  ) {
    this.citizen = new CitizenService(db, config);
  }
  async initialize() {
    await this.db.query(
      "INSERT INTO municipality_state(id,document) VALUES('oltu',$1::jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(emptyMunicipality())],
    );
    const rows = await this.db.query(
      "SELECT id FROM citizen_report WHERE NOT(document ? 'municipality')",
    );
    for (const row of rows.rows) await this.ingest(row.id);
  }
  async ingest(reportId: string) {
    await this.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "SELECT document FROM citizen_report WHERE id=$1 FOR UPDATE",
          [reportId],
        )
      ).rows[0];
      if (!row || row.document.municipality) return;
      const doc = row.document;
      const unit = units.find((u) => u.categories.includes(doc.category))!;
      const triage = ruleTriage(doc, !!this.ai.apiKey);
      doc.municipality = {
        unitId: unit.id,
        triage,
        prioritySource: "suggestion",
        events: [],
      };
      const message = unit.external
        ? `Oltu çözüm merkezi kaydını aldı. ${unit.name} için dış kurum yönlendirme kuyruğu hazırlandı; henüz teslim teyidi yok.`
        : `Oltu çözüm merkezi kaydını aldı. ${unit.name} birim kuyruğuna eklendi; ekip ataması bekleniyor.`;
      await this.publicEvent(sql, doc, message);
      await sql.query(
        "UPDATE citizen_report SET document=$1::jsonb WHERE id=$2",
        [JSON.stringify(doc), reportId],
      );
    });
  }
  private async publicEvent(
    sql: Sql,
    doc: any,
    message: string,
    notify = true,
    kind: "status" | "message" = "status",
  ) {
    const now = new Date().toISOString();
    doc.events.push({
      id: randomUUID(),
      status: doc.status,
      body: message,
      kind,
      createdAt: now,
    });
    if (!notify) return;
    const inboxId = randomUUID();
    await sql.query(
      "INSERT INTO citizen_inbox(id,owner_id,report_id,document) VALUES($1,$2,$3,$4::jsonb)",
      [
        inboxId,
        doc.ownerId,
        doc.id,
        JSON.stringify({
          id: inboxId,
          ownerId: doc.ownerId,
          reportId: doc.id,
          title: "Talebinde yeni gelişme",
          body: message,
          createdAt: now,
          read: false,
        }),
      ],
    );
  }
  async snapshot(sql: Sql = this.db): Promise<PanelState> {
    const state = (
      await sql.query("SELECT document FROM municipality_state WHERE id='oltu'")
    ).rows[0].document as PanelState;
    const rows = await sql.query(
      `SELECT r.document,u.name,p.data AS profile,
      (SELECT jsonb_build_object('id',c.id,'unitId',c.unit_id,'state',c.state,'instruction',c.instruction,'returnReason',c.return_reason,'createdAt',c.created_at,'acceptedAt',c.accepted_at,'updatedAt',c.updated_at,'preparedCount',(SELECT count(*) FROM institution_work_order w WHERE w.delivery_id=c.id AND w.state='prepared'),'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'body',e.body,'createdAt',e.created_at) ORDER BY e.created_at) FROM institution_case_event e WHERE e.delivery_id=c.id),'[]'::jsonb)) FROM institution_case c WHERE c.report_id=r.id) AS institution_delivery,
      (SELECT count(*)::integer FROM community_subscription s JOIN community_issue i ON i.id=s.issue_id WHERE i.report_id=r.id) AS subscriptions
      FROM citizen_report r JOIN "user" u ON u.id=r.owner_id LEFT JOIN citizen_profile p ON p.owner_id=r.owner_id ORDER BY r.created_at DESC`,
    );
    state.reports = await Promise.all(
      rows.rows.map(async (row) => {
        const d = row.document,
          m = d.municipality ?? {},
          decorated = await this.citizen.decorate(d, sql);
        const unit = units.find((u) => u.id === m.unitId);
        return {
          id: d.id,
          reference: d.reference,
          title: categories[d.category as keyof typeof categories].name,
          description: d.description,
          category: d.category,
          kind: d.kind,
          address: d.location.address,
          neighborhood: row.profile?.neighborhood || "Oltu",
          point:
            d.location.source === "manual"
              ? undefined
              : [d.location.latitude, d.location.longitude],
          citizen: row.profile?.name || row.name,
          supports: Number(row.subscriptions),
          shared: d.sharePublicly === true,
          institutionDelivery: row.institution_delivery ?? undefined,
          status: d.status,
          priority: m.priority ?? m.triage?.priority ?? "normal",
          prioritySource: m.prioritySource ?? "suggestion",
          triage: m.triage,
          createdAt: d.createdAt,
          updatedAt: m.updatedAt ?? d.createdAt,
          unitId: m.unitId,
          teamId: m.teamId,
          incidentId: m.incidentId,
          resolution: d.resolution?.body ?? d.resolution?.summary,
          feedback: d.feedback?.outcome,
          feedbackText: d.feedback?.text,
          photos: decorated.photos,
          externalRouting: unit?.external
            ? "Dış kurum kuyruğunda; teslim teyidi yok."
            : undefined,
          events: [
            ...d.events.map((e: any) => ({
              id: e.id,
              body: e.body,
              at: e.createdAt,
              audience: "citizen",
            })),
            ...d.notes.map((n: any) => ({
              id: n.id,
              body: "Vatandaş notu: " + n.text,
              at: n.createdAt,
              audience: "citizen",
            })),
            ...(m.events ?? []),
          ].sort((a: any, b: any) => Date.parse(a.at) - Date.parse(b.at)),
        } as CitizenReport;
      }),
    );
    return state;
  }
  async action(input: unknown, actor?: { unitId: string }) {
    const action = actionSchema.parse(input) as Action;
    await this.db.transaction(async (sql) => {
      let institutionDeliveryId: string | undefined;
      await sql.query(
        "SELECT id FROM municipality_state WHERE id='oltu' FOR UPDATE",
      );
      await sql.query("SELECT id FROM citizen_report ORDER BY id FOR UPDATE");
      if (actor) {
        if (action.type !== "note" || action.audience === "internal")
          throw new HttpError(403, "Bu işlem kurum yetkisi kapsamında değil.");
        const delivery = (
          await sql.query(
            "SELECT id,state FROM institution_case WHERE report_id=$1 AND unit_id=$2",
            [action.id, actor.unitId],
          )
        ).rows[0];
        if (!delivery)
          throw new HttpError(404, "Bu talep kurumunuza ait değil.");
        if (delivery.state !== "accepted")
          throw new HttpError(409, "Önce talebi incelemeye alın.");
        institutionDeliveryId = delivery.id;
      }
      const before = await this.snapshot(sql);
      if (
        action.type === "note" &&
        action.audience === "participants" &&
        !before.reports.find((r) => r.id === action.id)?.shared
      )
        throw new HttpError(
          409,
          "Ortak güncelleme için talebin yakındaki bildirimlerde paylaşılması gerekiyor.",
        );
      let next: PanelState;
      try {
        next = applyAction(before, action);
      } catch (e) {
        throw new HttpError(
          409,
          e instanceof Error ? e.message : "İşlem uygulanamadı.",
        );
      }
      for (const after of next.reports) {
        const previous = before.reports.find((r) => r.id === after.id)!;
        if (JSON.stringify(previous) === JSON.stringify(after)) continue;
        const doc = (
          await sql.query("SELECT document FROM citizen_report WHERE id=$1", [
            after.id,
          ])
        ).rows[0].document;
        if (action.type === "assign") {
          await sql.query(
            "UPDATE institution_case SET state='returned',return_reason='Merkez birim atamasını değiştirdi.',updated_at=now() WHERE report_id=$1 AND unit_id<>$2",
            [after.id, action.unitId],
          );
          await sql.query(
            "UPDATE institution_work_order SET state='cancelled',updated_at=now() WHERE report_id=$1 AND unit_id<>$2 AND state='prepared'",
            [after.id, action.unitId],
          );
        }
        const added = after.events.filter(
          (e) => !previous.events.some((old) => old.id === e.id),
        );
        doc.status = after.status;
        if (
          ["resolved", "closed", "withdrawn"].includes(after.status) &&
          after.feedback !== "persists"
        )
          await sql.query(
            "UPDATE institution_work_order SET state='cancelled',updated_at=now() WHERE report_id=$1 AND state='prepared'",
            [after.id],
          );
        doc.municipality = {
          ...doc.municipality,
          priority:
            after.prioritySource === "authority" ? after.priority : undefined,
          prioritySource: after.prioritySource,
          unitId: after.unitId,
          teamId: after.teamId,
          incidentId: after.incidentId,
          updatedAt: after.updatedAt,
          events: [
            ...(doc.municipality?.events ?? []),
            ...added.filter((e) => e.audience === "internal"),
          ],
        };
        if (action.type === "resolve") {
          doc.resolution = {
            body: after.resolution,
            photos: [],
            completedAt: after.updatedAt,
          };
          delete doc.feedback;
        }
        for (const event of added.filter(
          (e) => e.audience === "citizen" || e.audience === "participants",
        ))
          await this.publicEvent(
            sql,
            doc,
            event.body,
            !(doc.sharePublicly && previous.status !== after.status),
            action.type === "note" ? "message" : "status",
          );
        const community = new CommunityService(this.db);
        if (action.type === "note" && action.audience === "participants")
          await community.update(sql, doc, action.body, true);
        if (previous.status !== after.status) await community.status(sql, doc);
        if (actor && institutionDeliveryId && action.type === "note") {
          await sql.query(
            "INSERT INTO institution_case_event(id,report_id,delivery_id,unit_id,kind,body) VALUES($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              after.id,
              institutionDeliveryId,
              actor.unitId,
              action.audience === "participants"
                ? "Katılan herkese açıklama"
                : "Talep sahibine yanıt",
              action.body,
            ],
          );
          await sql.query(
            "UPDATE institution_case SET updated_at=now() WHERE report_id=$1",
            [after.id],
          );
        }
        await sql.query(
          "UPDATE citizen_report SET document=$1::jsonb WHERE id=$2",
          [JSON.stringify(doc), after.id],
        );
      }
      const { reports: _reports, ...saved } = next;
      await sql.query(
        "UPDATE municipality_state SET document=$1::jsonb WHERE id='oltu'",
        [JSON.stringify({ ...saved, reports: [] })],
      );
    });
    return this.snapshot();
  }
  async analyzePending() {
    if (this.running || !this.ai.apiKey) return;
    this.running = true;
    try {
      const rows = await this.db.query(
        "SELECT id,document FROM citizen_report WHERE document->'municipality'->'triage'->>'aiState' IN ('pending','no_key') AND document->>'status' <> 'withdrawn' ORDER BY created_at LIMIT 5",
      );
      for (const row of rows.rows) {
        const triage = await geminiTriage(
          row.document,
          row.document.municipality.triage,
          { apiKey: this.ai.apiKey, model: this.ai.model },
        );
        await this.db.query(
          "UPDATE citizen_report SET document=jsonb_set(document,'{municipality,triage}',$1::jsonb) WHERE id=$2",
          [JSON.stringify(triage), row.id],
        );
      }
    } finally {
      this.running = false;
    }
  }
}
export function municipalityRouter(
  service: MunicipalityService,
  options: { token: string; panelOrigin: string },
) {
  const router = express.Router();
  // Local pilot capability is issued only to this computer, never to a citizen or a LAN client.
  router.post("/local-session", (req, res) => {
    const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress ?? "",
    );
    const localOrigin = new URL(options.panelOrigin);
    const localOrigins = [
      options.panelOrigin,
      `${localOrigin.protocol}//127.0.0.1:${localOrigin.port}`,
    ];
    if (!loopback || !localOrigins.includes(req.headers.origin ?? ""))
      throw new HttpError(
        403,
        "Yerel yönetici bağlantısı yalnız bu bilgisayardan açılabilir.",
      );
    res.json({ token: options.token });
  });
  router.use((req, _res, next) => {
    const supplied = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const a = Buffer.from(supplied),
      b = Buffer.from(options.token);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new HttpError(401, "Belediye yetkisi gerekiyor.");
    next();
  });
  router.get("/workspace", async (_req, res) =>
    res.json({
      data: await service.snapshot(),
      location: "Oltu · Erzurum",
      ai: service.ai.apiKey ? "configured" : "no_key",
    }),
  );
  router.post("/actions", express.json({ limit: "64kb" }), async (req, res) =>
    res.json({ data: await service.action(req.body) }),
  );
  router.post(
    "/institutions/forward",
    express.json({ limit: "16kb" }),
    async (req, res) => {
      await new InstitutionService(service.db, service).forward(req.body);
      res.json({ data: await service.snapshot() });
    },
  );
  return router;
}
