import { createHmac, timingSafeEqual } from "node:crypto";
import { put, get, del } from "@vercel/blob";
export interface PhotoStore {
  put(path: string, bytes: Buffer, contentType: string): Promise<string>;
  get(path: string): Promise<Buffer | null>;
  del(path: string): Promise<void>;
}
export const privateBlob: PhotoStore = {
  async put(path, bytes, contentType) {
    const result = await put(path, bytes, {
      access: "private",
      contentType,
      addRandomSuffix: true,
    });
    return result.pathname;
  },
  async get(path) {
    const result = await get(path, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  },
  async del(path) {
    await del(path);
  },
};
function signature(secret: string, id: string, expires: string) {
  return createHmac("sha256", secret)
    .update(`photo:v1:${id}:${expires}`)
    .digest("hex");
}
export function photoUrl(
  baseUrl: string,
  secret: string,
  id: string,
  now = Date.now(),
) {
  const expires = String(Math.floor(now / 1000) + 1800);
  return `${baseUrl}/api/photos/${encodeURIComponent(id)}?expires=${expires}&signature=${signature(secret, id, expires)}`;
}
export function verifyPhotoSignature(
  secret: string,
  id: string,
  expires: unknown,
  supplied: unknown,
  now = Date.now(),
) {
  if (
    typeof expires !== "string" ||
    !/^\d{10}$/.test(expires) ||
    typeof supplied !== "string" ||
    !/^[a-f0-9]{64}$/.test(supplied)
  )
    return false;
  const remaining = Number(expires) - Math.floor(now / 1000);
  return (
    remaining > 0 &&
    remaining <= 1800 &&
    timingSafeEqual(
      Buffer.from(supplied, "hex"),
      Buffer.from(signature(secret, id, expires), "hex"),
    )
  );
}
