import { createHash, randomUUID } from "node:crypto";
import type { Database, Sql } from "./database.js";
import { HttpError, reportSchema, profileSchema } from "./validation.js";
import { photoUrl } from "./storage.js";
import type { Config } from "./config.js";
export type CitizenUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
};
export class CitizenService {
  constructor(
    private db: Database,
    private config: Pick<Config, "baseUrl" | "secret">,
  ) {}
  async decorate(report: Record<string, any>, sql: Sql = this.db) {
    const { rows } = await sql.query(
      "SELECT id, width, height FROM citizen_photo WHERE report_id=$1 AND owner_id=$2",
      [report.id, report.ownerId],
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      ...report,
      photos: report.photos.map((id: string) => {
        const photo = byId.get(id);
        if (!photo) throw new Error("Photo metadata missing");
        return {
          id,
          width: photo.width,
          height: photo.height,
          uri: photoUrl(this.config.baseUrl, this.config.secret, id),
        };
      }),
    };
  }
  async workspace(user: CitizenUser) {
    const [profile, reports, inbox] = await Promise.all([
      this.db.query("SELECT data FROM citizen_profile WHERE owner_id=$1", [
        user.id,
      ]),
      this.db.query(
        "SELECT document FROM citizen_report WHERE owner_id=$1 ORDER BY created_at DESC",
        [user.id],
      ),
      this.db.query(
        "SELECT document FROM citizen_inbox WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 200",
        [user.id],
      ),
    ]);
    return {
      version: 1,
      sessionId: user.id,
      profiles: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          neighborhood: "",
          createdAt: new Date(user.createdAt).toISOString(),
          ...profile.rows[0]?.data,
        },
      ],
      reports: await Promise.all(
        reports.rows.map((row) => this.decorate(row.document)),
      ),
      inbox: inbox.rows.map((row) => row.document),
      drafts: {},
    };
  }
  async updateProfile(user: CitizenUser, body: unknown) {
    const data = profileSchema.parse(body);
    await this.db.query(
      "INSERT INTO citizen_profile(owner_id,data) VALUES($1,$2::jsonb) ON CONFLICT(owner_id) DO UPDATE SET data=citizen_profile.data || EXCLUDED.data",
      [user.id, JSON.stringify(data)],
    );
  }
  async submit(user: CitizenUser, body: unknown) {
    const input = reportSchema.parse(body);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.db.transaction(async (sql) => {
      await sql.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      const id = randomUUID();
      const now = new Date().toISOString();
      const message =
        "Bildirimin sisteme kaydedildi. Belediye merkezi bağlantısı henüz açık değil.";
      const document = {
        ...input,
        id,
        ownerId: user.id,
        reference: `KY-${id.slice(0, 8).toUpperCase()}`,
        status: "submitted",
        createdAt: now,
        notes: [],
        events: [
          {
            id: randomUUID(),
            status: "submitted",
            body: message,
            createdAt: now,
          },
        ],
      };
      const inserted = await sql.query(
        "INSERT INTO citizen_report(id,owner_id,request_id,fingerprint,document) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(owner_id,request_id) DO NOTHING RETURNING id",
        [id, user.id, input.requestId, fingerprint, JSON.stringify(document)],
      );
      if (!inserted.rows.length) {
        const existing = (
          await sql.query(
            "SELECT fingerprint,document FROM citizen_report WHERE owner_id=$1 AND request_id=$2",
            [user.id, input.requestId],
          )
        ).rows[0];
        if (existing.fingerprint !== fingerprint)
          throw new HttpError(
            409,
            "Bu bildirim farklı bilgilerle kaydedilmiş. Taleplerini kontrol et veya yeni bildirim aç.",
          );
        return this.decorate(existing.document, sql);
      }
      const daily = (
        await sql.query(
          "SELECT count(*)::integer AS count FROM citizen_report WHERE owner_id=$1 AND created_at > now() - interval '1 day'",
          [user.id],
        )
      ).rows[0].count;
      if (daily > 50)
        throw new HttpError(
          429,
          "Günlük bildirim sınırına ulaştın. Daha sonra tekrar dene.",
        );
      for (const photoId of input.photos) {
        const result = await sql.query(
          "UPDATE citizen_photo SET report_id=$1 WHERE id=$2 AND owner_id=$3 AND report_id IS NULL RETURNING id",
          [id, photoId, user.id],
        );
        if (!result.rows.length)
          throw new HttpError(
            400,
            "Fotoğraf bu hesaba ait değil veya başka talebe eklenmiş.",
          );
      }
      const inboxId = randomUUID();
      await sql.query(
        "INSERT INTO citizen_inbox(id,owner_id,report_id,document) VALUES($1,$2,$3,$4::jsonb)",
        [
          inboxId,
          user.id,
          id,
          JSON.stringify({
            id: inboxId,
            ownerId: user.id,
            reportId: id,
            title: "Bildirimin kaydedildi",
            body: message,
            read: false,
            createdAt: now,
          }),
        ],
      );
      return this.decorate(document, sql);
    });
  }
  async changeReport(
    user: CitizenUser,
    id: string,
    action: "note" | "withdraw",
    text?: string,
  ) {
    return this.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "SELECT document FROM citizen_report WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [id, user.id],
        )
      ).rows[0];
      if (!row) throw new HttpError(404, "Talep bulunamadı.");
      const document = row.document;
      if (action === "note") {
        if (["withdrawn", "closed"].includes(document.status))
          throw new HttpError(409, "Bu talebe not eklenemiyor.");
        if (document.notes.length >= 100)
          throw new HttpError(429, "Bu talep için not sınırına ulaşıldı.");
        document.notes.push({
          id: randomUUID(),
          text,
          createdAt: new Date().toISOString(),
        });
      } else {
        if (document.status === "withdrawn") return;
        if (document.status !== "submitted")
          throw new HttpError(409, "İşleme alınan talep geri çekilemez.");
        document.status = "withdrawn";
        document.events.push({
          id: randomUUID(),
          status: "withdrawn",
          body: "Talebi geri çektin.",
          createdAt: new Date().toISOString(),
        });
      }
      await sql.query(
        "UPDATE citizen_report SET document=$1::jsonb WHERE id=$2 AND owner_id=$3",
        [JSON.stringify(document), id, user.id],
      );
    });
  }
  async markRead(user: CitizenUser, id?: string) {
    await this.db.query(
      `UPDATE citizen_inbox SET document=jsonb_set(document,'{read}','true'::jsonb) WHERE owner_id=$1${id ? " AND id=$2" : ""}`,
      id ? [user.id, id] : [user.id],
    );
  }
  async feedback(
    user: CitizenUser,
    id: string,
    input: { outcome: "solved" | "persists"; text: string },
  ) {
    await this.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "SELECT document FROM citizen_report WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [id, user.id],
        )
      ).rows[0];
      if (!row) throw new HttpError(404, "Talep bulunamadı.");
      const document = row.document;
      if (!["resolved", "closed"].includes(document.status))
        throw new HttpError(409, "Bu talep için henüz çözüm bildirilmedi.");
      if (
        document.feedback?.outcome === input.outcome &&
        document.feedback?.text === input.text
      )
        return;
      const history =
        document.feedbackHistory ??
        (document.feedback ? [document.feedback] : []);
      if (history.length >= 50)
        throw new HttpError(429, "Bu talep için geri dönüş sınırına ulaşıldı.");
      document.feedback = { ...input, createdAt: new Date().toISOString() };
      document.feedbackHistory = [...history, document.feedback];
      await sql.query(
        "UPDATE citizen_report SET document=$1::jsonb WHERE id=$2 AND owner_id=$3",
        [JSON.stringify(document), id, user.id],
      );
    });
  }
}
