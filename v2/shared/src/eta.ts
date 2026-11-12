import { categories } from "./catalog.ts";
import type { CategoryId, Point, RequestStatus } from "./types.ts";

const MINUTE = 60_000;
const STALE_LOCATION_MINUTES = 30;

export type TravelFn = (a: Point, b: Point) => number;

export type QueueJob = {
  requestId: string;
  status: RequestStatus;
  point: Point | null;
  category: CategoryId;
  remainingMinutes: number | null;
  remainingSetAt: Date | null;
  etaArrival: Date | null;
};

export type JobEta = { requestId: string; arrival: Date | null; finish: Date | null };

/** Straight-line distance × 1.4 road factor at 30 km/h, rounded up. */
export function fallbackTravelMinutes(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.sqrt(h));
  return Math.ceil(((km * 1.4) / 30) * 60);
}

/** Travel plus a delay margin of 20%, at least 5 minutes. */
export function withBuffer(travel: number): number {
  return travel + Math.max(5, Math.ceil(travel * 0.2));
}

const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MINUTE);

export function queueEta(input: {
  now: Date;
  teamPoint: Point | null;
  teamPointAt: Date | null;
  jobs: QueueJob[];
  travel: TravelFn;
}): JobEta[] {
  const { now, jobs, travel } = input;
  const fresh =
    input.teamPoint && input.teamPointAt && now.getTime() - input.teamPointAt.getTime() <= STALE_LOCATION_MINUTES * MINUTE;
  let cursorTime = now;
  let cursorPoint: Point | null = fresh ? input.teamPoint : null;
  let broken = false;
  const out: JobEta[] = [];
  for (const job of jobs) {
    const duration = categories[job.category].defaultMinutes;
    let arrival: Date | null = null;
    let finish: Date | null = null;
    if (broken) {
      out.push({ requestId: job.requestId, arrival, finish });
      continue;
    }
    if (job.status === "on_site") {
      const elapsed = job.remainingSetAt ? (now.getTime() - job.remainingSetAt.getTime()) / MINUTE : 0;
      const left = Math.max(5, Math.round((job.remainingMinutes ?? duration) - elapsed));
      finish = plus(now, left);
    } else if (job.status === "en_route" && job.etaArrival) {
      arrival = job.etaArrival;
      finish = plus(arrival, duration);
    } else if (cursorPoint && job.point) {
      arrival = plus(cursorTime, withBuffer(travel(cursorPoint, job.point)));
      finish = plus(arrival, duration);
    } else {
      broken = true;
    }
    out.push({ requestId: job.requestId, arrival, finish });
    if (finish) cursorTime = finish;
    if (job.point) cursorPoint = job.point;
  }
  return out;
}
