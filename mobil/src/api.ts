import type { Draft, Profile, Report, Workspace } from "./domain";
import { draftError } from "./domain";
import { sessionStore } from "./native";
const configured = import.meta.env.VITE_API_URL?.trim();
export const serviceReady = !!configured;
let token: string | null = null;
let epoch = 0;
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
function endpoint() {
  if (!configured)
    throw new ApiError(
      "Hesap hizmeti henüz kullanıma açılmadı. Bildirimini taslak olarak hazırlayabilirsin.",
    );
  const url = new URL(configured);
  const parts = url.hostname.split(".").map(Number);
  const privateLan =
    parts.length === 4 &&
    parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255) &&
    (parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ((import.meta.env.DEV &&
        ["localhost", "127.0.0.1"].includes(url.hostname)) ||
        (import.meta.env.VITE_LAN_PILOT === "true" && privateLan))
    )
  )
    throw new ApiError("Hizmet bağlantısı kullanılamıyor.");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new ApiError("Hizmet bağlantısı kullanılamıyor.");
  return url.origin;
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
  owner?: string,
): Promise<T> {
  const base = endpoint();
  const version = epoch;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (owner) headers.set("X-Citizen-Id", owner);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (version !== epoch)
      throw new ApiError("Oturum değişti. Lütfen yeniden giriş yap.");
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/api/auth/sign-")) {
        token = null;
        epoch++;
        await sessionStore.clear();
      }
      throw new ApiError(
        typeof body?.error === "string"
          ? body.error
          : typeof body?.message === "string"
            ? body.message
            : "İşlem tamamlanamadı. Lütfen yeniden dene.",
        response.status,
      );
    }
    const refreshed = response.headers.get("set-auth-token");
    if (refreshed) {
      await sessionStore.set(refreshed);
      token = refreshed;
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      navigator.onLine
        ? "Hizmete şu anda ulaşılamıyor. Biraz sonra yeniden dene; taslağın korunur."
        : "İnternet bağlantın yok. Bağlandıktan sonra tekrar dene.",
    );
  } finally {
    clearTimeout(timer);
  }
}
const json = <T>(
  path: string,
  method: string,
  body: unknown = {},
  owner?: string,
) =>
  request<T>(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    owner,
  );
export const api = {
  async restore() {
    token = await sessionStore.get();
    if (!token) return null;
    const session = await request<{ user: Profile } | null>(
      "/api/auth/get-session",
    );
    if (!session) {
      token = null;
      await sessionStore.clear();
    }
    return session;
  },
  async authenticate(
    mode: "login" | "register",
    input: {
      name: string;
      email: string;
      password: string;
      neighborhood: string;
    },
  ) {
    epoch++;
    token = null;
    await sessionStore.clear();
    const result = await json<{ user: Profile }>(
      "/api/auth/" + (mode === "login" ? "sign-in/email" : "sign-up/email"),
      "POST",
      {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
      },
    );
    if (!token) throw new ApiError("Giriş tamamlanamadı. Lütfen yeniden dene.");
    if (mode === "register")
      await api.profile(
        { name: input.name.trim(), neighborhood: input.neighborhood },
        result.user.id,
      );
    return api.workspace(result.user.id);
  },
  workspace: (owner?: string) =>
    request<Workspace>("/api/workspace", {}, owner),
  profile: (
    input: Pick<Profile, "name" | "neighborhood"> & {
      homeLocation?: Profile["homeLocation"];
    },
    owner: string,
  ) => json("/api/profile", "PATCH", input, owner),
  async logout() {
    try {
      if (token && configured) await json("/api/auth/sign-out", "POST");
    } finally {
      epoch++;
      token = null;
      await sessionStore.clear();
    }
  },
  async submit(draft: Draft, owner: string) {
    const error = draftError(draft);
    if (error) throw new Error(error);
    const photoIds: string[] = [];
    for (const photo of draft.photos) {
      const blob = await (await fetch(photo.uri)).blob();
      const saved = await request<{ id: string }>(
        `/api/photos/${encodeURIComponent(`${draft.requestId}-${photo.id}`)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        },
        owner,
      );
      photoIds.push(saved.id);
    }
    return json<Report>(
      "/api/reports",
      "POST",
      {
        requestId: draft.requestId,
        kind: draft.kind ?? "issue",
        impacts: draft.impacts ?? [],
        category: draft.category,
        description: draft.description,
        location: draft.location,
        photos: photoIds,
      },
      owner,
    );
  },
  note: (id: string, text: string, owner: string) =>
    json(
      `/api/reports/${encodeURIComponent(id)}/notes`,
      "POST",
      { text },
      owner,
    ),
  feedback: (
    id: string,
    outcome: "solved" | "persists",
    text: string,
    owner: string,
  ) =>
    json(
      `/api/reports/${encodeURIComponent(id)}/feedback`,
      "POST",
      { outcome, text },
      owner,
    ),
  withdraw: (id: string, owner: string) =>
    json(`/api/reports/${encodeURIComponent(id)}/withdraw`, "POST", {}, owner),
  read: (owner: string) => json("/api/inbox/read", "POST", {}, owner),
};
