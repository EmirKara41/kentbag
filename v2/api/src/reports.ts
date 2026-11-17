import express, { type Router } from "express";
import { z } from "zod";
import { categories, institutionIds, institutions, isOpen, statusLabel, teamById, type InstitutionId } from "@kentbag/shared";
import { handle, type Context } from "./server.ts";
import { rowToRequest } from "./requests.ts";

const DAY = 86_400_000;
const query = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) });

type Line = ReturnType<typeof rowToRequest> & {
  arrivedAt: Date | null;
  reopened: boolean;
  supportCount: number;
};

const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
const average = (values: number[]) => (values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null);

function summarize(lines: Line[]) {
  const issues = lines.filter((l) => l.kind === "issue" && l.status !== "merged");
  const arrival = issues.filter((l) => l.arrivedAt).map((l) => minutesBetween(l.createdAt, l.arrivedAt!));
  const resolution = issues.filter((l) => l.status === "resolved" && l.resolvedAt).map((l) => minutesBetween(l.createdAt, l.resolvedAt!));
  const everResolved = issues.filter((l) => l.status === "resolved" || l.reopened);
  return {
    total: lines.length,
    open: lines.filter((l) => isOpen(l.status)).length,
    resolved: lines.filter((l) => l.status === "resolved").length,
    improvements: lines.filter((l) => l.kind === "improvement").length,
    merged: lines.filter((l) => l.status === "merged").length,
    avgArrivalMinutes: average(arrival),
    avgResolutionMinutes: average(resolution),
    reopenRate: everResolved.length ? Math.round((issues.filter((l) => l.reopened).length / everResolved.length) * 100) : null,
  };
}

/** Numbers for the center and institutions; institutions see only their own requests. */
export function reportRoutes(ctx: Context): Router {
  const router = express.Router();
  const staff = (req: express.Request) => ctx.access.requireRole(req, "center", "institution");

  async function load(req: express.Request) {
    const user = await staff(req);
    const { days } = query.parse(req.query);
    const since = new Date(ctx.now().getTime() - days * DAY);
    const params: unknown[] = [since];
    let scope = "";
    if (user.role === "institution") {
      params.push(user.institution);
      scope = "AND r.institution_id=$2";
    }
    const { rows } = await ctx.db.query(
      `SELECT r.*,
         (SELECT min(e.created_at) FROM request_event e WHERE e.request_id=r.id AND e.type='arrive') AS arrived_at,
         EXISTS (SELECT 1 FROM request_event e WHERE e.request_id=r.id AND e.type='reopen') AS reopened,
         (SELECT count(*) FROM request_supporter s WHERE s.request_id=r.id) AS support_count
       FROM request r WHERE r.created_at >= $1 ${scope} ORDER BY r.created_at DESC`,
      params,
    );
    const lines: Line[] = rows.map((row) => ({
      ...rowToRequest(row),
      arrivedAt: row.arrived_at ? new Date(row.arrived_at) : null,
      reopened: row.reopened,
      supportCount: Number(row.support_count),
    }));
    return { user, days, since, lines };
  }

  router.get(
    "/staff/reports",
    handle(async (req, res) => {
      const { user, days, since, lines } = await load(req);
      const scopeIds = user.role === "institution" ? [user.institution!] : institutionIds;
      res.json({
        days,
        since,
        summary: summarize(lines),
        byInstitution: scopeIds.map((id) => ({
          institution: id,
          name: institutions[id].name,
          ...summarize(lines.filter((l) => l.institution === id)),
        })),
        byCategory: (Object.keys(categories) as (keyof typeof categories)[])
          .map((id) => ({ category: id, name: categories[id].name, kind: categories[id].kind, ...summarize(lines.filter((l) => l.category === id)) }))
          .filter((c) => c.total > 0),
        unrouted: user.role === "center" ? lines.filter((l) => !l.institution && isOpen(l.status)).length : 0,
      });
    }),
  );

  router.get(
    "/staff/reports.csv",
    handle(async (req, res) => {
      const { days, lines } = await load(req);
      const iso = (d: Date | null) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "");
      const cell = (v: unknown) => {
        const s = v == null ? "" : String(v);
        // Quote everything; neutralise spreadsheet formulas from citizen text.
        return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
      };
      const header = ["Referans", "Tür", "Kategori", "Kurum", "Ekip", "Durum", "Öncelik", "Adres", "Oluşturma (UTC)", "Varış (UTC)", "Çözüm (UTC)", "Varış süresi (dk)", "Çözüm süresi (dk)", "Destek", "Yeniden açıldı"];
      const body = lines.map((l) => [
        l.reference,
        l.kind === "improvement" ? "İyileştirme" : "Arıza",
        categories[l.category].name,
        l.institution ? institutions[l.institution as InstitutionId].name : "",
        l.teamId ? teamById(l.teamId)?.name ?? l.teamId : "",
        statusLabel(l),
        { urgent: "Acil", high: "Yüksek", normal: "Normal", low: "Düşük" }[l.priority],
        l.address,
        iso(l.createdAt),
        iso(l.arrivedAt),
        iso(l.resolvedAt),
        l.arrivedAt ? minutesBetween(l.createdAt, l.arrivedAt) : "",
        l.resolvedAt ? minutesBetween(l.createdAt, l.resolvedAt) : "",
        l.supportCount,
        l.reopened ? "Evet" : "Hayır",
      ]);
      const csv = "﻿" + [header, ...body].map((r) => r.map(cell).join(";")).join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kentbag-rapor-son-${days}-gun.csv"`);
      res.send(csv);
    }),
  );

  return router;
}
