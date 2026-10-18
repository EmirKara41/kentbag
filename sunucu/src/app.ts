import express, {
  type RequestHandler,
  type ErrorRequestHandler,
} from "express";
import cors from "cors";
import { randomUUID, createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { z, ZodError } from "zod";
import type { Config } from "./config.js";
import type { Database } from "./database.js";
import type { PhotoStore } from "./storage.js";
import { verifyPhotoSignature } from "./storage.js";
import { CitizenService, type CitizenUser } from "./citizen.js";
import { HttpError } from "./validation.js";

export function createApp(deps: {
  db: Database;
  config: Config;
  photos: PhotoStore;
  authHandler: RequestHandler;
  session: (req: express.Request) => Promise<CitizenUser | null>;
}) {
  const { db, config, photos } = deps;
  const service = new CitizenService(db, config);
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    next();
  });
  const origins = [config.baseUrl, "https://localhost", ...config.webOrigins];
  app.use(
    cors({
      origin: origins,
      credentials: true,
      exposedHeaders: ["set-auth-token"],
      methods: ["GET", "POST", "PATCH", "PUT", "OPTIONS"],
    }),
  );
  app.use((req, res, next) => {
    if (req.headers.origin && !origins.includes(req.headers.origin)) {
      res.status(403).json({ error: "Bu kaynaktan erişim izni yok." });
      return;
    }
    next();
  });
  app.get("/", (_req, res) =>
    res
      .type("text")
      .send("KentYanımda vatandaş API. Belediye merkezi henüz bağlı değil."),
  );
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT id FROM citizen_report LIMIT 1");
    res.json({
      ok: true,
      service: "kentyanimda-api",
      municipalityConnected: false,
    });
  });
  app.all("/api/auth/*splat", (req, res, next) => {
    // Local Express exposes the socket address; Vercel supplies an overwritten, trusted IP header.
    if (!process.env.VERCEL)
      req.headers["x-vercel-forwarded-for"] = req.socket.remoteAddress;
    deps.authHandler(req, res, next);
  });
  app.get("/api/photos/:id", async (req, res) => {
    const id = String(req.params.id);
    if (
      !verifyPhotoSignature(
        config.secret,
        id,
        req.query.expires,
        req.query.signature,
      )
    )
      throw new HttpError(
        403,
        "Fotoğraf bağlantısının süresi dolmuş. Taleplerini yenile.",
      );
    const row = (
      await db.query(
        "SELECT pathname FROM citizen_photo WHERE id=$1 AND report_id IS NOT NULL",
        [id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, "Fotoğraf bulunamadı.");
    const buffer = await photos.get(row.pathname);
    if (!buffer) throw new HttpError(404, "Fotoğraf bulunamadı.");
    const mime = await fileTypeFromBuffer(buffer);
    res.type(mime?.mime || "application/octet-stream").send(buffer);
  });
  app.use("/api", async (req, res, next) => {
    const user = await deps.session(req);
    if (!user) throw new HttpError(401, "Oturum sona erdi. Yeniden giriş yap.");
    if (req.headers["x-citizen-id"] && req.headers["x-citizen-id"] !== user.id)
      throw new HttpError(409, "Oturum değişti. Yeniden giriş yap.");
    res.locals.user = user;
    next();
  });
  app.put(
    "/api/photos/:clientId",
    express.raw({ type: ["image/jpeg", "image/png"], limit: "3mb" }),
    async (req, res) => {
      const user = res.locals.user as CitizenUser;
      const clientId = z.string().min(1).max(220).parse(req.params.clientId);
      if (!Buffer.isBuffer(req.body) || req.body.length < 10)
        throw new HttpError(400, "Geçerli bir fotoğraf yükle.");
      const type = await fileTypeFromBuffer(req.body).catch(() => undefined);
      if (!type || !["image/jpeg", "image/png"].includes(type.mime))
        throw new HttpError(
          400,
          "Yalnızca JPEG veya PNG fotoğraf kabul edilir.",
        );
      let size;
      try {
        size = imageSize(req.body);
      } catch {
        throw new HttpError(400, "Fotoğraf okunamadı.");
      }
      if (!size.width || !size.height || size.width * size.height > 20000000)
        throw new HttpError(400, "Fotoğraf boyutu uygun değil.");
      const digest = createHash("sha256").update(req.body).digest("hex");
      let stored: string | undefined;
      try {
        const id = await db.transaction(async (sql) => {
          await sql.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
            user.id,
          ]);
          const existing = (
            await sql.query(
              "SELECT id,digest FROM citizen_photo WHERE owner_id=$1 AND client_id=$2",
              [user.id, clientId],
            )
          ).rows[0];
          if (existing) {
            if (existing.digest !== digest)
              throw new HttpError(
                409,
                "Bu fotoğraf kimliği farklı içerikle kullanılmış.",
              );
            return existing.id;
          }
          const count = (
            await sql.query(
              "SELECT count(*)::integer AS count FROM citizen_photo WHERE owner_id=$1 AND created_at > now() - interval '1 day'",
              [user.id],
            )
          ).rows[0].count;
          if (count >= 30)
            throw new HttpError(
              429,
              "Günlük fotoğraf sınırına ulaştın. Daha sonra tekrar dene.",
            );
          const id = randomUUID();
          stored = await photos.put(
            `citizen/${user.id}/${id}.${type.ext}`,
            req.body,
            type.mime,
          );
          await sql.query(
            "INSERT INTO citizen_photo(id,owner_id,client_id,pathname,digest,width,height) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [id, user.id, clientId, stored, digest, size.width, size.height],
          );
          return id;
        });
        res.json({ id });
      } catch (error) {
        if (stored) await photos.del(stored).catch(() => undefined);
        throw error;
      }
    },
  );
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/workspace", async (_req, res) =>
    res.json(await service.workspace(res.locals.user)),
  );
  app.patch("/api/profile", async (req, res) => {
    await service.updateProfile(res.locals.user, req.body);
    res.json({ ok: true });
  });
  app.post("/api/reports", async (req, res) =>
    res.json(await service.submit(res.locals.user, req.body)),
  );
  app.post("/api/reports/:id/notes", async (req, res) => {
    const { text } = z
      .object({ text: z.string().trim().min(2).max(1000) })
      .parse(req.body);
    await service.changeReport(
      res.locals.user,
      String(req.params.id),
      "note",
      text,
    );
    res.json({ ok: true });
  });
  app.post("/api/reports/:id/withdraw", async (req, res) => {
    await service.changeReport(
      res.locals.user,
      String(req.params.id),
      "withdraw",
    );
    res.json({ ok: true });
  });
  app.post("/api/reports/:id/feedback", async (req, res) => {
    const input = z
      .object({
        outcome: z.enum(["solved", "persists"]),
        text: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);
    await service.feedback(res.locals.user, String(req.params.id), input);
    res.json({ ok: true });
  });
  app.post("/api/inbox/read", async (req, res) => {
    const { id } = z
      .object({ id: z.string().uuid().optional() })
      .parse(req.body);
    await service.markRead(res.locals.user, id);
    res.json({ ok: true });
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "Bu adres bulunamadı." }),
  );
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError || error.type === "entity.parse.failed"
          ? 400
          : error.type === "entity.too.large"
            ? 413
            : 503;
    if (status === 503)
      console.error("API operation failed", {
        code: typeof error.code === "string" ? error.code : "internal",
      });
    res.status(status).json({
      error:
        error instanceof HttpError
          ? error.message
          : status === 400
            ? "Gönderilen bilgileri kontrol et."
            : status === 413
              ? "Dosya boyutu sınırı aşıldı."
              : "Sunucuya şu anda ulaşılamıyor. Taslağını koruyup yeniden dene.",
    });
  };
  app.use(onError);
  return app;
}
