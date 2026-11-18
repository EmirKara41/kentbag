export type Point = { lat: number; lng: number };

export type Role = "citizen" | "center" | "institution" | "crew";

export type CategoryId =
  | "electricity"
  | "water"
  | "waste"
  | "road"
  | "ice"
  | "lighting"
  | "pavement"
  | "accessibility"
  | "park";

export type InstitutionId =
  | "electricity"
  | "water"
  | "cleaning"
  | "public-works"
  | "parks";

export type RequestKind = "issue" | "improvement";

export type Priority = "urgent" | "high" | "normal" | "low";

export type RequestStatus =
  | "received"
  | "routed"
  | "assigned"
  | "en_route"
  | "on_site"
  | "resolved"
  | "reopened"
  | "cancelled"
  | "returned"
  // Improvement requests: the institution plans or rejects them.
  | "planned"
  | "rejected"
  // Joined into another request about the same problem; follows that request.
  | "merged"
  // Outside the municipality's area; the citizen got numbers of the responsible bodies.
  | "referred";

export type CitizenRequest = {
  id: string;
  reference: string;
  citizenId: string;
  kind: RequestKind;
  category: CategoryId;
  priority: Priority;
  description: string;
  address: string;
  point: Point | null;
  photoIds: string[];
  status: RequestStatus;
  institution: InstitutionId | null;
  teamId: string | null;
  queueOrder: number | null;
  remainingMinutes: number | null;
  remainingSetAt: Date | null;
  etaArrival: Date | null;
  etaFinish: Date | null;
  agentReason: string | null;
  resolutionNote: string | null;
  resolutionPhotoIds: string[];
  resolvedAt: Date | null;
  /** Set when this request was merged into another one. */
  mergedInto: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ActorRole = Role | "agent";

export type RequestEvent = {
  id: string;
  requestId: string;
  status: RequestStatus;
  type: string;
  body: string;
  public: boolean;
  actorRole: ActorRole;
  actorId: string | null;
  at: Date;
};
