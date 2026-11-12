import { queueEta, type Point } from "@kentbag/shared";
import type { Db } from "./db.ts";
import { loadTeams, travelTable, type AsyncTravel } from "./agent.ts";
import { teamById } from "@kentbag/shared";

/** Recomputes and stores arrival/finish estimates for every job in a team's queue. */
export async function recomputeTeamEta(deps: { db: Db; travel: AsyncTravel; now: () => Date }, teamId: string) {
  const team = teamById(teamId);
  if (!team) return;
  const candidate = (await loadTeams(deps.db, team.institution)).find((t) => t.id === teamId);
  if (!candidate || !candidate.jobs.length) return;
  const points = [candidate.point, ...candidate.jobs.map((j) => j.point)].filter(Boolean) as Point[];
  const travel = await travelTable(points, deps.travel);
  const eta = queueEta({ now: deps.now(), teamPoint: candidate.point, teamPointAt: candidate.pointAt, jobs: candidate.jobs, travel });
  for (const e of eta)
    await deps.db.query("UPDATE request SET eta_arrival=$2, eta_finish=$3 WHERE id=$1", [e.requestId, e.arrival, e.finish]);
}
