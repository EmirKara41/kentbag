import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import type { Auth } from "./auth.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import type { PhotoStore } from "./photos.ts";
import { createAccess, type Access } from "./access.ts";
import { errorHandler } from "./errors.ts";
import { fallbackTravelMinutes, type Point } from "@kentbag/shared";
import { createAgent, type Agent, type AsyncTravel, type Classify } from "./agent.ts";
import type { ChangeHook } from "./requests.ts";
import { citizenRoutes } from "./citizen.ts";
import { crewRoutes } from "./crew.ts";
import { staffRoutes } from "./staff.ts";
import { recomputeTeamEta } from "./eta.ts";
import { pushHook, pushRoutes, type PushSend } from "./push.ts";

export type ServerOptions = {
  db: Db;
  auth: Auth;
  config: Config;
  photos: PhotoStore;
  now?: () => Date;
  geocode?: (address: string) => Promise<Point | null>;
  travel?: AsyncTravel;
  classify?: Classify;
  classifyTimeoutMs?: number;
  pushSend?: PushSend;
};

export type AgentApi = { processRequest(id: string): Promise<void> };

export type Context = ServerOptions & {
  access: Access;
  now: () => Date;
  geocode: (address: string) => Promise<Point | null>;
  hooks: ChangeHook[];
  agent: AgentApi;
  agentService: Agent;
  travel: AsyncTravel;
  /** Called when a team's location, shift or queue changes (ETA refresh). */
  teamChanged: (teamId: string) => Promise<void>;
};

/** Wraps async route handlers so thrown errors reach the error handler. */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function createServer(options: ServerOptions): { app: Express; ctx: Context } {
  const ctx: Context = {
    ...options,
    access: createAccess(options.db, options.auth),
    now: options.now ?? (() => new Date()),
    geocode: options.geocode ?? (async () => null),
    hooks: [],
    travel: options.travel ?? (async (a, b) => fallbackTravelMinutes(a, b)),
  } as unknown as Context;
  ctx.teamChanged = (teamId) => recomputeTeamEta(ctx, teamId);
  ctx.hooks.push(async ({ before, after }) => {
    for (const teamId of new Set([before.teamId, after.teamId])) if (teamId) await ctx.teamChanged(teamId);
  });
  if (options.pushSend) ctx.hooks.push(pushHook(ctx.db, options.pushSend));
  ctx.agentService = createAgent({
    db: ctx.db,
    hooks: ctx.hooks,
    now: ctx.now,
    travel: ctx.travel,
    classify: options.classify,
    classifyTimeoutMs: options.classifyTimeoutMs,
  });
  ctx.agent = ctx.agentService;
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

  app.use("/api", citizenRoutes(ctx));
  app.use("/api", crewRoutes(ctx));
  app.use("/api", staffRoutes(ctx));
  app.use("/api", pushRoutes(ctx));
  app.use("/api", (_req, res) => void res.status(404).json({ error: "Bulunamadı." }));
  app.use(errorHandler);
  return { app, ctx };
}
