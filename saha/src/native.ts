import { Capacitor, registerPlugin } from "@capacitor/core";
import { Camera } from "@capacitor/camera";

import type { Photo } from "./domain";
const Vault = registerPlugin<{
  get(): Promise<{ value?: string }>;
  set(options: { value: string }): Promise<void>;
  clear(): Promise<void>;
}>("KentSession");
export const native = Capacitor.isNativePlatform();
export const sessionStore = {
  async get() {
    return native
      ? ((await Vault.get()).value ?? null)
      : sessionStorage.getItem("kent.field.preview.session");
  },
  async set(value: string) {
    if (native) await Vault.set({ value });
    else sessionStorage.setItem("kent.field.preview.session", value);
  },
  async clear() {
    if (native) await Vault.clear();
    else sessionStorage.removeItem("kent.field.preview.session");
  },
};
export async function preparePhoto(blob: Blob): Promise<Photo> {
  if (!blob.type.startsWith("image/"))
    throw new Error("Bir fotoğraf dosyası seç.");
  if (blob.size > 25 * 1024 * 1024)
    throw new Error("Fotoğraf çok büyük. Daha küçük bir görsel seç.");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale)),
      height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Fotoğraf hazırlanamadı.");
    context.drawImage(image, 0, 0, width, height);
    return {
      id: crypto.randomUUID(),
      uri: canvas.toDataURL("image/jpeg", 0.78),
      width,
      height,
    };
  } catch (cause) {
    throw new Error(
      "Bu fotoğraf okunamadı. JPEG veya PNG fotoğraf seçmeyi dene.",
      { cause },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function capturePhoto(source: "camera" | "gallery") {
  try {
    const result =
      source === "camera"
        ? await Camera.takePhoto({
            quality: 85,
            targetWidth: 1600,
            targetHeight: 1600,
          })
        : (
            await Camera.chooseFromGallery({
              quality: 85,
              allowMultipleSelection: false,
            })
          ).results[0];
    if (!result?.webPath) return null;
    return preparePhoto(await (await fetch(result.webPath)).blob());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/cancel|canceled|cancelled|iptal/i.test(message)) return null;
    throw new Error(
      "Fotoğraf açılamadı. Kamera iznini kontrol et veya galeriden bir fotoğraf seç.",
      { cause: e },
    );
  }
}
