// Stages a self-contained deploy folder (.deploy/) with the prebuilt bundle,
// the Vercel link and a package.json that lists only runtime dependencies.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";

const out = new URL("../.deploy/", import.meta.url);
await mkdir(out, { recursive: true });
// Empty the folder instead of deleting it: Windows keeps the folder itself busy while a shell sits in it.
for (const name of await readdir(out)) await rm(new URL(name, out), { recursive: true, force: true });
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
await writeFile(
  new URL("package.json", out),
  JSON.stringify({ name: "kentbag2-api", version: pkg.version, private: true, type: "module", dependencies: pkg.dependencies }, null, 2),
);
for (const f of ["app.js", "vercel.json", "dist", ".vercel"]) await cp(new URL(`../${f}`, import.meta.url), new URL(f, out), { recursive: true });
console.log("Staged .deploy/");
