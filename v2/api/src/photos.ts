import { createHmac, timingSafeEqual } from "node:crypto";

export interface PhotoStore {
  put(path: string, bytes: Buffer, contentType: string): Promise<string>;
  get(path: string): Promise<Buffer | null>;
}

export function memoryPhotoStore(): PhotoStore {
  const files = new Map<string, Buffer>();
  return {
    async put(path, bytes) {
      files.set(path, bytes);
      return path;
    },
    async get(path) {
      return files.get(path) ?? null;
    },
  };
}

export async function blobPhotoStore(): Promise<PhotoStore> {
  const { put, get } = await import("@vercel/blob");
  return {
    async put(path, bytes, contentType) {
      const result = await put(`v2/${path}`, bytes, { access: "private", contentType, addRandomSuffix: true });
      return result.pathname;
    },
    async get(path) {
      const result = await get(path, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
  };
}

const sign = (secret: string, id: string, expires: string) =>
  createHmac("sha256", secret).update(`photo:v2:${id}:${expires}`).digest("hex");

/** Signed, time-limited (30 min) URL for a private photo. */
export function photoUrl(baseUrl: string, secret: string, id: string, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + 1800);
  return `${baseUrl}/api/photos/${id}?expires=${expires}&signature=${sign(secret, id, expires)}`;
}

export function verifyPhotoUrl(secret: string, id: string, expires: string, signature: string, now = Date.now()) {
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return false;
  const expected = Buffer.from(sign(secret, id, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
