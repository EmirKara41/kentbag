import { cp, mkdir, writeFile, rm } from "node:fs/promises";
// This path is generated CLI metadata from a previous failed Windows builder run.
await rm(".vercel/output/builds.json", { force: true });
await mkdir(".vercel/output/static", { recursive: true });
await cp("dist", ".vercel/output/static", { recursive: true });
await writeFile(
  ".vercel/output/config.json",
  JSON.stringify(
    {
      version: 3,
      routes: [
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
