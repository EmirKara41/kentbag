import express, { type Router } from "express";
import { z } from "zod";
import { demoAccounts } from "./seed.ts";
import { HttpError } from "./errors.ts";
import { handle, type Context } from "./server.ts";

/** One-tap demo sign-in for the presentation. Off unless a demo password is configured. */
export function demoRoutes(ctx: Context, password: string | undefined): Router {
  const router = express.Router();
  const accounts = demoAccounts();

  router.get("/demo/accounts", (_req, res) => {
    if (!password) return void res.status(404).json({ error: "Bulunamadı." });
    res.json({ accounts: accounts.map(({ key, label, role, app, institution, teamId }) => ({ key, label, role, app, institution, teamId })) });
  });

  router.post(
    "/demo/login",
    handle(async (req, res) => {
      if (!password) throw new HttpError(404, "Bulunamadı.");
      const { key } = z.object({ key: z.string().max(60) }).parse(req.body);
      const account = accounts.find((a) => a.key === key);
      if (!account) throw new HttpError(404, "Demo hesabı bulunamadı.");
      const response = await ctx.auth.handler(
        new Request(`${ctx.config.baseUrl}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: ctx.config.baseUrl },
          body: JSON.stringify({ email: account.email, password }),
        }),
      );
      const token = response.headers.get("set-auth-token");
      if (!response.ok || !token) throw new HttpError(503, "Demo girişi şu anda yapılamıyor.");
      res.json({ token, role: account.role, app: account.app });
    }),
  );
  return router;
}
