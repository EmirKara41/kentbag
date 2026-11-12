import { fallbackTravelMinutes, type Point } from "@kentbag/shared";

const USER_AGENT = "KentBag-ders-projesi/2.0";
const CACHE_MS = 10 * 60_000;

/** Road travel time (OSRM) and address lookup (Nominatim), both with safe fallbacks. */
export function createGeo(deps: { fetch?: typeof fetch; now?: () => number } = {}) {
  const get = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const cache = new Map<string, { minutes: number; at: number }>();

  async function travel(a: Point, b: Point): Promise<number> {
    const key = `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.minutes;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
      const r = await get(url, { signal: AbortSignal.timeout(2500), headers: { "User-Agent": USER_AGENT } });
      const body = (await r.json()) as { code?: string; routes?: { duration: number }[] };
      if (!r.ok || body.code !== "Ok" || !body.routes?.length) throw new Error("no route");
      const minutes = Math.ceil(body.routes[0].duration / 60);
      cache.set(key, { minutes, at: now() });
      return minutes;
    } catch {
      return fallbackTravelMinutes(a, b);
    }
  }

  async function geocode(address: string): Promise<Point | null> {
    try {
      const q = encodeURIComponent(`${address}, Oltu, Erzurum`);
      const r = await get(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${q}`, {
        signal: AbortSignal.timeout(3000),
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "tr" },
      });
      if (!r.ok) return null;
      const list = (await r.json()) as { lat: string; lon: string }[];
      if (!list.length) return null;
      return { lat: Number(list[0].lat), lng: Number(list[0].lon) };
    } catch {
      return null;
    }
  }

  return { travel, geocode };
}
