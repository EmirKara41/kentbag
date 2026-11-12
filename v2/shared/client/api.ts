import type { LocalPhoto } from "./native.ts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON client with bearer session; one instance per app. */
export function createApi(baseUrl: string, token: () => Promise<string | null>, onSignedOut: () => void) {
  const base = baseUrl.replace(/\/$/, "");
  async function call<T>(path: string, init: { method?: string; body?: unknown; raw?: Blob } = {}): Promise<T> {
    const t = await token();
    let response: Response;
    try {
      response = await fetch(base + path, {
        method: init.method ?? (init.raw ? "PUT" : init.body === undefined ? "GET" : "POST"),
        headers: {
          ...(init.raw ? { "Content-Type": init.raw.type || "image/jpeg" } : init.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ApiError(0, "İnternete ulaşılamadı. Bağlantını kontrol edip tekrar dene.");
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      if (response.status === 401) onSignedOut();
      throw new ApiError(response.status, data.error ?? "Sunucu isteği tamamlayamadı.");
    }
    return data as T;
  }
  async function signIn(email: string, password: string, signUp?: { name: string }) {
    const response = await fetch(`${base}/api/auth/${signUp ? "sign-up" : "sign-in"}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signUp ? { email, password, name: signUp.name } : { email, password }),
    }).catch(() => {
      throw new ApiError(0, "İnternete ulaşılamadı.");
    });
    const token = response.headers.get("set-auth-token");
    if (!response.ok || !token) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(response.status, signUp ? (data.message ?? "Hesap oluşturulamadı. Bu e-posta kullanılıyor olabilir.") : "E-posta veya şifre hatalı.");
    }
    return token;
  }
  async function uploadPhoto(photo: LocalPhoto): Promise<string> {
    const blob = await (await fetch(photo.uri)).blob();
    return (await call<{ id: string }>(`/api/photos/${photo.id}`, { raw: blob })).id;
  }
  return { call, signIn, uploadPhoto };
}

export type Api = ReturnType<typeof createApi>;
