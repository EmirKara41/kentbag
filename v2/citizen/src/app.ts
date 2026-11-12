import { createApi } from "../../shared/client/api.ts";
import { sessionStore } from "../../shared/client/native.ts";
import type { RequestStatus } from "@kentbag/shared";

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
};
