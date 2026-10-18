export function configFromEnv(env: NodeJS.ProcessEnv) {
  const required = [
    "DATABASE_URL",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "BLOB_READ_WRITE_TOKEN",
  ] as const;
  for (const key of required)
    if (!env[key]) throw new Error(`Missing server configuration: ${key}`);
  if (env.BETTER_AUTH_SECRET!.length < 32)
    throw new Error(
      "BETTER_AUTH_SECRET must contain at least 32 random characters.",
    );
  const base = new URL(env.BETTER_AUTH_URL!);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  )
    throw new Error("BETTER_AUTH_URL must be an origin.");
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(base.hostname)
    )
  )
    throw new Error("HTTPS is required.");
  const webOrigins = (env.WEB_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of webOrigins) {
    if (new URL(origin).origin !== origin || origin.includes("*"))
      throw new Error("WEB_ORIGINS must contain exact origins.");
  }
  return {
    databaseUrl: env.DATABASE_URL!,
    baseUrl: base.origin,
    secret: env.BETTER_AUTH_SECRET!,
    webOrigins,
  };
}
export type Config = ReturnType<typeof configFromEnv>;
