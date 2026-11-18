/**
 * Measures the photo-relevance check (the same geminiJudge the API uses) on a small labelled set.
 * Run: GEMINI_API_KEY=... npm run eval:photos -w @kentbag/api   (optional: GEMINI_VISION_MODEL)
 * Writes eval/results.json and eval/RESULTS.md. One request per case, ~4.5 s apart (free-tier rate limit).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { CategoryId } from "@kentbag/shared";
import { geminiJudge, withTimeout, type PhotoCheck } from "../src/vision.ts";

type Verdict = PhotoCheck["verdict"];
type Case = { id: string; photo: string; category: CategoryId; description: string; expected: Verdict; group: string };

const here = dirname(fileURLToPath(import.meta.url));
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is required");
const model = process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash-lite";
const judge = geminiJudge(key, model);
const cases: Case[] = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const verdicts: Verdict[] = ["ok", "doubtful", "unrelated"];

const rows: (Case & { got: Verdict | "error"; note: string; ms: number })[] = [];
for (const c of cases) {
  const bytes = readFileSync(join(here, "photos", c.photo));
  const mime = c.photo.endsWith(".png") ? "image/png" : "image/jpeg";
  const t = performance.now();
  try {
    const r = await withTimeout(judge.relevance({ category: c.category, description: c.description, photos: [{ bytes, mime }] }), 30_000);
    rows.push({ ...c, got: r.verdict, note: r.note, ms: Math.round(performance.now() - t) });
  } catch (e) {
    rows.push({ ...c, got: "error", note: String(e instanceof Error ? e.message : e).slice(0, 160), ms: Math.round(performance.now() - t) });
  }
  const last = rows[rows.length - 1];
  console.log(`${last.got === last.expected ? "✓" : "✗"} ${c.id.padEnd(13)} beklenen=${c.expected.padEnd(9)} sonuç=${String(last.got).padEnd(9)} ${last.ms} ms`);
  await new Promise((s) => setTimeout(s, 4500));
}

const done = rows.filter((r) => r.got !== "error");
const matrix = verdicts.map((e) => verdicts.map((g) => done.filter((r) => r.expected === e && r.got === g).length));
const exact = done.filter((r) => r.got === r.expected).length;
// The decision the system actually takes: "unrelated" holds automatic assignment.
const tp = done.filter((r) => r.expected === "unrelated" && r.got === "unrelated").length;
const fp = done.filter((r) => r.expected !== "unrelated" && r.got === "unrelated").length;
const fn = done.filter((r) => r.expected === "unrelated" && r.got !== "unrelated").length;
const realOk = done.filter((r) => r.expected === "ok");
const ms = done.map((r) => r.ms).sort((a, b) => a - b);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : "-");
const summary = {
  model,
  date: new Date().toISOString(),
  cases: rows.length,
  errors: rows.length - done.length,
  exactAccuracy: pct(exact, done.length),
  unrelated: { precision: pct(tp, tp + fp), recall: pct(tp, tp + fn), tp, fp, fn },
  realProblemsPassed: pct(realOk.filter((r) => r.got === "ok").length, realOk.length),
  realProblemsWronglyHeld: realOk.filter((r) => r.got === "unrelated").length,
  latencyMs: { median: ms[Math.floor(ms.length / 2)] ?? null, mean: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null, max: ms.at(-1) ?? null },
  baselineNoAi: { unrelatedRecall: "0%", note: "Kontrol yokken her fotoğraf kabul edilir; alakasız fotoğrafların hiçbiri yakalanmaz." },
};
writeFileSync(join(here, "results.json"), JSON.stringify({ summary, matrix: { labels: verdicts, rows: matrix }, rows }, null, 2));

const md = [
  `# Fotoğraf kontrolü ölçümü`,
  ``,
  `Model: \`${model}\` · ${rows.length} durum · ${summary.date.slice(0, 16).replace("T", " ")} UTC`,
  ``,
  `| Ölçü | Değer |`,
  `|---|---|`,
  `| Tam doğruluk (3 sınıf) | ${summary.exactAccuracy} (${exact}/${done.length}) |`,
  `| "Alakasız" kesinlik | ${summary.unrelated.precision} |`,
  `| "Alakasız" duyarlılık | ${summary.unrelated.recall} |`,
  `| Gerçek sorunların geçme oranı | ${summary.realProblemsPassed} |`,
  `| Yanlışlıkla bekletilen gerçek sorun | ${summary.realProblemsWronglyHeld} |`,
  `| Yanıt süresi (medyan / ort. / en çok) | ${summary.latencyMs.median} / ${summary.latencyMs.mean} / ${summary.latencyMs.max} ms |`,
  `| Hata / zaman aşımı | ${summary.errors} |`,
  ``,
  `Karşılaştırma noktası: YZ kontrolü yokken alakasız fotoğrafların %0'ı yakalanır.`,
  ``,
  `## Karışıklık matrisi (satır: beklenen, sütun: model)`,
  ``,
  `| | ok | doubtful | unrelated |`,
  `|---|---|---|---|`,
  ...verdicts.map((v, i) => `| **${v}** | ${matrix[i].join(" | ")} |`),
  ``,
  `## Durumlar`,
  ``,
  `| Durum | Grup | Kategori | Beklenen | Sonuç | ms | Modelin notu |`,
  `|---|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.got === r.expected ? "✓" : "✗"} ${r.id} | ${r.group} | ${r.category} | ${r.expected} | ${r.got} | ${r.ms} | ${r.note.replace(/\|/g, "/").replace(/\n/g, " ")} |`),
  ``,
].join("\n");
writeFileSync(join(here, "RESULTS.md"), md);
console.log(JSON.stringify(summary, null, 2));
