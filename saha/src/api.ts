import service from "../../mobil/production-service.json";
import { sessionStore } from "./native";
import type { Draft, Workspace } from "./domain";
const base = import.meta.env.VITE_API_URL?.trim() || service.apiUrl;
const url = new URL(base);
if (
  url.protocol !== "https:" &&
  !(import.meta.env.DEV && ["127.0.0.1", "localhost"].includes(url.hostname))
)
  throw new Error("Güvenli sunucu adresi gerekiyor.");
let token: string | null = null;
let epoch = 0;
export class ApiError extends Error {constructor(message:string,readonly status:number){super(message);}}
async function request<T>(
  path: string,
  body?: unknown,
  raw?: Blob,
): Promise<T> {
  const version = epoch;
  const response = await fetch(url.origin + path, {
    method: raw ? "PUT" : body === undefined ? "GET" : "POST",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(raw
        ? { "Content-Type": "image/jpeg" }
        : body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
    },
    ...(raw
      ? { body: raw }
      : body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
  }).catch(()=>{throw new Error("Sunucuya ulaşılamıyor. İnterneti kontrol edin; taslağınız korunuyor.");});
  const data = await response.json().catch(() => null);
  if (version !== epoch)
    throw new Error("Oturum değişti. İşlemi yeniden kontrol edin.");
  if (!response.ok) {
    if (response.status === 401) {
      token = null;
      await sessionStore.clear();
    }
    throw new ApiError(
      typeof data?.error === "string"
        ? data.error
        : data?.message || "İşlem tamamlanamadı. Taslağınız korunuyor.",response.status,
    );
  }
  const refreshed = response.headers.get("set-auth-token");
  if (refreshed) {
    token = refreshed;
    await sessionStore.set(refreshed);
  }
  return data;
}
export const api = {
  async restore() {
    token = await sessionStore.get();
    return token ? request<Workspace>("/api/field/workspace") : null;
  },
  async login(email: string, password: string) {
    epoch++;
    token = null;
    await sessionStore.clear();
    await request("/api/auth/sign-in/email", {
      email: email.trim().toLowerCase(),
      password,
    });
    if (!token) throw new Error("Giriş tamamlanamadı.");
    return request<Workspace>("/api/field/workspace");
  },
  workspace: () => request<Workspace>("/api/field/workspace"),
  act: (orderId: string, type: "accept" | "start") =>
    request("/api/field/actions", { orderId, type }),
  async result(orderId: string, draft: Draft) {
    const photos: string[] = [];
    for (const photo of draft.photos) {
      const file = await (await fetch(photo.uri)).blob();
      const saved = await request<{ id: string }>(
        `/api/photos/field-${orderId}-${photo.id}`,
        undefined,
        file,
      );
      photos.push(saved.id);
    }
    return request("/api/field/actions", {
      orderId,
      type: "submit-result",
      body: draft.body,
      photos,
    });
  },
  async logout() {
    try {
      if (token) await request("/api/auth/sign-out", {});
    } finally {
      epoch++;
      token = null;
      await sessionStore.clear();
    }
  },
};
