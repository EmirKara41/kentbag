import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./database.js";
import type { MunicipalityService } from "./municipality.js";
import type { Staff, StaffAccess } from "./staff.js";
import type { Config } from "./config.js";
import { HttpError } from "./validation.js";
import { institutionProfiles } from "./institution-domain.js";
import { categories } from "./municipality-domain.js";
import { resultPhotos } from "./result-photos.js";

const id = z.string().min(1).max(220);
const body = z.string().trim().min(15).max(2000);
const crewAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accept"), orderId: id }),
  z.object({ type: z.literal("start"), orderId: id }),
  z.object({
    type: z.literal("submit-result"),
    orderId: id,
    body,
    photos: z
      .array(z.string().uuid())
      .max(3)
      .refine((a) => new Set(a).size === a.length),
  }),
  z.object({ type: z.literal("decline"), orderId: id, body }),
]);
// Outages cannot be proven by a photo, so a written result is enough there.
// Other categories need at least one result photo.
export const photoOptional = (category: string) =>
  ["electricity", "water"].includes(category);
export const resultReviewSchema = z.object({
  orderId: id,
  decision: z.enum(["forward", "return"]),
  body,
});
export const centerReviewSchema = z.object({
  orderId: id,
  decision: z.enum(["publish", "return"]),
  body,
});
const inactive = (doc: any) =>
  doc.status === "withdrawn" ||
  (["resolved", "closed"].includes(doc.status) &&
    doc.feedback?.outcome !== "persists");
