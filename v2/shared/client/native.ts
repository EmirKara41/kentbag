// Shared by the citizen and crew Android apps (Capacitor). Falls back to
// browser behaviour so both apps also run in a desktop browser for testing.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { App as NativeApp } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";

export const isNative = Capacitor.isNativePlatform();

const Vault = registerPlugin<{
  get(): Promise<{ value?: string }>;
  set(options: { value: string }): Promise<void>;
  clear(): Promise<void>;
}>("KentSession");

/** Session token: Android Keystore on the phone, localStorage in a browser. */
export function sessionStore(key: string) {
  return {
    async get() {
      return isNative ? ((await Vault.get()).value ?? null) : localStorage.getItem(key);
    },
    async set(value: string) {
      if (isNative) await Vault.set({ value });
      else localStorage.setItem(key, value);
    },
    async clear() {
      if (isNative) await Vault.clear();
      else localStorage.removeItem(key);
    },
  };
}

export type LocalPhoto = { id: string; uri: string };

/** Downscales to 1600 px JPEG so uploads stay well under the 3 MB limit. */
export async function preparePhoto(blob: Blob): Promise<LocalPhoto> {
  if (!blob.type.startsWith("image/")) throw new Error("Bir fotoğraf dosyası seç.");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Fotoğraf hazırlanamadı.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { id: crypto.randomUUID(), uri: canvas.toDataURL("image/jpeg", 0.8) };
  } catch {
    throw new Error("Bu fotoğraf okunamadı. JPEG veya PNG bir fotoğraf seç.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function capturePhoto(source: "camera" | "gallery"): Promise<LocalPhoto | null> {
  try {
    const result =
      source === "camera"
        ? await Camera.takePhoto({ quality: 85, targetWidth: 1600, targetHeight: 1600 })
        : (await Camera.chooseFromGallery({ quality: 85, allowMultipleSelection: false })).results[0];
    if (!result?.webPath) return null;
    return preparePhoto(await (await fetch(result.webPath)).blob());
  } catch (e) {
    if (/cancel|iptal/i.test(String(e))) return null;
    throw new Error("Fotoğraf açılamadı. Kamera iznini kontrol et veya galeriden seç.");
  }
}

export async function currentPosition(): Promise<{ lat: number; lng: number }> {
  try {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    throw new Error("Konum alınamadı. Konum iznini aç veya haritadan seç.");
  }
}

/** Calls back whenever the app returns to the foreground. */
export function onResume(fn: () => void) {
  if (!isNative) {
    const handler = () => document.visibilityState === "visible" && fn();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }
  const listener = NativeApp.addListener("appStateChange", (s) => s.isActive && fn());
  return () => void listener.then((l) => l.remove());
}

/** Push needs google-services.json in the APK; builds without it set VITE_PUSH=off. */
export const pushAvailable = isNative && import.meta.env.VITE_PUSH === "on";

export async function enablePush(onToken: (token: string) => void, onOpen: (requestId: string) => void) {
  if (!pushAvailable) return false;
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return false;
  await PushNotifications.createChannel({ id: "kentbag", name: "Talep güncellemeleri", importance: 4 });
  await PushNotifications.addListener("registration", (t) => onToken(t.value));
  await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
    const id = a.notification.data?.requestId;
    if (id) onOpen(String(id));
  });
  await PushNotifications.register();
  return true;
}

export function openInMaps(point: { lat: number; lng: number }, label: string) {
  window.open(`geo:${point.lat},${point.lng}?q=${point.lat},${point.lng}(${encodeURIComponent(label)})`, "_system");
}
