import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { Config } from "./config.ts";

export function createAuth(database: BetterAuthOptions["database"], config: Config) {
  return betterAuth({
    database,
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: [config.baseUrl, "https://localhost", ...config.webOrigins],
    plugins: [bearer({ requireSignature: true })],
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    rateLimit: {
      enabled: !config.testing,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: config.baseUrl.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