export const fieldStageNames = {
  assigned: "Ekibin kabulü bekleniyor",
  accepted: "Ekip kabul etti",
  in_progress: "Saha çalışması sürüyor",
  institution_review: "Kurum kontrolünde",
  center_review: "Belediye merkezinin onayında",
  published: "Sonuç vatandaşla paylaşıldı",
  declined: "Ekip görevi iade etti",
} as const;
export async function fieldOrderView(
  sql: Sql,
  config: Pick<Config, "baseUrl" | "secret">,
  row: any,
  includeResult = true,
) {
  const result = includeResult ? row.result : null;
  return {
    id: row.id,
    teamId: row.team_id,
    instruction: row.instruction,
    priority: row.priority,
    state: row.state,
    crewState: row.crew_state,
    reviewNote: row.review_note ?? undefined,
    declineReason: row.decline_reason ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    acceptedAt: row.accepted_at
      ? new Date(row.accepted_at).toISOString()
      : undefined,
    result: result
      ? {
          body: result.body,
          submittedAt: result.submittedAt,
          photos: await resultPhotos(
            sql,
            config,
            row.report_id,
            result.photos ?? [],
          ),
        }
      : undefined,
  };
}
export class FieldService {
  constructor(
    readonly db: Database,
    readonly municipality: MunicipalityService,
  ) {}
  private async lock(
    sql: Sql,
    orderId: string,
    scope?: { unitId: string; teamId?: string },
  ) {
    await sql.query(
      "SELECT id FROM municipality_state WHERE id='oltu' FOR UPDATE",
    );
    const candidate = (
      await sql.query(
        "SELECT report_id,unit_id,team_id FROM institution_work_order WHERE id=$1",
        [orderId],
      )
    ).rows[0];
    if (
      !candidate ||
      (scope &&
        (candidate.unit_id !== scope.unitId ||
          (scope.teamId && candidate.team_id !== scope.teamId)))
    )
      throw new HttpError(404, "Görev bulunamadı veya ekibinize ait değil.");
    const doc = (
      await sql.query(
        "SELECT document FROM citizen_report WHERE id=$1 FOR UPDATE",
        [candidate.report_id],
      )
    ).rows[0]?.document;
    const delivery = (
      await sql.query(
        "SELECT * FROM institution_case WHERE report_id=$1 FOR UPDATE",
        [candidate.report_id],
      )
    ).rows[0];
    const order = (
      await sql.query(
        "SELECT * FROM institution_work_order WHERE id=$1 FOR UPDATE",
        [orderId],
      )
    ).rows[0];
    if (
      !doc ||
      inactive(doc) ||
      order.state !== "prepared" ||
      !delivery ||
      delivery.id !== order.delivery_id ||
      delivery.unit_id !== order.unit_id ||
      delivery.state !== "accepted" ||
      doc.municipality.unitId !== order.unit_id
    )
      throw new HttpError(
        409,
        "Görev artık işlem yapılmasına açık değil. Listeyi yenileyin.",
      );
    return { order, doc, delivery };
  }
  private async event(
    sql: Sql,
    order: any,
    stage: string,
    message: string,
    actorId?: string,
  ) {
    const eventId = randomUUID();
    await sql.query(
      "INSERT INTO field_work_event(id,order_id,stage,body,actor_id) VALUES($1,$2,$3,$4,$5)",
      [eventId, order.id, stage, message, actorId ?? null],
    );
    await sql.query(
      "INSERT INTO institution_case_event(id,report_id,delivery_id,unit_id,kind,body) VALUES($1,$2,$3,$4,$5,$6)",
      [
        eventId,
        order.report_id,
        order.delivery_id,
        order.unit_id,
        fieldStageNames[stage as keyof typeof fieldStageNames] ??
          "Sonuç kontrolü",
        message,
      ],
    );
    await sql.query(
      "UPDATE institution_case SET updated_at=now() WHERE report_id=$1",
      [order.report_id],
    );
    await sql.query(
      "UPDATE municipality_state SET document=jsonb_set(document,'{audit}',($1::jsonb || (document->'audit'))) WHERE id='oltu'",
      [
        JSON.stringify([
          {
            id: eventId,
            at: new Date().toISOString(),
            body: `Saha · ${message}`,
          },
        ]),
      ],
    );
  }
  async workspace(member: Staff) {
    if (member.role !== "crew" || !member.unitId || !member.teamId)
      throw new HttpError(403, "Saha ekibi yetkisi gerekiyor.");
    const rows = (
      await this.db.query(
        "SELECT w.*,r.document,c.id AS current_delivery,c.state AS delivery_state FROM institution_work_order w JOIN citizen_report r ON r.id=w.report_id LEFT JOIN institution_case c ON c.report_id=w.report_id WHERE w.unit_id=$1 AND w.team_id=$2 ORDER BY w.created_at DESC",
        [member.unitId, member.teamId],
      )
    ).rows;
    const jobs = await Promise.all(
      rows.map(async (row) => {
        const doc = row.document;
        const decorated = await this.municipality.citizen.decorate(doc);
        const events = (
          await this.db.query(
            "SELECT id,stage,body,created_at FROM field_work_event WHERE order_id=$1 ORDER BY created_at",
            [row.id],
          )
        ).rows;
        return {
          ...(await fieldOrderView(this.db, this.municipality.config, row)),
          reference: doc.reference,
          title: categories[doc.category as keyof typeof categories].name,
          category: doc.category,
          photoOptional: photoOptional(doc.category),
          description: doc.description,
          address: doc.location.address,
          point:
            doc.location.source === "manual"
              ? undefined
              : {
                  latitude: doc.location.latitude,
                  longitude: doc.location.longitude,
                },
          photos: decorated.photos,
          actionable:
            row.state === "prepared" &&
            !inactive(doc) &&
            row.current_delivery === row.delivery_id &&
            row.delivery_state === "accepted" &&
            doc.municipality.unitId === member.unitId,
          events: events.map((e) => ({
            id: e.id,
            stage: e.stage,
            body: e.body,
            createdAt: new Date(e.created_at).toISOString(),
          })),
        };
      }),
    );
    const profile = institutionProfiles.find((p) => p.id === member.unitId)!;
    return {
      member: {
        userId: member.userId,
        name: member.name,
        unitId: member.unitId,
        teamId: member.teamId,
      },
      institution: profile.name,
      team: profile.teams.find((t) => t.id === member.teamId)?.name,
      jobs,
    };
  }
  async action(member: Staff, input: unknown) {
    if (member.role !== "crew" || !member.unitId || !member.teamId)
      throw new HttpError(403, "Saha ekibi yetkisi gerekiyor.");
    const action = crewAction.parse(input);
    await this.db.transaction(async (sql) => {
      const { order, doc } = await this.lock(sql, action.orderId, {
        unitId: member.unitId!,
        teamId: member.teamId!,
      });
      if (action.type === "accept") {
        if (order.crew_state !== "assigned") return;
        await sql.query(
          "UPDATE institution_work_order SET crew_state='accepted',accepted_by=$1,accepted_at=now(),updated_at=now() WHERE id=$2",
          [member.userId, order.id],
        );
        await this.event(
          sql,
          order,
          "accepted",
          "Saha ekibi kurumundan gelen görevi kabul etti.",
          member.userId,
        );
      } else if (action.type === "start") {
        if (order.crew_state === "in_progress") return;
        if (order.crew_state !== "accepted")
          throw new HttpError(409, "Önce görevi kabul edin.");
        await sql.query(
          "UPDATE institution_work_order SET crew_state='in_progress',updated_at=now() WHERE id=$1",
          [order.id],
        );
        await this.event(
          sql,
          order,
          "in_progress",
          "Saha ekibi çalışmaya başladığını kaydetti.",
          member.userId,
        );
      } else if (action.type === "decline") {
        if (
          order.crew_state === "declined" &&
          order.decline_reason === action.body
        )
          return;
        if (!["assigned", "accepted", "in_progress"].includes(order.crew_state))
          throw new HttpError(
            409,
            "Yalnız üzerinde çalışılan görev kuruma iade edilebilir.",
          );
        await sql.query(
          "UPDATE institution_work_order SET crew_state='declined',decline_reason=$1,review_note=NULL,updated_at=now() WHERE id=$2",
          [action.body, order.id],
        );
        await this.event(
          sql,
          order,
          "declined",
          `Saha ekibi görevi kuruma iade etti: ${action.body}`,
          member.userId,
        );
      } else {
        if (
          ["institution_review", "center_review"].includes(order.crew_state) &&
          order.result?.submittedBy === member.userId &&
          order.result.body === action.body &&
          JSON.stringify(order.result.photos) === JSON.stringify(action.photos)
        )
          return;
        if (!["accepted", "in_progress"].includes(order.crew_state))
          throw new HttpError(
            409,
            "Sonuç göndermek için görevi kabul edin veya kontrol sonucunu bekleyin.",
          );
        if (!action.photos.length && !photoOptional(doc.category))
          throw new HttpError(
            409,
            "Bu iş türünde en az bir sonuç fotoğrafı gerekir.",
          );
        const photos = (
          await sql.query(
            "SELECT id,owner_id,report_id FROM citizen_photo WHERE id=ANY($1::text[]) FOR UPDATE",
            [action.photos],
          )
        ).rows;
        if (
          photos.length !== action.photos.length ||
          photos.some(
            (p) =>
              p.owner_id !== member.userId ||
              (p.report_id && p.report_id !== order.report_id),
          )
        )
          throw new HttpError(
            409,
            "Fotoğraflar hesabınıza veya bu göreve ait değil.",
          );
        await sql.query(
          "UPDATE citizen_photo SET report_id=$1 WHERE id=ANY($2::text[])",
          [order.report_id, action.photos],
        );
        const result = {
          body: action.body,
          photos: action.photos,
          submittedBy: member.userId,
          submittedAt: new Date().toISOString(),
        };
        await sql.query(
          "UPDATE institution_work_order SET crew_state='institution_review',result=$1::jsonb,submitted_at=now(),review_note=NULL,updated_at=now() WHERE id=$2",
          [JSON.stringify(result), order.id],
        );
        await this.event(
          sql,
          order,
          "institution_review",
          action.photos.length
            ? "Saha ekibi fotoğraflı sonucunu kurum kontrolüne gönderdi. Henüz vatandaşla paylaşılmadı."
            : "Saha ekibi sonucunu fotoğrafsız olarak kurum kontrolüne gönderdi. Henüz vatandaşla paylaşılmadı.",
          member.userId,
        );
      }
    });
    return { ok: true };
  }
  async reviewInstitution(unitId: string, input: unknown, actorId?: string) {
    const action = resultReviewSchema.parse(input);
    await this.db.transaction(async (sql) => {
      const { order } = await this.lock(sql, action.orderId, { unitId });
      if (action.decision === "forward" && order.crew_state === "center_review")
        return;
      if (order.crew_state !== "institution_review")
        throw new HttpError(
          409,
          "Kurum kontrolüne gönderilmiş bir sonuç bulunmuyor.",
        );
      const stage =
        action.decision === "forward" ? "center_review" : "in_progress";
      await sql.query(
        "UPDATE institution_work_order SET crew_state=$1,review_note=$2,updated_at=now() WHERE id=$3",
        [stage, action.body, order.id],
      );
      await this.event(
        sql,
        order,
        stage,
        action.decision === "forward"
          ? `Kurum sonucu belediye merkezine iletti: ${action.body}`
          : `Kurum sonucu saha ekibine düzeltme için gönderdi: ${action.body}`,
        actorId,
      );
    });
    return { ok: true };
  }
  async reviewCenter(input: unknown, actorId?: string) {
    const action = centerReviewSchema.parse(input);
    if (action.decision === "publish") {
      const row = (
        await this.db.query(
          "SELECT report_id FROM institution_work_order WHERE id=$1",
          [action.orderId],
        )
      ).rows[0];
      if (!row) throw new HttpError(404, "Görev bulunamadı.");
      return this.municipality.action(
        { type: "resolve", id: row.report_id, body: action.body },
        undefined,
        { orderId: action.orderId, actorId },
      );
    }
    await this.db.transaction(async (sql) => {
      const { order } = await this.lock(sql, action.orderId);
      if (order.crew_state !== "center_review")
        throw new HttpError(
          409,
          "Belediye onayına iletilmiş bir sonuç bulunmuyor.",
        );
      await sql.query(
        "UPDATE institution_work_order SET crew_state='institution_review',review_note=$1,updated_at=now() WHERE id=$2",
        [action.body, order.id],
      );
      await this.event(
        sql,
        order,
        "institution_review",
        `Belediye merkezi sonucu kuruma iade etti: ${action.body}`,
        actorId,
      );
    });
    return this.municipality.snapshot();
  }
}
export function fieldRouter(service: FieldService, access: StaffAccess) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    const member = await access.member(req);
    if (!member) throw new HttpError(401, "Saha hesabınızla giriş yapın.");
    if (member.role !== "crew")
      throw new HttpError(403, "Saha ekibi yetkisi gerekiyor.");
    res.locals.member = member;
    next();
  });
  router.get("/workspace", async (_req, res) =>
    res.json(await service.workspace(res.locals.member)),
  );
  router.post("/actions", express.json({ limit: "16kb" }), async (req, res) =>
    res.json(await service.action(res.locals.member, req.body)),
  );
  return router;
}
