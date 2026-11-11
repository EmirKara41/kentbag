import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { Config } from "./config.js";
import { sendPasswordReset } from './password-mail.js';
import { waitUntil } from '@vercel/functions';
export function createAuth(
  database: BetterAuthOptions["database"],
  config: Config,
  options: {sendPasswordReset?:typeof sendPasswordReset} = {},
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
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: options.sendPasswordReset ?? sendPasswordReset,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 40,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": {window:60,max:3},
        "/reset-password": {window:60,max:5},
      },
    },
    advanced: {
      ...(process.env.VERCEL ? {backgroundTasks:{handler:(task:Promise<unknown>)=>waitUntil(task.catch(()=>{console.error('Password reset email delivery failed.');}))}} : {}),
      useSecureCookies: config.baseUrl.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
  });
}
