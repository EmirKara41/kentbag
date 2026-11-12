import type { RequestStatus } from "./types.ts";

/** Stops on the route strip shown to everyone. */
export const routeStops = ["Alındı", "İletildi", "Atandı", "Yolda", "Sahada", "Çözüldü"] as const;

/** Index of the current stop on the route strip; -1 for cancelled. */
export function routeIndex(status: RequestStatus): number {
  switch (status) {
    case "received":
      return 0;
    case "routed":
    case "returned":
    case "reopened":
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
      return -1;
  }
}

export const isLive = (s: RequestStatus) => s === "assigned" || s === "en_route" || s === "on_site";

export const clockTime = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(d)) : "";

export const dateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(d));
