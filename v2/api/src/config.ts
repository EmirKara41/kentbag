export type Config = {
  databaseUrl: string;
  baseUrl: string;
  secret: string;
  webOrigins: string[];
  /** Web page that completes a password reset (default: first web origin + /sifre). */
  resetPage?: string;
  /** Test mode: disables auth rate limits. */
  testing?: boolean;
};

export function configFromEnv(env: NodeJS.ProcessEnv): Config {
  for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"] as const)
    if (!env[key]) throw new Error(`Missing server configuration: ${key}`);
  if (env.BETTER_AUTH_SECRET!.length < 32)
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 random characters.");
  const base = new URL(env.BETTER_AUTH_URL!);
  if (base.pathname !== "/" || base.search || base.hash) throw new Error("BETTER_AUTH_URL must be an origin.");
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname))
    throw new Error("HTTPS is required.");
  const webOrigins = (env.WEB_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const origin of webOrigins)
    if (new URL(origin).origin !== origin) throw new Error("WEB_ORIGINS must contain exact origins.");
  const resetPage = env.RESET_PAGE_URL || (webOrigins[0] ? `${webOrigins[0]}/sifre` : undefined);
  return { databaseUrl: env.DATABASE_URL!, baseUrl: base.origin, secret: env.BETTER_AUTH_SECRET!, webOrigins, resetPage };
}
