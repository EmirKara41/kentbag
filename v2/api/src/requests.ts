import { randomUUID } from "node:crypto";
import {
  applyTransition,
  categories,
  institutions,
  statusLabel,
  teamById,
  type Action,
  type Actor,
  type CitizenRequest,
  type RequestEvent,
  type RequestStatus,
  TransitionError,
} from "@kentbag/shared";
import type { Db, Row } from "./db.ts";
import { HttpError } from "./errors.ts";
import { photoUrl } from "./photos.ts";

export type ChangeHook = (change: { before: CitizenRequest; after: CitizenRequest; event: RequestEvent }) => Promise<void>;

const date = (v: unknown) => (v ? new Date(v as string) : null);

export function rowToRequest(r: Row): CitizenRequest {
  return {
    id: r.id,
    reference: r.reference,
    citizenId: r.citizen_id,
    kind: r.kind,
    category: r.category,
    priority: r.priority,
    description: r.description,
    address: r.address,
    point: r.lat == null || r.lng == null ? null : { lat: Number(r.lat), lng: Number(r.lng) },
    photoIds: r.photo_ids ?? [],
    status: r.status,
    institution: r.institution_id,
    teamId: r.team_id,
    queueOrder: r.queue_order,
    remainingMinutes: r.remaining_minutes,
    remainingSetAt: date(r.remaining_set_at),
    etaArrival: date(r.eta_arrival),
    etaFinish: date(r.eta_finish),
    agentReason: r.agent_reason,
    resolutionNote: r.resolution_note,
    resolutionPhotoIds: r.resolution_photo_ids ?? [],
    resolvedAt: date(r.resolved_at),
    mergedInto: r.merged_into ?? null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export function rowToEvent(r: Row): RequestEvent {
  return {
    id: r.id,
    requestId: r.request_id,
    status: r.status,
    type: r.type,
    body: r.body,
    public: r.public,
    actorRole: r.actor_role,
    actorId: r.actor_id,
    at: new Date(r.created_at),
  };
}

export async function getRequest(q: Db, id: string, lock = false): Promise<CitizenRequest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await q.query(`SELECT * FROM request WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] ? rowToRequest(rows[0]) : null;
}

export async function getEvents(q: Db, id: string, publicOnly: boolean): Promise<RequestEvent[]> {
  const { rows } = await q.query(
    `SELECT * FROM request_event WHERE request_id=$1 ${publicOnly ? "AND public" : ""} ORDER BY created_at, id`,
    [id],
  );
  return rows.map(rowToEvent);
}

export async function insertEvent(q: Db, event: Omit<RequestEvent, "id">): Promise<RequestEvent> {
  const full = { ...event, id: randomUUID() };
  await q.query(
    `INSERT INTO request_event (id, request_id, status, type, body, public, actor_role, actor_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [full.id, full.requestId, full.status, full.type, full.body, full.public, full.actorRole, full.actorId, full.at],
  );
  return full;
}

export async function writeRequest(q: Db, r: CitizenRequest) {
  await q.query(
    `UPDATE request SET status=$2, priority=$3, category=$4, kind=$5, institution_id=$6, team_id=$7, queue_order=$8,
       remaining_minutes=$9, remaining_set_at=$10, eta_arrival=$11, eta_finish=$12, agent_reason=$13,
       resolution_note=$14, resolution_photo_ids=$15, resolved_at=$16, lat=$17, lng=$18, updated_at=$19, merged_into=$20
     WHERE id=$1`,
    [
      r.id, r.status, r.priority, r.category, r.kind, r.institution, r.teamId, r.queueOrder,
      r.remainingMinutes, r.remainingSetAt, r.etaArrival, r.etaFinish, r.agentReason,
      r.resolutionNote, r.resolutionPhotoIds, r.resolvedAt, r.point?.lat ?? null, r.point?.lng ?? null, r.updatedAt, r.mergedInto,
    ],
  );
}

/** Renumbers a team's active queue 1..n keeping the current order. */
export async function reorderQueue(q: Db, teamId: string) {
  await q.query(
    `UPDATE request r SET queue_order = s.n FROM (
       SELECT id, row_number() OVER (ORDER BY queue_order NULLS LAST, created_at) AS n
       FROM request WHERE team_id=$1 AND status IN ('assigned','en_route','on_site')
     ) s WHERE r.id = s.id`,
    [teamId],
  );
}

/** Puts a request at a 1-based position in its team's queue. */
export async function placeInQueue(q: Db, requestId: string, teamId: string, position: number) {
  await q.query(
    `UPDATE request SET queue_order = queue_order + 1
     WHERE team_id=$1 AND id<>$2 AND status IN ('assigned','en_route','on_site') AND queue_order >= $3`,
    [teamId, requestId, position],
  );
  await q.query(`UPDATE request SET queue_order=$2 WHERE id=$1`, [requestId, position]);
  await reorderQueue(q, teamId);
}

export type Mutation = {
  /** Refuse unless the locked row is still in one of these states (guards against races). */
  expectStatus?: RequestStatus[];
  /** Runs inside the transaction after the transition, e.g. to set the queue position. */
  inside?: (q: Db, after: CitizenRequest) => Promise<void>;
};

/**
 * Locks the request, applies the transition, stores it with its event and
 * keeps team queues compact. Hooks (ETA, push) run after commit.
 */
export async function saveTransition(
  ctx: { db: Db; hooks: ChangeHook[]; now: () => Date },
  id: string,
  action: Action,
  actor: Actor,
  mutation: Mutation = {},
): Promise<CitizenRequest> {
  const change = await ctx.db.tx(async (q) => {
    const before = await getRequest(q, id, true);
    if (!before) throw new HttpError(404, "Talep bulunamadı.");
    if (mutation.expectStatus && !mutation.expectStatus.includes(before.status))
      throw new TransitionError("invalid_state", "Talep bu arada değişti. Liste yenilendi.");
    const { request: after, event } = applyTransition(before, action, actor, ctx.now());
    await writeRequest(q, after);
    const stored = await insertEvent(q, event);
    if (mutation.inside) await mutation.inside(q, after);
    for (const teamId of new Set([before.teamId, after.teamId]))
      if (teamId) await reorderQueue(q, teamId);
    return { before, after: (await getRequest(q, id))!, event: stored };
  });
  for (const hook of ctx.hooks) {
    try {
      await hook(change);
    } catch (error) {
      console.error("Request change hook failed", error);
    }
  }
  return change.after;
}

export function citizenView(
  r: CitizenRequest,
  events: RequestEvent[],
  photo: (id: string) => string,
) {
  const team = r.teamId ? teamById(r.teamId) : null;
  return {
    id: r.id,
    reference: r.reference,
    kind: r.kind,
    category: r.category,
    categoryName: categories[r.category].name,
    priority: r.priority,
    description: r.description,
    address: r.address,
    point: r.point,
    status: r.status,
    statusLabel: statusLabel(r),
    institutionName: r.institution ? institutions[r.institution].name : null,
    teamName: team?.name ?? null,
    queuePosition: r.queueOrder,
    etaArrival: r.etaArrival,
    etaFinish: r.etaFinish,
    resolutionNote: r.resolutionNote,
    resolvedAt: r.resolvedAt,
    photos: r.photoIds.map(photo),
    resolutionPhotos: r.resolutionPhotoIds.map(photo),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    events: events.map((e) => ({ id: e.id, status: e.status, type: e.type, body: e.body, at: e.at })),
  };
}

export const photoLinker = (config: { baseUrl: string; secret: string }) => (id: string) =>
  photoUrl(config.baseUrl, config.secret, id);
