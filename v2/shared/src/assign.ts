import { queueEta, type QueueJob, type TravelFn } from "./eta.ts";
import type { CategoryId, Point, Priority } from "./types.ts";

export type CandidateTeam = {
  id: string;
  name: string;
  onShift: boolean;
  active: boolean;
  point: Point | null;
  pointAt: Date | null;
  jobs: QueueJob[];
};

export type TeamChoice = { teamId: string; position: number; arrival: Date | null; reason: string };

export const clock = (d: Date) =>
  new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(d);

/** Index where a new job enters the queue: urgent goes right after the job in hand. */
function insertIndex(jobs: QueueJob[], priority: Priority) {
  if (priority !== "urgent") return jobs.length;
  const inHand = jobs.findIndex((j) => j.status === "on_site" || j.status === "en_route");
  return inHand === -1 ? 0 : inHand + 1;
}

export function chooseTeam(input: {
  now: Date;
  request: { id: string; point: Point | null; category: CategoryId; priority: Priority };
  teams: CandidateTeam[];
  travel: TravelFn;
}): TeamChoice | null {
  const { now, request, travel } = input;
  const candidates = input.teams
    .filter((t) => t.active && t.onShift)
    .map((team) => {
      const index = insertIndex(team.jobs, request.priority);
      const newJob: QueueJob = {
        requestId: request.id,
        status: "assigned",
        point: request.point,
        category: request.category,
        remainingMinutes: null,
        remainingSetAt: null,
        etaArrival: null,
      };
      const jobs = [...team.jobs.slice(0, index), newJob, ...team.jobs.slice(index)];
      const eta = queueEta({ now, teamPoint: team.point, teamPointAt: team.pointAt, jobs, travel });
      return { team, position: index + 1, arrival: eta[index].arrival, queueLength: team.jobs.length };
    });
  if (!candidates.length) return null;
  const timed = candidates.filter((c) => c.arrival);
  const pick = timed.length
    ? timed.sort((a, b) => a.arrival!.getTime() - b.arrival!.getTime() || a.team.id.localeCompare(b.team.id))[0]
    : candidates.sort((a, b) => a.queueLength - b.queueLength || a.team.id.localeCompare(b.team.id))[0];
  const reason = pick.arrival
    ? `${pick.team.name} seçildi: sırada ${pick.position}. iş, tahmini varış ${clock(pick.arrival)}.`
    : `${pick.team.name} seçildi: varış süresi hesaplanamadı, en kısa sıra seçildi (sırada ${pick.position}. iş).`;
  return { teamId: pick.team.id, position: pick.position, arrival: pick.arrival, reason };
}

