import { createApi } from "../../shared/client/api.ts";
import { sessionStore } from "../../shared/client/native.ts";

export const session = sessionStore("kb.crew.session");
export const signedOut = new EventTarget();
export const api = createApi(
  (import.meta.env.VITE_API_URL as string | undefined) ?? "",
  () => session.get(),
  () => {
    void session.clear();
    signedOut.dispatchEvent(new Event("out"));
  },
);
