// Bundles the API for Vercel. npm dependencies stay external; the workspace
// package @kentbag/shared (TypeScript source) is bundled in.
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => name !== "@kentbag/shared");
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.js",
  external,
});
console.log("Built dist/server.js");
