import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { Config } from "./config.ts";
import { resetPasswordMail, type Mailer } from "./mail.ts";

export function createAuth(database: BetterAuthOptions["database"], config: Config, mailer?: Mailer) {
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
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!mailer) {
          console.warn("Password reset requested but no mailer is configured (RESEND_API_KEY).");
          return;
        }
        try {
          await mailer(resetPasswordMail(user.email, user.name, url));
        } catch (error) {
          // Never reveal to the caller whether the address exists or mail failed.
          console.error("Password reset mail failed", error);
        }
      },
    },
    rateLimit: {
      enabled: !config.testing,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: config.baseUrl.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
