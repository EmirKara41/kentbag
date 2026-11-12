import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import type { Auth } from "./auth.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import type { PhotoStore } from "./photos.ts";
import { createAccess, type Access } from "./access.ts";
import { errorHandler } from "./errors.ts";

export type ServerOptions = {
  db: Db;
  auth: Auth;
  config: Config;
  photos: PhotoStore;
  now?: () => Date;
};

export type Context = ServerOptions & { access: Access; now: () => Date };

/** Wraps async route handlers so thrown errors reach the error handler. */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function createServer(options: ServerOptions): { app: Express; ctx: Context } {
  const ctx: Context = { ...options, access: createAccess(options.db, options.auth), now: options.now ?? (() => new Date()) };
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  const origins = new Set([options.config.baseUrl, "https://localhost", ...options.config.webOrigins]);
  app.use(
    cors({
      origin: (origin, done) => done(null, !origin || origins.has(origin)),
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["set-auth-token"],
    }),
  );
  app.all("/api/auth/*splat", toNodeHandler(options.auth));

  app.get("/api/health", (_req, res) => void res.json({ ok: true, version: "2.0.0" }));
  app.use(express.json({ limit: "64kb" }));

  app.get(
    "/api/me",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      res.json({ role: user.role, name: user.name, email: user.email, institution: user.institution, teamId: user.teamId });
    }),
  );

  app.use("/api", (_req, res) => void res.status(404).json({ error: "Bulunamadı." }));
  app.use(errorHandler);
  return { app, ctx };
}
