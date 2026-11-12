import type { RequestStatus } from "@kentbag/shared";

export type CrewAction = "depart" | "arrive" | "resolve";

/** The single big button for the job in hand. */
export function nextAction(status: RequestStatus): { label: string; action: CrewAction } | null {
  if (status === "assigned") return { label: "Yola çıktım", action: "depart" };
  if (status === "en_route") return { label: "Vardım", action: "arrive" };
  if (status === "on_site") return { label: "Bitti", action: "resolve" };
  return null;
}

export const remainingChoices = [15, 30, 45, 60, 90, 120];

export type CrewJob = {
  id: string;
  reference: string;
  category: string;
  categoryName: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: RequestStatus;
  description: string;
  address: string;
  point: { lat: number; lng: number } | null;
  photos: string[];
  queuePosition: number | null;
  etaArrival: string | null;
  etaFinish: string | null;
  remainingMinutes: number | null;
  createdAt: string;
};

export type Queue = {
  team: { id: string; name: string; institution: string; institutionName: string; onShift: boolean; active: boolean };
  jobs: CrewJob[];
};
