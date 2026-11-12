import { institutions, teamById } from "./catalog.ts";
import type {
  ActorRole,
  CitizenRequest,
  InstitutionId,
  RequestEvent,
  RequestStatus,
} from "./types.ts";

export type Action =
  | { type: "route"; institution: InstitutionId; reason: string }
  | { type: "assign"; teamId: string; reason: string }
  | { type: "depart" }
  | { type: "arrive"; remainingMinutes: number }
  | { type: "update_remaining"; remainingMinutes: number }
  | { type: "resolve"; note: string; photoIds: string[] }
  | { type: "reopen"; note: string; photoIds: string[] }
  | { type: "cancel"; reason: string }
  | { type: "decline"; reason: string };

export type Actor = {
  role: ActorRole;
  userId?: string;
  teamId?: string;
  institution?: InstitutionId;
};

export class TransitionError extends Error {
  constructor(
    readonly code: "invalid_state" | "forbidden" | "invalid_input",
    message: string,
  ) {
    super(message);
  }
}

const ACTIVE: RequestStatus[] = ["received", "routed", "assigned", "en_route", "on_site", "reopened", "returned"];

const rules: Record<Action["type"], { from: RequestStatus[]; to: RequestStatus }> = {
  route: { from: ["received", "reopened", "returned", "routed"], to: "routed" },
  assign: { from: ["routed", "assigned", "returned", "reopened"], to: "assigned" },
  depart: { from: ["assigned"], to: "en_route" },
  arrive: { from: ["assigned", "en_route"], to: "on_site" },
  update_remaining: { from: ["on_site"], to: "on_site" },
  resolve: { from: ["assigned", "en_route", "on_site"], to: "resolved" },
  reopen: { from: ["resolved"], to: "reopened" },
  cancel: { from: ACTIVE, to: "cancelled" },
  decline: { from: ["assigned", "en_route", "on_site"], to: "returned" },
};

const forbid = (message = "Bu işlem için yetkiniz yok.") => new TransitionError("forbidden", message);
const invalid = (message: string) => new TransitionError("invalid_input", message);

function text(value: string, min: number, label: string) {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < min || trimmed.length > 1000)
    throw invalid(`${label} en az ${min}, en fazla 1000 karakter olmalı.`);
  return trimmed;
}
function minutes(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 600)
    throw invalid("Kalan süre 1 ile 600 dakika arasında olmalı.");
  return value;
}
function photos(ids: string[]) {
  if (!Array.isArray(ids) || ids.length > 3) throw invalid("En fazla 3 fotoğraf eklenebilir.");
  return [...ids];
}

function authorize(req: CitizenRequest, action: Action, actor: Actor) {
  const ownCrew = actor.role === "crew" && !!req.teamId && actor.teamId === req.teamId;
  const ownInstitution = actor.role === "institution" && !!req.institution && actor.institution === req.institution;
  const owner = actor.role === "citizen" && actor.userId === req.citizenId;
  switch (action.type) {
    case "route":
      if (actor.role !== "agent" && actor.role !== "center") throw forbid();
      return;
    case "assign":
      if (!(actor.role === "agent" || actor.role === "center" || ownInstitution)) throw forbid();
      return;
    case "depart":
    case "arrive":
    case "update_remaining":
    case "resolve":
    case "decline":
      if (!ownCrew) throw forbid("Bu iş ekibinize ait değil.");
      return;
    case "reopen":
      if (!owner) throw forbid();
      return;
    case "cancel":
      if (!(owner || actor.role === "center" || ownInstitution)) throw forbid();
      return;
  }
}

const clearAssignment = (r: CitizenRequest) => {
  r.teamId = null;
  r.queueOrder = null;
  r.remainingMinutes = null;
  r.remainingSetAt = null;
  r.etaArrival = null;
  r.etaFinish = null;
};

export function applyTransition(
  req: CitizenRequest,
  action: Action,
  actor: Actor,
  now: Date,
): { request: CitizenRequest; event: Omit<RequestEvent, "id"> } {
  authorize(req, action, actor);
  const rule = rules[action.type];
  if (!rule.from.includes(req.status))
    throw new TransitionError("invalid_state", "Talep bu işlem için uygun durumda değil.");
  const next: CitizenRequest = { ...req, photoIds: [...req.photoIds], resolutionPhotoIds: [...req.resolutionPhotoIds] };
  let body = "";
  let isPublic = true;
  switch (action.type) {
    case "route":
      clearAssignment(next);
      next.institution = action.institution;
      next.agentReason = action.reason;
      body = `${institutions[action.institution].dative} iletildi.`;
      break;
    case "assign": {
      const team = teamById(action.teamId);
      if (!team || team.institution !== req.institution)
        throw invalid("Seçilen ekip bu talebin kurumuna ait değil.");
      if (actor.role === "institution" && team.institution !== actor.institution) throw forbid();
      clearAssignment(next);
      next.teamId = team.id;
      next.agentReason = action.reason;
      body = `${team.name.replace(/ekibi$/, "ekibine")} atandı.`;
      break;
    }
    case "depart":
      body = "Ekip yola çıktı.";
      break;
    case "arrive":
      next.remainingMinutes = minutes(action.remainingMinutes);
      next.remainingSetAt = now;
      next.etaArrival = null;
      body = `Ekip sahada. Tahmini kalan süre ${next.remainingMinutes} dk.`;
      break;
    case "update_remaining":
      next.remainingMinutes = minutes(action.remainingMinutes);
      next.remainingSetAt = now;
      body = `Tahmini kalan süre güncellendi: ${next.remainingMinutes} dk.`;
      break;
    case "resolve":
      next.resolutionNote = text(action.note, 10, "Yapılan işlem açıklaması");
      next.resolutionPhotoIds = photos(action.photoIds);
      next.resolvedAt = now;
      next.remainingMinutes = null;
      next.remainingSetAt = null;
      next.etaArrival = null;
      next.etaFinish = null;
      next.queueOrder = null;
      body = `Sorun giderildi: ${next.resolutionNote}`;
      break;
    case "reopen": {
      const note = text(action.note, 5, "Açıklama");
      photos(action.photoIds);
      clearAssignment(next);
      next.resolvedAt = null;
      body = `Vatandaş sorunun devam ettiğini bildirdi: ${note}`;
      break;
    }
    case "cancel":
      clearAssignment(next);
      body = `Talep iptal edildi: ${text(action.reason, 10, "Gerekçe")}`;
      // Staff cancellations are shown to the citizen with the reason.
      isPublic = actor.role !== "citizen";
      break;
    case "decline":
      clearAssignment(next);
      body = `Ekip işi iade etti: ${text(action.reason, 10, "Gerekçe")}`;
      isPublic = false;
      break;
  }
  next.status = rule.to;
  next.updatedAt = now;
  return {
    request: next,
    event: {
      requestId: req.id,
      status: rule.to,
      type: action.type,
      body,
      public: isPublic,
      actorRole: actor.role,
      actorId: actor.userId ?? null,
      at: now,
    },
  };
}
