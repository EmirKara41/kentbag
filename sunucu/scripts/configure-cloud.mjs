// Run only after linking sunucu/ to the intended Vercel project and provisioning its free resources.
// Secrets go through child stdin, never command arguments or terminal output.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
process.loadEnvFile(".env.production.local");
const path = ".local/cloud-settings.env";
mkdirSync(".local", { recursive: true });
const prior = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
const pilot = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
const settings = {
  BETTER_AUTH_URL: "https://kentbag-api-emir-kara-s-projects.vercel.app",
  BETTER_AUTH_SECRET:
    prior.BETTER_AUTH_SECRET || randomBytes(48).toString("base64url"),
  PANEL_ORIGIN: "https://kentbag-panel-emir-kara-s-projects.vercel.app",
  WEB_ORIGINS:
    "https://kentbag-panel-emir-kara-s-projects.vercel.app,http://localhost:4280,http://localhost:4173",
  DEMO_MAIL_TO: "emirkara@lollore.com",
  MAIL_FROM: "KentBağ <bildirim@lollore.com>",
  GEMINI_MODEL: "gemini-3.5-flash-lite",
  ...(pilot.GEMINI_API_KEY ? { GEMINI_API_KEY: pilot.GEMINI_API_KEY } : {}),
};
writeFileSync(
  path,
  Object.entries(settings)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
for (const [key, value] of Object.entries(settings)) {
  const result = spawnSync(
    "npx.cmd",
    [
      "--yes",
      "vercel@65.11.0",
      "env",
      "add",
      key,
      "--environment",
      "production",
      "--force",
      "--yes",
      "--type",
      key.endsWith("SECRET") || key.endsWith("API_KEY") ? "secret" : "config",
      "--scope",
      "emir-kara-s-projects",
    ],
    { input: value, encoding: "utf8", shell: true, windowsHide: true },
  );
  if (result.status !== 0) {
    console.error(`Could not configure ${key}; no secret output printed.`);
    process.exit(1);
  }
  console.log(`${key}: configured`);
}
