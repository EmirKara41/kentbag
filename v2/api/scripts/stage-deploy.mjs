// Stages a self-contained deploy folder (.deploy/) with the prebuilt bundle,
// the Vercel link and a package.json that lists only runtime dependencies.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const out = new URL("../.deploy/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
await writeFile(
  new URL("package.json", out),
  JSON.stringify({ name: "kentbag2-api", version: pkg.version, private: true, type: "module", dependencies: pkg.dependencies }, null, 2),
);
for (const f of ["app.js", "vercel.json", "dist", ".vercel"]) await cp(new URL(`../${f}`, import.meta.url), new URL(f, out), { recursive: true });
console.log("Staged .deploy/");
