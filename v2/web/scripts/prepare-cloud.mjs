// Packs the built site (dist/) and the APK download page into Vercel's Build Output format.
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const out = new URL("../.vercel/output/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(new URL("static/indir/", out), { recursive: true });
await cp(new URL("../dist/", import.meta.url), new URL("static/", out), { recursive: true });

const artifacts = new URL("../../artifacts/", import.meta.url);
const files = (await readdir(artifacts).catch(() => [])).filter((f) => f.endsWith(".apk"));
const latest = (prefix) => files.filter((f) => f.startsWith(prefix)).sort().at(-1);
const apps = [
  { file: latest("KentBag-Vatandas-"), title: "KentBağ", who: "Vatandaşlar için: sorun bildir, ekibi yolda gör." },
  { file: latest("KentBag-Ekip-"), title: "KentBağ Ekip", who: "Saha ekipleri için: iş sırası, yola çıktım, vardım, bitti." },
].filter((a) => a.file);
const rows = [];
for (const a of apps) {
  const bytes = await readFile(new URL(a.file, artifacts));
  await cp(new URL(a.file, artifacts), new URL(`static/indir/${a.file}`, out));
  const sha = createHash("sha256").update(bytes).digest("hex");
  const mb = ((await stat(new URL(a.file, artifacts))).size / 1048576).toFixed(1);
  rows.push(`<section><h2>${a.title}</h2><p>${a.who}</p><a class="dl" href="${a.file}" download>${a.file} · ${mb} MB</a><details><summary>SHA-256</summary><code>${sha}</code></details></section>`);
}
await writeFile(
  new URL("static/indir/index.html", out),
  `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>KentBağ · Android uygulamaları</title>
<style>body{margin:0;background:#eef2f4;color:#1d262b;font:17px/1.6 system-ui,sans-serif;padding:24px}main{max-width:520px;margin:auto;display:grid;gap:16px}section{background:#fff;border:1px solid #d5dde1;border-radius:12px;padding:20px}h1{margin:0}h2{margin:0 0 4px}.dl{display:block;margin-top:12px;background:#1d262b;color:#fff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700}code{font-size:12px;overflow-wrap:anywhere}small{color:#4b5a62}</style>
<main><h1>KentBağ Android uygulamaları</h1>${rows.join("")}<small>Ders projesi için test imzalı paketler; Google Play yayını değildir. Kurulumda "bilinmeyen kaynaklara izin ver" gerekebilir.</small></main></html>`,
);
await writeFile(
  new URL("config.json", out),
  JSON.stringify({ version: 3, routes: [{ src: "/indir/?$", dest: "/indir/index.html" }, { handle: "filesystem" }, { src: "/(.*)", dest: "/index.html" }] }, null, 2),
);
console.log("Prepared .vercel/output with", apps.length, "APK(s)");
