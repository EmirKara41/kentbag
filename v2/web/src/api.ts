const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const KEY = "kb.token";

export const session = {
  get: () => sessionStorage.getItem(KEY),
  set: (token: string) => sessionStorage.setItem(KEY, token),
  clear: () => sessionStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = session.get();
  const response = await fetch(base + path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    if (response.status === 401) {
      session.clear();
      window.dispatchEvent(new Event("kb:signed-out"));
    }
    throw new ApiError(response.status, data.error ?? "Sunucuya ulaşılamadı. Bağlantını kontrol et.");
  }
  return data as T;
}

export type Me = { role: "citizen" | "center" | "institution" | "crew"; name: string; institution?: string; teamId?: string };

export type StaffRequest = {
  id: string;
  reference: string;
  kind: "issue" | "improvement";
  category: string;
  categoryName: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: import("@kentbag/shared").RequestStatus;
  statusLabel: string;
  institution: string | null;
  institutionName: string | null;
  teamId: string | null;
  teamName: string | null;
  queuePosition: number | null;
  address: string;
  point: { lat: number; lng: number } | null;
  description: string;
  etaArrival: string | null;
  etaFinish: string | null;
  agentReason: string | null;
  mergedInto: string | null;
  supportCount: number;
  mergedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StaffRequestDetail = StaffRequest & {
  citizenName?: string;
  merged: { id: string; reference: string }[];
  mergedIntoReference: string | null;
  photos: string[];
  resolutionNote?: string | null;
  resolutionPhotos: string[];
  events: { id: string; status: string; type: string; body: string; public: boolean; actorRole: string; at: string }[];
};

export type TeamBoard = {
  id: string;
  name: string;
  institution: string;
  institutionName: string;
  onShift: boolean;
  active: boolean;
  locatedAt: string | null;
  jobs: StaffRequest[];
};

export type AgentSettings = { center: boolean; institutions: Record<string, boolean> };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  from: string;
  institution: string | null;
  neighborhood: string | null;
  requestReference: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  canEnd?: boolean;
};

export type Account = {
  userId: string;
  name: string;
  email: string;
  role: "center" | "institution" | "crew";
  roleLabel: string;
  institution: string | null;
  institutionName: string | null;
  teamId: string | null;
  teamName: string | null;
  active: boolean;
};

export type Application = {
  id: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  institutionName: string;
  teamName: string;
  status: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  createdAt: string;
};

export type Summary = {
  total: number;
  open: number;
  resolved: number;
  improvements: number;
  merged: number;
  avgArrivalMinutes: number | null;
  avgResolutionMinutes: number | null;
  reopenRate: number | null;
};

export type Report = {
  days: number;
  summary: Summary;
  byInstitution: (Summary & { institution: string; name: string })[];
  byCategory: (Summary & { category: string; name: string; kind: string })[];
  unrouted: number;
};

/** Downloads a file from the API with the session token (CSV export). */
export async function download(path: string, filename: string) {
  const token = session.get();
  const response = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError(response.status, "Dosya indirilemedi.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
