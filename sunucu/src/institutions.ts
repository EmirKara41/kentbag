import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import { z } from "zod";
import type { Database, Sql } from "./database.js";
import { HttpError } from "./validation.js";
import { categories, units } from "./municipality-domain.js";
import type { MunicipalityService } from "./municipality.js";
import {
  institutionProfiles,
  type InstitutionCase,
} from "./institution-domain.js";

const id = z.string().min(1).max(220);
const text = z.string().trim().min(5).max(2000);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accept"), id }),
  z.object({ type: z.literal("return"), id, body: text }),
  z.object({ type: z.literal("note"), id, body: text }),
  z.object({
    type: z.literal("order"),
    id,
    teamId: id,
    instruction: z.string().trim().min(10).max(2000),
    priority: z.enum(["urgent", "high", "normal", "low"]),
  }),
  z.object({ type: z.literal("cancel-order"), id, orderId: id, body: text }),
  z.object({
    type: z.literal("message"),
    id,
    body: text,
    audience: z.enum(["citizen", "participants"]),
  }),
]);
const forwardSchema = z.object({ id, unitId: id, instruction: text });
const iso = (value: any) => (value ? new Date(value).toISOString() : undefined);
const inactive = (doc: any) =>
  doc.status === "withdrawn" ||
  (["resolved", "closed"].includes(doc.status) &&
    doc.feedback?.outcome !== "persists");
