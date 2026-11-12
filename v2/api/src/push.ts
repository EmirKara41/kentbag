import express, { type Router } from "express";
import { z } from "zod";
import { categories, institutions, teamById, type CitizenRequest, type RequestStatus } from "@kentbag/shared";
import type { Db } from "./db.ts";
import type { ChangeHook } from "./requests.ts";
import { handle, type Context } from "./server.ts";

export type PushMessage = { title: string; body: string; data: { requestId: string; target: "citizen" | "crew" } };
export type PushSend = (tokens: string[], msg: PushMessage) => Promise<{ invalidTokens: string[] }>;

/** FCM sender from a base64 service-account JSON; undefined when not configured. */
export async function firebaseSend(serviceAccountBase64: string | undefined): Promise<PushSend | undefined> {
  if (!serviceAccountBase64) return undefined;
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");
  const account = JSON.parse(Buffer.from(serviceAccountBase64, "base64").toString("utf8"));
  const app = getApps()[0] ?? initializeApp({ credential: cert(account) });
  return async (tokens, msg) => {
    const result = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title: msg.title, body: msg.body },
      data: msg.data,
      android: { priority: "high", notification: { channelId: "kentbag" } },
    });
    const invalidTokens = result.responses
      .map((r) => (r.success ? null : r.error?.code))
      .flatMap((code, i) =>
        code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" ? [tokens[i]] : [],
      );
    return { invalidTokens };
  };
}

const citizenTitle: Partial<Record<RequestStatus, string>> = {
  routed: "Talebiniz iletildi",
  assigned: "Ekip atandı",
  en_route: "Ekip yolda",
  on_site: "Ekip sahada",
  resolved: "Sorununuz çözüldü",
  returned: "Talebiniz yeniden atanıyor",
  cancelled: "Talebiniz iptal edildi",
};

async function tokensFor(db: Db, userIds: string[]) {
  if (!userIds.length) return [];
  const { rows } = await db.query("SELECT token FROM push_token WHERE enabled AND user_id = ANY($1)", [userIds]);
  return rows.map((r) => r.token as string);
}

async function crewUserIds(db: Db, teamId: string) {
  const { rows } = await db.query("SELECT user_id FROM staff WHERE team_id=$1 AND active", [teamId]);
  return rows.map((r) => r.user_id as string);
}

const place = (r: CitizenRequest) => r.address || "Haritada işaretli konum";

export function pushHook(db: Db, send: PushSend): ChangeHook {
  async function deliver(userIds: string[], msg: PushMessage) {
    const tokens = await tokensFor(db, userIds);
    if (!tokens.length) return;
    try {
      const { invalidTokens } = await send(tokens, msg);
      if (invalidTokens.length) await db.query("DELETE FROM push_token WHERE token = ANY($1)", [invalidTokens]);
    } catch (error) {
      console.error("Push delivery failed", error);
    }
  }
  return async ({ before, after, event }) => {
    if (event.public && event.actorRole !== "citizen" && citizenTitle[after.status]) {
      await deliver([after.citizenId], {
        title: citizenTitle[after.status]!,
        body: `${after.reference} · ${event.body}`,
        data: { requestId: after.id, target: "citizen" },
      });
    }
    if (after.teamId && after.teamId !== before.teamId) {
      await deliver(await crewUserIds(db, after.teamId), {
        title: `Yeni iş: ${categories[after.category].name}`,
        body: `${place(after)} · ${after.priority === "urgent" ? "ACİL · " : ""}${after.reference}`,
        data: { requestId: after.id, target: "crew" },
      });
    }
    if (before.teamId && before.teamId !== after.teamId && event.actorRole !== "crew") {
      const team = teamById(before.teamId);
      await deliver(await crewUserIds(db, before.teamId), {
        title: "İş sıranız değişti",
        body: `${after.reference} artık ${team ? "ekibinizde" : "sizde"} değil${after.institution ? ` (${institutions[after.institution].name})` : ""}.`,
        data: { requestId: after.id, target: "crew" },
      });
    }
  };
}

export function pushRoutes(ctx: Context): Router {
  const router = express.Router();
  router.post(
    "/push/token",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const { token, enabled } = z.object({ token: z.string().min(10).max(4096), enabled: z.boolean() }).parse(req.body);
      await ctx.db.query(
        `INSERT INTO push_token (token, user_id, enabled, updated_at) VALUES ($1,$2,$3,now())
         ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id, enabled=EXCLUDED.enabled, updated_at=now()`,
        [token, user.userId, enabled],
      );
      res.status(204).end();
    }),
  );
  router.delete(
    "/push/token/:token",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      await ctx.db.query("DELETE FROM push_token WHERE token=$1 AND user_id=$2", [String(req.params.token), user.userId]);
      res.status(204).end();
    }),
  );
  return router;
}
