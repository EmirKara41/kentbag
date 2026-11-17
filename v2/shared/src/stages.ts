import type { RequestKind, RequestStatus } from "./types.ts";

/** Stops on the route strip shown to everyone (fault reports). */
export const routeStops = ["Alındı", "İletildi", "Atandı", "Yolda", "Sahada", "Çözüldü"] as const;

/** Stops for improvement requests, which go to an institution but never to a crew. */
export const improvementStops = ["Alındı", "Kuruma iletildi", "Planlandı", "Tamamlandı"] as const;

export const stopsFor = (kind: RequestKind = "issue"): readonly string[] => (kind === "improvement" ? improvementStops : routeStops);

/** Index of the current stop on the route strip; -1 when the request ended without being done. */
export function routeIndex(status: RequestStatus, kind: RequestKind = "issue"): number {
  if (kind === "improvement") {
    switch (status) {
      case "received":
        return 0;
      case "routed":
      case "reopened":
      case "returned":
      case "merged":
        return 1;
      case "planned":
        return 2;
      case "resolved":
        return 3;
      default:
        return -1;
    }
  }
  switch (status) {
    case "received":
      return 0;
    case "routed":
    case "returned":
    case "reopened":
    case "merged":
    case "planned":
      return 1;
    case "assigned":
      return 2;
    case "en_route":
      return 3;
    case "on_site":
      return 4;
    case "resolved":
      return 5;
    case "cancelled":
    case "rejected":
      return -1;
  }
}

export const isLive = (s: RequestStatus) => s === "assigned" || s === "en_route" || s === "on_site";

/** Requests that are still being worked on (not finished, cancelled, rejected or merged away). */
export const isOpen = (s: RequestStatus) => !["resolved", "cancelled", "rejected", "merged"].includes(s);

export const clockTime = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(d)) : "";

export const dateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(d));
