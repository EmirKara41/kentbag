import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { Config } from "./config.js";
export function createAuth(
  database: BetterAuthOptions["database"],
  config: Config,
) {
  return betterAuth({
    database,
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: [config.baseUrl, "https://localhost", ...config.webOrigins],
    plugins: [bearer({ requireSignature: true })],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 40,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: config.baseUrl.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
  });
}
