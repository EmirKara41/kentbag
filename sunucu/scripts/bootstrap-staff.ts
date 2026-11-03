import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createAuth } from "../src/auth.js";
import { configFromEnv } from "../src/config.js";
import { institutionProfiles } from "../src/institution-domain.js";
const pool = new Pool({
  connectionString: configFromEnv(process.env).databaseUrl,
  max: 1,
});
try {
  if (
    (
      await pool.query(
        "SELECT user_id FROM staff_member WHERE role='center' AND active=true LIMIT 1",
      )
    ).rows.length
  ) {
    console.log("An active center account exists; no accounts changed.");
  } else {
    const auth = createAuth(pool, configFromEnv(process.env));
    const accounts = [
      {
        name: "KentBağ Demo Merkez",
        email: "merkez@demo.kentbag.test",
        role: "center",
        unitId: null,
      },
      ...institutionProfiles.map((p) => ({
        name: `${p.name} · Demo`,
        email: `${p.slug}@demo.kentbag.test`,
        role: "institution",
        unitId: p.id,
      })),
    ];
    const credentials: unknown[] = [];
    // Save incrementally: a partial run must never lose already-created demo credentials.
    await mkdir(".local", { recursive: true });
    for (const account of accounts) {
      const password = randomBytes(18).toString("base64url");
      const created = await auth.api.signUpEmail({
        body: { name: account.name, email: account.email, password },
      });
      await pool.query(
        "INSERT INTO staff_member(user_id,role,unit_id) VALUES($1,$2,$3)",
        [created.user.id, account.role, account.unitId],
      );
      credentials.push({ ...account, password });
      await writeFile(
        ".local/cloud-staff.json",
        JSON.stringify(credentials, null, 2),
        { mode: 0o600 },
      );
    }
    console.log(
      "Demo staff accounts created. Credentials saved locally in .local/cloud-staff.json; never commit this file.",
    );
  }
} finally {
  await pool.end();
}
