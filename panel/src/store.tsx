import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyAction, type Action, type PanelState } from "./domain";
import { seedState } from "./fixtures";
const key = "kentbag-panel-demo-v1";
const blank = (): PanelState => ({
  version: 1,
  reports: [],
  teams: [],
  announcements: [],
  works: [],
  audit: [],
});
type Mode = "connecting" | "live" | "demo" | "offline";
function usePanelStore() {
  const [data, setData] = useState<PanelState>(blank),
    [mode, setMode] = useState<Mode>("connecting");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ai, setAi] = useState("no_key");
  const [busy, setBusy] = useState(false),
    [lastSync, setLastSync] = useState("");
  const token = useRef(""),
    revision = useRef(0),
    mutation = useRef(false);
  async function remote<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch("/api/municipality" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...(token.current ? { Authorization: `Bearer ${token.current}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Yerel sisteme ulaşılamadı.");
    return result;
  }
  async function refresh() {
    if (mutation.current) return;
    const expected = revision.current;
    try {
      const result = await remote<{ data: PanelState; ai: string }>(
        "/workspace",
      );
      if (expected !== revision.current || mutation.current) return;
      setData(result.data);
      setAi(result.ai);
      setError("");
      setLastSync(new Date().toISOString());
    } catch {
      if (expected === revision.current)
        setError(
          "Sunucuyla bağlantı kesildi. Son alınan kayıtlar gösteriliyor; bağlantı gelince yenilenecek.",
        );
    }
  }
  async function connect() {
    const expected = ++revision.current;
    setMode("connecting");
    setData(blank());
    setError("");
    try {
      const session = await remote<{ token: string }>("/local-session", {});
      token.current = session.token;
      const result = await remote<{ data: PanelState; ai: string }>(
        "/workspace",
      );
      if (expected !== revision.current) return;
      setData(result.data);
      setAi(result.ai);
      setMode("live");
      setLastSync(new Date().toISOString());
    } catch {
      if (expected === revision.current) {
        setMode("offline");
        setError(
          "Oltu yerel sunucusuna ulaşılamadı. Sunucuyu başlatıp yeniden bağlanabilirsin.",
        );
      }
    }
  }
  function demo() {
    revision.current++;
    token.current = "";
    try {
      const raw = localStorage.getItem(key),
        saved = raw ? JSON.parse(raw) : seedState();
      if (
        saved.version !== 1 ||
        !Array.isArray(saved.reports) ||
        !Array.isArray(saved.audit)
      )
        throw new Error();
      setData(saved);
      setMode("demo");
      setError("");
    } catch {
      setError("Örnek çalışma okunamadı. Tarayıcıdaki kayıt değiştirilmedi.");
    }
  }
  useEffect(() => {
    if (new URLSearchParams(location.search).get("ornek") === "1") demo();
    else void connect();
    return () => {
      revision.current++;
    };
  }, []);
  useEffect(() => {
    if (mode !== "live") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [mode]);
  async function act(action: Action) {
    if (mutation.current) throw new Error("Önceki işlem sürüyor.");
    if (mode === "demo") {
      const next = applyAction(data, action);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        throw new Error("Örnek değişiklik kaydedilemedi.");
      }
      setData(next);
      setNotice("Örnek değişiklik bu tarayıcıya kaydedildi.");
      return;
    }
    if (mode !== "live") throw new Error("Önce yerel sunucuya bağlan.");
    mutation.current = true;
    setBusy(true);
    revision.current++;
    try {
      const result = await remote<{ data: PanelState }>("/actions", action);
      setData(result.data);
      setError("");
      setNotice("İşlem sunucuya kaydedildi.");
      setLastSync(new Date().toISOString());
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  function reset() {
    if (mode !== "demo")
      throw new Error("Gerçek kayıtlar bu ekrandan sıfırlanamaz.");
    const next = seedState();
    localStorage.setItem(key, JSON.stringify(next));
    setData(next);
    setNotice("Örnek çalışma sıfırlandı.");
  }
  async function forward(input: {
    id: string;
    unitId: string;
    instruction: string;
  }) {
    if (mode !== "live")
      throw new Error("Kurumlara gönderim gerçek yerel bağlantı gerektirir.");
    if (mutation.current) throw new Error("Önceki işlem sürüyor.");
    mutation.current = true;
    setBusy(true);
    revision.current++;
    try {
      const result = await remote<{ data: PanelState }>(
        "/institutions/forward",
        input,
      );
      setData(result.data);
      setError("");
      setNotice("Talep kurum çalışma alanına gönderildi.");
      setLastSync(new Date().toISOString());
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  return {
    data,
    mode,
    ai,
    busy,
    lastSync,
    error,
    act,
    reset,
    notice,
    setNotice,
    connect,
    demo,
    forward,
  };
}
const Context = createContext<ReturnType<typeof usePanelStore> | null>(null);
export function PanelProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={usePanelStore()}>{children}</Context.Provider>
  );
}
export function usePanel() {
  const value = useContext(Context);
  if (!value) throw new Error("Panel provider missing");
  return value;
}
