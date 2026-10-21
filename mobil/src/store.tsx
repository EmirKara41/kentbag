import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Network } from "@capacitor/network";
import { App as NativeApp } from "@capacitor/app";
import { api, ApiError } from "./api";
import { native } from "./native";
import { readDraft, writeDraft } from "./storage";
import type { Draft, Profile, Workspace } from "./domain";

function useCitizenStore() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [savedDraft, setSavedDraft] = useState<{
      owner: string | null;
      value: Draft | null;
    }>({ owner: null, value: null }),
    [loading, setLoading] = useState(false),
    [restoring, setRestoring] = useState(true);
  const [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const owner = useRef<string | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  const install = useCallback((data: Workspace) => {
    if (data.sessionId !== owner.current) return;
    setWorkspace(data);
    setProfile(data.profiles[0] ?? null);
  }, []);
  const refresh = useCallback(async () => {
    const id = owner.current;
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.workspace(id);
      if (owner.current === id) install(data);
    } catch (e) {
      if (owner.current !== id) return;
      setError(e instanceof Error ? e.message : "Bilgiler alınamadı.");
      if (e instanceof ApiError && e.status === 401) {
        owner.current = null;
        setProfile(null);
        setWorkspace(null);
      }
    } finally {
      setLoading(false);
    }
  }, [install]);
  useEffect(() => {
    let active = true;
    void api
      .restore()
      .then(async (session) => {
        if (!active || !session?.user) return;
        owner.current = session.user.id;
        setProfile({
          ...session.user,
          neighborhood: session.user.neighborhood ?? "",
        });
        await refresh();
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Hesabın yüklenemedi.");
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    const id = profile?.id ?? null;
    void readDraft(id)
      .then((value) => {
        if (active) setSavedDraft({ owner: id, value });
      })
      .catch(() => {
        if (active)
          setError("Taslağın okunamadı. Üzerine yeni kayıt yazılmadı.");
      });
    return () => {
      active = false;
    };
  }, [profile?.id]);
  useEffect(() => {
    const subscriptions = [
      Network.addListener("networkStatusChange", (status) => {
        setOnline(status.connected);
        if (status.connected) void refresh();
      }),
    ];
    void Network.getStatus().then((status) => setOnline(status.connected));
    if (native)
      subscriptions.push(
        NativeApp.addListener("appStateChange", (status) => {
          if (status.isActive) void refresh();
        }),
      );
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh();
      },
      15 * 1000,
    );
    return () => {
      clearInterval(timer);
      subscriptions.forEach((p) => {
        void p.then((subscription) => subscription.remove());
      });
    };
  }, [refresh]);
  const saveDraft = useCallback((value: Draft | null, id: string | null) => {
    const next = queue.current.then(async () => {
      await writeDraft(id, value);
      if (owner.current === id) setSavedDraft({ owner: id, value });
    });
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
  async function login(
    mode: "login" | "register",
    input: {
      name: string;
      email: string;
      password: string;
      neighborhood: string;
    },
  ) {
    const data = await api.authenticate(mode, input);
    owner.current = data.sessionId;
    install(data);
    setError("");
  }
  async function logout() {
    try {
      await api.logout();
    } finally {
      owner.current = null;
      setProfile(null);
      setWorkspace(null);
      setError("");
    }
  }
  async function submit(value: Draft, draftOwner: string | null) {
    const id = owner.current;
    if (!id) throw new Error("Bildirimi göndermek için giriş yap.");
    await saveDraft(value, id);
    const receipt = await api.submit(value, id);
    if (owner.current !== id)
      throw new Error(
        "Oturum değişti. Taleplerini giriş yaptıktan sonra kontrol et.",
      );
    setWorkspace((previous) => ({
      sessionId: id,
      profiles: previous?.profiles ?? (profile ? [profile] : []),
      inbox: previous?.inbox ?? [],
      reports: [
        receipt,
        ...(previous?.reports ?? []).filter(
          (report) => report.id !== receipt.id,
        ),
      ],
    }));
    await saveDraft(null, id);
    if (draftOwner !== id) {
      const previous = await readDraft(draftOwner);
      if (previous?.requestId === value.requestId)
        await saveDraft(null, draftOwner);
    }
    void refresh();
    return receipt;
  }
  const draft =
    savedDraft.owner === (profile?.id ?? null) ? savedDraft.value : null;
  return {
    profile,
    workspace,
    draft,
    loading,
    restoring,
    error,
    online,
    refresh,
    saveDraft,
    login,
    logout,
    submit,
  };
}
type Store = ReturnType<typeof useCitizenStore>;
const StoreContext = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  return (
    <StoreContext.Provider value={useCitizenStore()}>
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Citizen store is missing");
  return value;
}
