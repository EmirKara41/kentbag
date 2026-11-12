import { institutionIds, type InstitutionId } from "@kentbag/shared";
import type { Db } from "./db.ts";

const key = (scope: "center" | InstitutionId) => (scope === "center" ? "agent.center" : `agent.institution.${scope}`);

async function read(db: Db, scope: "center" | InstitutionId): Promise<boolean> {
  const { rows } = await db.query("SELECT value FROM setting WHERE key=$1", [key(scope)]);
  return rows[0] ? rows[0].value === true : true;
}

export const centerAgentOn = (db: Db) => read(db, "center");

/** The agent acts on an institution only when both the center and that institution allow it. */
export async function agentEnabled(db: Db, institution: InstitutionId) {
  return (await read(db, "center")) && (await read(db, institution));
}

export async function setAgent(db: Db, scope: "center" | InstitutionId, on: boolean) {
  await db.query(
    "INSERT INTO setting (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
    [key(scope), JSON.stringify(on)],
  );
}

export async function agentSettings(db: Db) {
  const institutions = {} as Record<InstitutionId, boolean>;
  for (const id of institutionIds) institutions[id] = await read(db, id);
  return { center: await read(db, "center"), institutions };
}
