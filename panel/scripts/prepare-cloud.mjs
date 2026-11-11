import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
// This path is generated CLI metadata from a previous failed Windows builder run.
await rm(".vercel/output/builds.json", { force: true });
await mkdir(".vercel/output/static", { recursive: true });
await cp("dist", ".vercel/output/static", { recursive: true });
await cp("../saha/dist", ".vercel/output/static/saha", { recursive: true });
if (existsSync("../saha/artifacts/download/index.html")) {
  await cp("../saha/artifacts/download", ".vercel/output/static/saha/indir", { recursive: true });
}
if (existsSync("../mobil/artifacts/download/index.html")) {
  await cp("../mobil/artifacts/download", ".vercel/output/static/indir", {
    recursive: true,
  });
}
await writeFile(
  ".vercel/output/config.json",
  JSON.stringify(
    {
      version: 3,
      routes: [
        {src:'/sifre-sifirla/?$',dest:'/index.html',headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}},
        { src: "/saha$", status: 308, headers: { Location: "/saha/" } },
        { src: "/saha/indir/?$", dest: "/saha/indir/index.html" },
        { src: "/saha/$", dest: "/saha/index.html" },
        { src: "/indir/?$", dest: "/indir/index.html" },
        {
          src: "/api/(.*)",
          dest: "https://kentbag-api-emir-kara-s-projects.vercel.app/api/$1",
        },
        { handle: "filesystem" },
        { src: "/.*", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log("Verified Vite assets prepared for Vercel Build Output API.");
