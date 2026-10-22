import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./database.js";
import { HttpError } from "./validation.js";
import { categories, statuses } from "./municipality-domain.js";

export const publicAreas = [
  "Oltu",
  "Aslanpaşa",
  "Cumhuriyet",
  "Halitpaşa",
  "Karabekir",
  "Şehitler",
  "Yasin Haşimoğlu",
  "Yusuf Ziyabey",
  "Ayyıldız",
] as const;
export const sharingSchema = z.object({
  enabled: z.boolean(),
  area: z.enum(publicAreas).default("Oltu"),
});
export const browseSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    area: z.enum(publicAreas).optional(),
    category: z
      .enum(
        Object.keys(categories) as [
          keyof typeof categories,
          ...(keyof typeof categories)[],
        ],
      )
      .optional(),
  })
  .refine((q) => (q.latitude === undefined) === (q.longitude === undefined));
const active = (d: any) =>
  !["withdrawn", "closed", "resolved"].includes(d.status) ||
  (d.feedback?.outcome === "persists" && d.status !== "withdrawn");
export class CommunityService {
  constructor(readonly db: Database) {}
  async publish(sql: Sql, doc: any, enabled: boolean, area: string) {
    if (enabled && doc.status === "withdrawn")
      throw new HttpError(409, "Geri çekilmiş talep paylaşılamaz.");
    const existing = (
      await sql.query("SELECT id FROM community_issue WHERE report_id=$1", [
        doc.id,
      ])
    ).rows[0];
    if (existing)
      await sql.query(
        "UPDATE community_issue SET published=$1,area=$2 WHERE id=$3",
        [enabled, area, existing.id],
      );
    else if (enabled)
      await sql.query(
        "INSERT INTO community_issue(id,report_id,area) VALUES($1,$2,$3)",
        [randomUUID(), doc.id, area],
      );
    doc.sharePublicly = enabled;
    doc.publicArea = area;
  }
  private async records(sql: Sql = this.db) {
    return (
      await sql.query(`SELECT i.*,r.document,
      (SELECT count(*)::integer FROM community_subscription s WHERE s.issue_id=i.id) AS subscriptions
      FROM community_issue i JOIN citizen_report r ON r.id=i.report_id ORDER BY i.created_at DESC`)
    ).rows;
  }
  private view(row: any, userId?: string, joined = false) {
    const d = row.document,
      visible = row.published && d.status !== "withdrawn";
    const point =
      visible && d.location.source !== "manual"
        ? {
            latitude: Math.round(d.location.latitude * 1000) / 1000,
            longitude: Math.round(d.location.longitude * 1000) / 1000,
          }
        : undefined;
    // Deliberately whitelist fields: no original description/address/photo/profile/private notes.
    return {
      id: row.id,
      category: d.category,
      title: categories[d.category as keyof typeof categories].name,
      area: visible ? row.area : "",
      point,
      status: visible ? d.status : "withdrawn",
      available: visible,
      needsReview: visible && d.feedback?.outcome === "persists",
      createdAt: new Date(row.created_at).toISOString(),
      participantCount: Number(row.subscriptions) + 1,
      joined,
      own: d.ownerId === userId,
      verification: ["submitted"].includes(d.status)
        ? "unverified"
        : "institution_record",
    };
  }
  async browse(query: unknown, userId?: string) {
    const q = browseSchema.parse(query);
    const joined = new Set(
      userId
        ? (
            await this.db.query(
              "SELECT issue_id FROM community_subscription WHERE owner_id=$1",
              [userId],
            )
          ).rows.map((r) => r.issue_id)
        : [],
    );
    return (await this.records())
      .filter(
        (r) =>
          r.published &&
          active(r.document) &&
          (!q.area || q.area === "Oltu" || r.area === q.area) &&
          (!q.category || r.document.category === q.category),
      )
      .map((r) => this.view(r, userId, joined.has(r.id)))
      .map((r) => {
        const distanceKm =
          q.latitude !== undefined && q.longitude !== undefined && r.point
            ? distance(
                q.latitude,
                q.longitude,
                r.point.latitude,
                r.point.longitude,
              )
            : undefined;
        return {
          ...r,
          distanceKm:
            distanceKm === undefined
              ? undefined
              : Math.round(distanceKm * 10) / 10,
        };
      })
      .filter(
        (r) =>
          q.latitude === undefined ||
          (r.distanceKm !== undefined && r.distanceKm <= 5),
      )
      .sort(
        (a, b) =>
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      )
      .slice(0, 100);
  }
  async detail(id: string, userId?: string) {
    const row = (await this.records()).find((r) => r.id === id);
    if (!row || !row.published || row.document.status === "withdrawn")
      throw new HttpError(404, "Bu bildirim artık paylaşılmıyor.");
    const joined =
      !!userId &&
      !!(
        await this.db.query(
          "SELECT issue_id FROM community_subscription WHERE issue_id=$1 AND owner_id=$2",
          [id, userId],
        )
      ).rows.length;
    const events = (
      await this.db.query(
        "SELECT id,body,status,created_at FROM community_event WHERE issue_id=$1 ORDER BY created_at",
        [id],
      )
    ).rows.map((e) => ({
      id: e.id,
      body: e.body,
      status: e.status,
      createdAt: new Date(e.created_at).toISOString(),
    }));
    return { ...this.view(row, userId, joined), events };
  }
  async mine(userId: string) {
    const ids = new Set(
      (
        await this.db.query(
          "SELECT issue_id FROM community_subscription WHERE owner_id=$1",
          [userId],
        )
      ).rows.map((r) => r.issue_id),
    );
    return (await this.records())
      .filter((r) => ids.has(r.id))
      .map((r) => this.view(r, userId, true));
  }
  async subscribe(id: string, userId: string, enabled: boolean) {
    await this.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "SELECT i.*,r.document FROM community_issue i JOIN citizen_report r ON r.id=i.report_id WHERE i.id=$1 FOR UPDATE OF i",
          [id],
        )
      ).rows[0];
      if (!row) throw new HttpError(404, "Bildirim bulunamadı.");
      if (!enabled) {
        await sql.query(
          "DELETE FROM community_subscription WHERE issue_id=$1 AND owner_id=$2",
          [id, userId],
        );
        return;
      }
      if (!row.published || !active(row.document))
        throw new HttpError(409, "Bu bildirim artık katılıma açık değil.");
      if (row.document.ownerId === userId)
        throw new HttpError(
          409,
          "Bu zaten senin bildirimin; gelişmeleri kayıtlarından takip edebilirsin.",
        );
      const count = (
        await sql.query(
          "SELECT count(*)::integer AS count FROM community_subscription WHERE owner_id=$1",
          [userId],
        )
      ).rows[0].count;
      if (count >= 200)
        throw new HttpError(429, "Katıldığın bildirim sınırına ulaştın.");
      await sql.query(
        "INSERT INTO community_subscription(issue_id,owner_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, userId],
      );
    });
  }
  async update(
    sql: Sql,
    report: any,
    message: string,
    ownerAlreadyNotified = false,
  ) {
    const issue = (
      await sql.query(
        "SELECT id,published FROM community_issue WHERE report_id=$1",
        [report.id],
      )
    ).rows[0];
    if (!issue?.published) return;
    const eventId = randomUUID();
    await sql.query(
      "INSERT INTO community_event(id,issue_id,body,status) VALUES($1,$2,$3,$4)",
      [eventId, issue.id, message, report.status],
    );
    if (!ownerAlreadyNotified)
      report.events.push({
        id: eventId,
        body: message,
        status: report.status,
        createdAt: new Date().toISOString(),
      });
    const subscribers = (
      await sql.query(
        "SELECT owner_id FROM community_subscription WHERE issue_id=$1",
        [issue.id],
      )
    ).rows;
    if (
      !ownerAlreadyNotified &&
      !subscribers.some((s) => s.owner_id === report.ownerId)
    )
      subscribers.push({ owner_id: report.ownerId });
    for (const subscriber of subscribers) {
      const id = randomUUID();
      await sql.query(
        "INSERT INTO citizen_inbox(id,owner_id,report_id,document) VALUES($1,$2,$3,$4::jsonb)",
        [
          id,
          subscriber.owner_id,
          report.id,
          JSON.stringify({
            id,
            ownerId: subscriber.owner_id,
            ...(subscriber.owner_id === report.ownerId
              ? { reportId: report.id }
              : { issueId: issue.id }),
            communityEventId: eventId,
            title:
              subscriber.owner_id === report.ownerId
                ? "Talebinde yeni gelişme"
                : "Katıldığın bildirimde gelişme var",
            body: message,
            createdAt: new Date().toISOString(),
            read: false,
          }),
        ],
      );
    }
  }
  async status(sql: Sql, report: any) {
    await this.update(
      sql,
      report,
      `Kurum kaydındaki son durum: ${statuses[report.status as keyof typeof statuses]}.`,
    );
  }
}
function distance(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180,
    x =
      Math.sin(((c - a) * rad) / 2) ** 2 +
      Math.cos(a * rad) *
        Math.cos(c * rad) *
        Math.sin(((d - b) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