export class InstitutionService {
  constructor(
    readonly db: Database,
    readonly municipality: MunicipalityService,
  ) {}
  private async lock(sql: Sql, reportId: string) {
    await sql.query(
      "SELECT id FROM municipality_state WHERE id='oltu' FOR UPDATE",
    );
    const row = (
      await sql.query(
        "SELECT document FROM citizen_report WHERE id=$1 FOR UPDATE",
        [reportId],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, "Talep bulunamadı.");
    if (inactive(row.document))
      throw new HttpError(409, "Bu talep işlem yapılmasına açık değil.");
    return row.document;
  }
  private async event(sql: Sql, delivery: any, kind: string, body: string) {
    const eventId = randomUUID(),
      now = new Date().toISOString();
    await sql.query(
      "INSERT INTO institution_case_event(id,report_id,delivery_id,unit_id,kind,body) VALUES($1,$2,$3,$4,$5,$6)",
      [eventId, delivery.report_id, delivery.id, delivery.unit_id, kind, body],
    );
    const profile = institutionProfiles.find((p) => p.id === delivery.unit_id)!;
    await sql.query(
      "UPDATE municipality_state SET document=jsonb_set(document,'{audit}',($1::jsonb || (document->'audit'))) WHERE id='oltu'",
      [
        JSON.stringify([
          { id: eventId, at: now, body: `${profile.name} · ${kind} · ${body}` },
        ]),
      ],
    );
    await sql.query(
      "UPDATE institution_case SET updated_at=now() WHERE report_id=$1",
      [delivery.report_id],
    );
  }
  async forward(input: unknown) {
    const data = forwardSchema.parse(input);
    return this.db.transaction(async (sql) => {
      const doc = await this.lock(sql, data.id),
        unit = units.find((u) => u.id === data.unitId);
      if (!unit || !unit.categories.includes(doc.category))
        throw new HttpError(
          409,
          "Bu kurum talebin kategorisi için uygun değil.",
        );
      const existing = (
        await sql.query(
          "SELECT * FROM institution_case WHERE report_id=$1 FOR UPDATE",
          [data.id],
        )
      ).rows[0];
      if (existing?.unit_id === unit.id && existing.state !== "returned")
        return { ok: true, reused: true };
      if (doc.municipality.teamId && doc.municipality.unitId !== unit.id)
        throw new HttpError(
          409,
          "Saha görevlendirmesi bulunan talep başka kuruma aktarılamaz.",
        );
      await sql.query(
        "UPDATE institution_work_order SET state='cancelled',updated_at=now() WHERE report_id=$1 AND state='prepared'",
        [data.id],
      );
      const deliveryId = randomUUID();
      await sql.query(
        `INSERT INTO institution_case(report_id,id,unit_id,state,instruction) VALUES($1,$2,$3,'queued',$4)
        ON CONFLICT(report_id) DO UPDATE SET id=$2,unit_id=$3,state='queued',instruction=$4,return_reason=NULL,accepted_at=NULL,created_at=now(),updated_at=now()`,
        [data.id, deliveryId, unit.id, data.instruction],
      );
      doc.municipality.unitId = unit.id;
      await sql.query(
        "UPDATE citizen_report SET document=$1::jsonb WHERE id=$2",
        [JSON.stringify(doc), data.id],
      );
      await this.event(
        sql,
        { report_id: data.id, id: deliveryId, unit_id: unit.id },
        "Merkezden gönderildi",
        `${doc.reference} · ${data.instruction}`,
      );
      return { ok: true, reused: false };
    });
  }
  async workspace(unitId: string) {
    const rows = (
      await this.db.query(
        "SELECT c.*,r.document FROM institution_case c JOIN citizen_report r ON r.id=c.report_id WHERE c.unit_id=$1 ORDER BY c.created_at DESC",
        [unitId],
      )
    ).rows;
    const orders = (
      await this.db.query(
        "SELECT * FROM institution_work_order WHERE unit_id=$1 ORDER BY created_at DESC",
        [unitId],
      )
    ).rows;
    const events = (
      await this.db.query(
        "SELECT * FROM institution_case_event WHERE unit_id=$1 ORDER BY created_at",
        [unitId],
      )
    ).rows;
    const cases: InstitutionCase[] = await Promise.all(
      rows.map(async (c) => {
        const d = c.document,
          m = d.municipality,
          photos = (await this.municipality.citizen.decorate(d)).photos;
        const currentOrders = orders.filter((o) => o.delivery_id === c.id);
        return {
          id: d.id,
          reference: d.reference,
          category: d.category,
          title: categories[d.category as keyof typeof categories].name,
          description: d.description,
          address: d.location.address,
          neighborhood: "Oltu",
          status: d.status,
          shared: d.sharePublicly === true,
          actionable: !inactive(d),
          priority: m.priority ?? m.triage?.priority ?? "normal",
          createdAt: d.createdAt,
          point:
            d.location.source === "manual"
              ? undefined
              : [d.location.latitude, d.location.longitude],
          photos,
          delivery: {
            id: c.id,
            unitId: c.unit_id,
            state: c.state,
            instruction: c.instruction,
            returnReason: c.return_reason ?? undefined,
            createdAt: iso(c.created_at)!,
            acceptedAt: iso(c.accepted_at),
            updatedAt: iso(c.updated_at)!,
            preparedCount: currentOrders.filter((o) => o.state === "prepared")
              .length,
          },
          orders: currentOrders.map((o) => ({
            id: o.id,
            teamId: o.team_id,
            instruction: o.instruction,
            priority: o.priority,
            state: o.state,
            createdAt: iso(o.created_at)!,
          })),
          events: events
            .filter((e) => e.delivery_id === c.id)
            .map((e) => ({
              id: e.id,
              kind: e.kind,
              body: e.body,
              createdAt: iso(e.created_at)!,
            })),
        };
      }),
    );
    return {
      cases,
      profile: institutionProfiles.find((p) => p.id === unitId),
      crewConnected: false,
    };
  }
  async action(unitId: string, input: unknown) {
    const action = actionSchema.parse(input);
    if (action.type === "message") {
      await this.municipality.action(
        {
          type: "note",
          id: action.id,
          body: action.body,
          audience: action.audience,
        },
        { unitId },
      );
      return { ok: true };
    }
    return this.db.transaction(async (sql) => {
      const doc = await this.lock(sql, action.id);
      const delivery = (
        await sql.query(
          "SELECT * FROM institution_case WHERE report_id=$1 AND unit_id=$2 FOR UPDATE",
          [action.id, unitId],
        )
      ).rows[0];
      if (!delivery) throw new HttpError(404, "Bu talep kurumunuza ait değil.");
      if (doc.municipality.unitId !== unitId)
        throw new HttpError(
          409,
          "Merkez birim atamasını değiştirmiş. Talebi merkeze danışın.",
        );
      if (action.type === "accept") {
        if (delivery.state === "accepted") return { ok: true };
        if (delivery.state !== "queued")
          throw new HttpError(
            409,
            "İade edilen talebi merkez yeniden göndermeli.",
          );
        await sql.query(
          "UPDATE institution_case SET state='accepted',accepted_at=now() WHERE report_id=$1",
          [action.id],
        );
        await this.event(
          sql,
          delivery,
          "Kurum teslim aldı",
          `${doc.reference} kurum tarafından incelemeye alındı.`,
        );
      } else {
        if (delivery.state !== "accepted")
          throw new HttpError(409, "Önce talebi incelemeye alın.");
        if (action.type === "return") {
          await sql.query(
            "UPDATE institution_case SET state='returned',return_reason=$1 WHERE report_id=$2",
            [action.body, action.id],
          );
          await sql.query(
            "UPDATE institution_work_order SET state='cancelled',updated_at=now() WHERE report_id=$1 AND state='prepared'",
            [action.id],
          );
          await this.event(sql, delivery, "Merkeze iade edildi", action.body);
        }
        if (action.type === "note")
          await this.event(sql, delivery, "Kurum içi not", action.body);
        if (action.type === "order") {
          if (
            !institutionProfiles
              .find((p) => p.id === unitId)
              ?.teams.some((t) => t.id === action.teamId)
          )
            throw new HttpError(409, "Seçilen ekip kurumunuza ait değil.");
          const existing = (
            await sql.query(
              "SELECT * FROM institution_work_order WHERE report_id=$1 AND state='prepared'",
              [action.id],
            )
          ).rows[0];
          if (existing) {
            if (
              existing.team_id === action.teamId &&
              existing.instruction === action.instruction &&
              existing.priority === action.priority
            )
              return { ok: true };
            throw new HttpError(
              409,
              "Bu talepte hazır bir görev emri var. Değiştirmek için önce iptal edin.",
            );
          }
          await sql.query(
            "INSERT INTO institution_work_order(id,report_id,delivery_id,unit_id,team_id,instruction,priority) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              randomUUID(),
              action.id,
              delivery.id,
              unitId,
              action.teamId,
              action.instruction,
              action.priority,
            ],
          );
          await this.event(
            sql,
            delivery,
            "Görev emri hazırlandı",
            `${action.instruction} · Saha uygulamasına teslim henüz yapılmadı.`,
          );
        }
        if (action.type === "cancel-order") {
          const changed = await sql.query(
            "UPDATE institution_work_order SET state='cancelled',updated_at=now() WHERE id=$1 AND report_id=$2 AND unit_id=$3 AND delivery_id=$4 AND state='prepared' RETURNING id",
            [action.orderId, action.id, unitId, delivery.id],
          );
          if (!changed.rows.length)
            throw new HttpError(
              409,
              "İptal edilecek hazır görev emri bulunamadı.",
            );
          await this.event(
            sql,
            delivery,
            "Görev emri iptal edildi",
            action.body,
          );
        }
      }
      return { ok: true };
    });
  }
}
// Pilot sessions are issued only on the operator's computer. Each capability is bound to one institution.
export function institutionRouter(
  service: InstitutionService,
  options: { token: string; panelOrigin: string },
) {
  const router = express.Router();
  router.use(express.json({ limit: "16kb" }));
  const signature = (payload: string) =>
    createHmac("sha256", options.token)
      .update("institution:" + payload)
      .digest("base64url");
  router.post("/:unitId/local-session", (req, res) => {
    const unitId = String(req.params.unitId);
    const origin = new URL(options.panelOrigin),
      allowed = [
        options.panelOrigin,
        `${origin.protocol}//127.0.0.1:${origin.port}`,
      ];
    if (
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      ) ||
      !allowed.includes(req.headers.origin ?? "")
    )
      throw new HttpError(
        403,
        "Kurum pilot oturumu yalnız bu bilgisayardan açılabilir.",
      );
    if (!institutionProfiles.some((p) => p.id === unitId))
      throw new HttpError(404, "Kurum bulunamadı.");
    const payload = Buffer.from(
      JSON.stringify({ unitId, expires: Date.now() + 8 * 60 * 60 * 1000 }),
    ).toString("base64url");
    res.json({ token: payload + "." + signature(payload) });
  });
  router.use("/:unitId", (req, res, next) => {
    const [payload, supplied, ...extra] = (
      req.headers.authorization?.replace(/^Bearer /, "") ?? ""
    ).split(".");
    const expected = payload ? signature(payload) : "",
      a = Buffer.from(supplied ?? ""),
      b = Buffer.from(expected);
    if (
      !payload ||
      extra.length ||
      !a.length ||
      a.length !== b.length ||
      !timingSafeEqual(a, b)
    )
      throw new HttpError(401, "Kurum oturumu gerekiyor.");
    let claim: any;
    try {
      claim = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      throw new HttpError(401, "Kurum oturumu geçersiz.");
    }
    if (typeof claim.expires !== "number" || claim.expires < Date.now())
      throw new HttpError(401, "Kurum oturumunun süresi doldu.");
    if (claim.unitId !== req.params.unitId)
      throw new HttpError(403, "Başka bir kurumun alanına erişemezsiniz.");
    res.locals.unitId = claim.unitId;
    next();
  });
  router.get("/:unitId/workspace", async (_req, res) =>
    res.json(await service.workspace(res.locals.unitId)),
  );
  router.post("/:unitId/actions", async (req, res) =>
    res.json(await service.action(res.locals.unitId, req.body)),
  );
  return router;
}
