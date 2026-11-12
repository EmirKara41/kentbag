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
  createdAt: string;
  updatedAt: string;
};

export type StaffRequestDetail = StaffRequest & {
  citizenName?: string;
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
