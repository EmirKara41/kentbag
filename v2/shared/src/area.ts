import { categories } from "./catalog.ts";
import type { CategoryId, Priority } from "./types.ts";

/** Where this municipality is responsible. */
export const serviceArea = { district: "Oltu", province: "Erzurum", municipality: "Oltu Belediyesi" } as const;

export type Place = { district: string | null; province: string | null };

const norm = (s: string) => s.toLocaleLowerCase("tr").trim();

/** True when the place is known and is not in Oltu. Unknown places count as inside, so nothing is refused by mistake. */
export function outsideServiceArea(place: Place | null): boolean {
  if (!place?.district) return false;
  return norm(place.district) !== norm(serviceArea.district);
}

export type Contact = { name: string; phone: string; why: string };

/**
 * Who to call instead. Only nationwide short numbers are used, because district landlines change;
 * the responsible municipality is named so the citizen knows whom they are asking for.
 */
export function referralContacts(category: CategoryId, place: Place, priority: Priority = "normal"): Contact[] {
  const district = place.district ?? "Bulunduğun ilçe";
  const list: Contact[] = [];
  if (priority === "urgent") list.push({ name: "Acil çağrı", phone: "112", why: "Can güvenliği riski varsa önce 112'yi ara." });
  if (category === "electricity" || category === "lighting")
    list.push({ name: "Elektrik arıza hattı", phone: "186", why: "Elektrik kesintisi ve sokak aydınlatması arızaları." });
  if (category === "water") list.push({ name: "Su arıza hattı", phone: "185", why: "Su kesintisi ve kanalizasyon arızaları." });
  if (category === "road" || category === "ice")
    list.push({ name: "Karayolları (KGM)", phone: "159", why: "Devlet ve il yolları ile şehirler arası yollar." });
  list.push({
    name: `${district} Belediyesi`,
    phone: "153",
    why: `Belediye çağrı hattı. ${categories[category].name} bildirimin için ${district} Belediyesi'ni sor.`,
  });
  return list;
}

export function referralMessage(place: Place) {
  const where = [place.district, place.province].filter(Boolean).join(", ");
  return `Bildirdiğin yer (${where}) ${serviceArea.municipality}'nin yetki alanı dışında. Sorunu aşağıdaki numaralardan ilgili kuruma iletebilirsin.`;
}
