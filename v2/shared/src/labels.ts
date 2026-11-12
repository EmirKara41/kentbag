import { institutions, teamById } from "./catalog.ts";
import type { CitizenRequest } from "./types.ts";

export function statusLabel(req: CitizenRequest, institutionName?: string, teamName?: string): string {
  switch (req.status) {
    case "received":
      return "Alındı";
    case "routed": {
      const dative = req.institution ? institutions[req.institution].dative : institutionName;
      return dative ? `${dative} iletildi` : "Kuruma iletildi";
    }
    case "assigned": {
      const name = teamName ?? (req.teamId ? teamById(req.teamId)?.name : undefined);
      return name ? `${name.replace(/ekibi$/, "ekibine")} atandı` : "Ekibe atandı";
    }
    case "en_route":
      return "Ekip yolda";
    case "on_site":
      return "Ekip sahada";
    case "resolved":
      return "Çözüldü";
    case "reopened":
      return "Sorun devam ediyor";
    case "cancelled":
      return "İptal edildi";
    case "returned":
      return "Yeniden atanıyor";
  }
}
