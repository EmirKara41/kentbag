import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import request from "supertest";
import type { Express } from "express";
import { createPgDb, type Db } from "../src/db.ts";
import { createAuth } from "../src/auth.ts";
import { migrate } from "../src/migrate.ts";
import { seedDemo, seedTeams } from "../src/seed.ts";
import { createServer, type ServerOptions } from "../src/server.ts";
import { memoryPhotoStore } from "../src/photos.ts";

export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
  "base64",
);
export const TEST_PASSWORD = "Test-only-password-123";
export const ORIGIN = "https://localhost";
let nextPort = 5600 + Math.floor(Math.random() * 300);

export type Headers = Record<string, string>;

export async function startTestApi(options: Partial<ServerOptions> = {}) {
  const pg = new PGlite();
  await pg.waitReady;
  const port = nextPort++;
  const socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port, maxConnections: 1 });
  await socket.start();
  const pool = new Pool({ host: "127.0.0.1", port, database: "postgres", user: "postgres", max: 1, idleTimeoutMillis: 0 });
  const db: Db = createPgDb(pool);
  const config = {
    databaseUrl: "test",
    baseUrl: "http://127.0.0.1:1",
    secret: "test-secret-test-secret-test-secret-123",
    webOrigins: ["http://localhost:5173"],
    testing: true,
  };
  const auth = createAuth(pool, config);
  await migrate(db, auth);
  await seedTeams(db);
  await seedDemo(db, auth, TEST_PASSWORD);
  const server = createServer({ db, auth, config, photos: memoryPhotoStore(), ...options });
  const app: Express = server.app;

  async function login(email: string): Promise<Headers> {
    const r = await request(app).post("/api/auth/sign-in/email").set("Origin", ORIGIN).send({ email, password: TEST_PASSWORD });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${r.text}`);
    return { Origin: ORIGIN, Authorization: `Bearer ${r.headers["set-auth-token"]}` };
  }
  async function signUpCitizen(email: string): Promise<Headers> {
    const r = await request(app)
      .post("/api/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ email, password: TEST_PASSWORD, name: "Test Vatandaşı" });
    if (r.status !== 200) throw new Error(`signup failed: ${r.status} ${r.text}`);
    return { Origin: ORIGIN, Authorization: `Bearer ${r.headers["set-auth-token"]}` };
  }
  async function close() {
    await pool.end();
    await socket.stop();
    await pg.close();
  }
  return { app, db, server, login, signUpCitizen, close };
}

export type TestApi = Awaited<ReturnType<typeof startTestApi>>;
