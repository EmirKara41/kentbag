import { createApi } from "../../shared/client/api.ts";
import { sessionStore } from "../../shared/client/native.ts";
import type { RequestKind, RequestStatus } from "@kentbag/shared";

export const session = sessionStore("kb.citizen.session");
export const signedOut = new EventTarget();
export const api = createApi(
  (import.meta.env.VITE_API_URL as string | undefined) ?? "",
  () => session.get(),
  () => {
    void session.clear();
    signedOut.dispatchEvent(new Event("out"));
  },
);

export type CitizenView = {
  id: string;
  reference: string;
  kind: RequestKind;
  category: string;
  categoryName: string;
  priority: string;
  description: string;
  address: string;
  point: { lat: number; lng: number } | null;
  status: RequestStatus;
  statusLabel: string;
  institutionName: string | null;
  teamName: string | null;
  queuePosition: number | null;
  etaArrival: string | null;
  etaFinish: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  photos: string[];
  resolutionPhotos: string[];
  createdAt: string;
  events: { id: string; status: string; body: string; at: string }[];
  /** "own" for the citizen's reports, "following" for problems they joined. */
  relation: "own" | "following";
  mergedWith: string | null;
  othersAffected: boolean;
  canReopen: boolean;
  canCancel: boolean;
  referral: { district: string; province: string | null; contacts: { name: string; phone: string; why: string }[] } | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  from: string;
  neighborhood: string | null;
  requestReference: string | null;
  endsAt: string;
};

export type NearbyProblem = {
  id: string;
  reference: string;
  kind: RequestKind;
  categoryName: string;
  status: RequestStatus;
  statusLabel: string;
  etaArrival: string | null;
  etaFinish: string | null;
  createdAt: string;
  distanceMeters: number;
  supporting: boolean;
};
