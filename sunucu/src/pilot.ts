import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { getMigrations } from "better-auth/db/migration";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
import { MunicipalityService } from "./municipality.js";
import { createStaffAccess } from "./staff.js";
import type { Database } from "./database.js";
import type { PhotoStore } from "./storage.js";

export function privateIPv4(host: string) {
  const parts = host.split(".").map(Number);
  return (
    parts.length === 4 &&
    parts.every((p) => Number.isInteger(p) && p >= 0 && p < 256) &&
    (parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31))
  );
}
export async function startPilot(
  options: {
    dataDir?: string;
    host?: string;
    port?: number;
    pgPort?: number;
    listenHost?: string;
    panelOrigin?: string;
    webOrigins?: string[];
  } = {},
) {
  const dataDir = resolve(options.dataDir ?? ".local");
  await mkdir(dataDir, { recursive: true });
  const port = options.port ?? Number(process.env.PORT || 3000);
  const detected = Object.values(networkInterfaces())
    .flat()
    .find(
      (n) => n?.family === "IPv4" && !n.internal && privateIPv4(n.address),
    )?.address;
  const host =
    options.host ??
    (process.env.KENT_LAN_HOST?.trim() || detected || "127.0.0.1");
  if (!privateIPv4(host) && host !== "127.0.0.1")
    throw new Error("Pilot host must be a private IPv4 address.");
  const panelOrigin = options.panelOrigin ?? "http://localhost:4280";
  async function localSecret(name: string) {
    const path = resolve(dataDir, name);
    try {
      return await readFile(path, "utf8");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      const value = randomBytes(48).toString("hex");
      await writeFile(path, value, { flag: "wx", mode: 0o600 });
      return value;
    }
  }
  const config = {
    databaseUrl: "local-persistent-postgres",
    baseUrl: `http://${host}:${port}`,
    secret: await localSecret("auth-secret"),
    webOrigins: [
      ...new Set([
        panelOrigin,
        "http://127.0.0.1:4280",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        `http://${host}:4173`,
        ...(options.webOrigins ?? []),
      ]),
    ],
  };
  const pg = new PGlite(resolve(dataDir, "postgres"));
  await pg.waitReady;
  const socket = new PGLiteSocketServer({
    db: pg,
    host: "127.0.0.1",
    port: options.pgPort ?? 5439,
    maxConnections: 1,
  });
  await socket.start();
  const pool = new Pool({
    host: "127.0.0.1",
    port: options.pgPort ?? 5439,
    database: "postgres",
    user: "postgres",
    max: 1,
    idleTimeoutMillis: 0,
  });
  const db: Database = {
    query: (text, values) => pool.query(text, values),
    async transaction(task) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await task(client);
        await client.query("COMMIT");
        return value;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
  const auth = createAuth(pool, config);
  await (await getMigrations(auth.options)).runMigrations();
  for (const file of [
    "001_citizen.sql",
    "002_municipality.sql",
    "003_community.sql",
    "004_owner_shared_updates.sql",
    "005_label_center_messages.sql",
    "006_institutions.sql",
    "007_staff.sql",
    "008_institution_mail.sql",
  ])
    await pool.query(
      await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  const photoRoot = resolve(dataDir, "photos");
  function safePath(path: string) {
    const result = resolve(photoRoot, path);
    if (!result.startsWith(photoRoot + sep))
      throw new Error("Invalid photo path");
    return result;
  }
  const photos: PhotoStore = {
    async put(path, bytes) {
      const target = safePath(path);
      await mkdir(resolve(target, ".."), { recursive: true });
      await writeFile(target, bytes);
      return path;
    },
    async get(path) {
      try {
        return await readFile(safePath(path));
      } catch (e: any) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async del(path) {
      await unlink(safePath(path)).catch((e: any) => {
        if (e.code !== "ENOENT") throw e;
      });
    },
  };
  const service = new MunicipalityService(db, config, {
    apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
  });
  await service.initialize();
  const session = async (req: import("express").Request) =>
    (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))
      ?.user ?? null;
  const app = createApp({
    db,
    config,
    photos,
    authHandler: toNodeHandler(auth),
    session,
    staff: createStaffAccess(db, session, (body) =>
      auth.api.signUpEmail({ body }),
    ),
    municipality: {
      service,
      token: await localSecret("panel-token"),
      panelOrigin,
    },
  });
  const http = await new Promise<ReturnType<typeof app.listen>>(
    (done, reject) => {
      const server = app.listen(port, options.listenHost ?? "0.0.0.0", () =>
        done(server),
      );
      server.once("error", reject);
    },
  );
  const tick = () =>
    service
      .analyzePending()
      .catch(() => console.error("Analysis worker failed; receipt retained."));
  const timer = setInterval(tick, 4000);
  timer.unref();
  void tick();
  console.log(
    `Oltu pilot API: ${config.baseUrl} · Gemini: ${service.ai.apiKey ? "configured" : "no key (rules active)"}`,
  );
  return {
    app,
    db,
    config,
    service,
    async close() {
      clearInterval(timer);
      await new Promise<void>((done, reject) =>
        http.close((e) => (e ? reject(e) : done())),
      );
      await pool.end();
      await socket.stop();
      await pg.close();
    },
  };
}
